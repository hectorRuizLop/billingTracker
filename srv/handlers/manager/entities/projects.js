"use strict";

const cds = require("@sap/cds");

async function beforeCreate(req) {
  const { Employees, Categories } = cds.entities("my.billing");

  // Enforce the authenticated user as the project manager
  const me = await SELECT.one
    .from(Employees)
    .where({ externalId: req.user.id })
    .columns(["ID"]);
  if (me) {
    req.data.manager_ID = me.ID;
  }

  const { budget } = req.data;

  // Weak guard fix: explicit null/undefined check instead of truthy
  if (budget === undefined || budget === null || budget <= 0) {
    return req.error(400, "Project budget must be greater than 0");
  }

  const manager = await SELECT.one
    .from(Employees)
    .where({ externalId: req.user.id });
  let rate = null;
  if (manager?.category_ID) {
    const category = await SELECT.one
      .from(Categories)
      .where({ ID: manager.category_ID });
    rate = category?.rate ?? null;
  }

  req.data.assignments = req.data.assignments ?? [];
  if (manager) {
    req.data.assignments.push({
      employee_ID: manager.ID,
      customRate: rate,
      isActive: true,
    });
  }
}

async function beforeUpdate(req) {
  const { status } = req.data;
  if (status !== "C") return;

  const id =
    (Array.isArray(req.params) ? req.params[0]?.ID : req.params?.ID) ??
    req.data.ID;

  const { Projects } = cds.entities("my.billing");
  const current = await SELECT.one.from(Projects).where({ ID: id });

  if (!current) return req.error(404, "Project not found");

  // Only enforce when transitioning to Closed
  if (current.status === "C") return;

  const { TimeEntries } = cds.entities("my.billing");
  const submittedEntry = await SELECT.one.from(TimeEntries).where({
    project_ID: id,
    status: "S",
  });

  if (submittedEntry) {
    return req.error(400, "Cannot close a project with submitted time entries");
  }

  req.data.closedAt = new Date().toISOString();
  req.data.closedBy = req.user.id;
}

async function afterRead(results, _req) {
  if (!results) return;

  const projects = Array.isArray(results) ? results : [results];
  if (projects.length === 0) return;

  const projectIds = projects.map((p) => p.ID).filter(Boolean);
  if (projectIds.length === 0) return;

  const aggResults = await SELECT.from("my.billing.TimeEntries as T")
    .leftJoin("my.billing.ProjectAssignments as A")
    .on("T.employee_ID = A.employee_ID and T.project_ID = A.project_ID")
    .columns(
      "T.project_ID",
      "SUM(T.hours) as totalHours",
      "SUM(T.hours * COALESCE(T.rateSnapshot, A.customRate)) as totalCost",
    )
    .where({ "T.project_ID": { in: projectIds }, "T.status": "A" })
    .groupBy("T.project_ID");

  const projectedResults = await SELECT.from("my.billing.TimeEntries as T")
    .leftJoin("my.billing.ProjectAssignments as A")
    .on("T.employee_ID = A.employee_ID and T.project_ID = A.project_ID")
    .columns(
      "T.project_ID",
      "SUM(T.hours) as projectedTotalHours",
      "SUM(T.hours * COALESCE(T.rateSnapshot, A.customRate)) as projectedTotalCost",
    )
    .where({
      "T.project_ID": { in: projectIds },
      "T.status": { in: ["A", "S"] },
    })
    .groupBy("T.project_ID");

  const categoryResults = await SELECT.from("my.billing.TimeEntries as T")
    .leftJoin("my.billing.ProjectAssignments as A")
    .on("T.employee_ID = A.employee_ID and T.project_ID = A.project_ID")
    .leftJoin("my.billing.Employees as E")
    .on("T.employee_ID = E.ID")
    .leftJoin("my.billing.Categories as C")
    .on("E.category_ID = C.ID")
    .columns(
      "T.project_ID",
      "C.code as categoryCode",
      "SUM(T.hours) as hours",
      "SUM(T.hours * COALESCE(T.rateSnapshot, A.customRate)) as cost",
    )
    .where({ "T.project_ID": { in: projectIds }, "T.status": "A" })
    .groupBy("T.project_ID", "C.code");

  const aggByProject = {};
  for (const row of aggResults) {
    aggByProject[row.project_ID] = {
      totalHours: row.totalHours || 0,
      totalCost: row.totalCost || 0,
    };
  }

  const projectedByProject = {};
  for (const row of projectedResults) {
    projectedByProject[row.project_ID] = {
      projectedTotalHours: row.projectedTotalHours || 0,
      projectedTotalCost: row.projectedTotalCost || 0,
    };
  }

  const categoryByProject = {};
  for (const row of categoryResults) {
    if (!categoryByProject[row.project_ID]) {
      categoryByProject[row.project_ID] = {};
    }
    categoryByProject[row.project_ID][row.categoryCode] = {
      hours: row.hours || 0,
      cost: row.cost || 0,
    };
  }

  for (const project of projects) {
    const agg = aggByProject[project.ID] || { totalHours: 0, totalCost: 0 };
    const projected = projectedByProject[project.ID] || {
      projectedTotalHours: 0,
      projectedTotalCost: 0,
    };
    const budget = project.budget || 0;
    const cats = categoryByProject[project.ID] || {};

    project.totalHours = agg.totalHours;
    project.totalCost = agg.totalCost;
    project.budgetRemaining = budget - agg.totalCost;
    project.avgCostPerHour =
      agg.totalHours > 0 ? agg.totalCost / agg.totalHours : 0;

    project.projectedTotalHours = projected.projectedTotalHours;
    project.projectedTotalCost = projected.projectedTotalCost;
    project.projectedBudgetRemaining = budget - projected.projectedTotalCost;
    project.submittedHours = projected.projectedTotalHours - agg.totalHours;
    project.submittedCost = projected.projectedTotalCost - agg.totalCost;

    const catDefaults = { hours: 0, cost: 0 };
    const j = cats["J"] || catDefaults;
    const m = cats["M"] || catDefaults;
    const s = cats["S"] || catDefaults;
    const l = cats["L"] || catDefaults;

    project.juniorHours = j.hours;
    project.juniorCost = j.cost;
    project.midLevelHours = m.hours;
    project.midLevelCost = m.cost;
    project.seniorHours = s.hours;
    project.seniorCost = s.cost;
    project.leadHours = l.hours;
    project.leadCost = l.cost;
  }
}

module.exports = { beforeCreate, beforeUpdate, afterRead };
