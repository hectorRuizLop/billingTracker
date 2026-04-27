"use strict";

const cds = require("@sap/cds");

async function beforeCreate(req) {
  const { budget } = req.data;

  if (!budget || budget <= 0) {
    return req.error(400, "Project budget must be greater than 0");
  }

  const { Employees, Categories } = cds.entities("my.billing");

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

  const aggByProject = {};
  for (const row of aggResults) {
    aggByProject[row.project_ID] = {
      totalHours: row.totalHours || 0,
      totalCost: row.totalCost || 0,
    };
  }

  for (const project of projects) {
    const agg = aggByProject[project.ID] || { totalHours: 0, totalCost: 0 };
    const budget = project.budget || 0;

    project.totalHours = agg.totalHours;
    project.totalCost = agg.totalCost;
    project.budgetRemaining = budget - agg.totalCost;
    project.avgCostPerHour =
      agg.totalHours > 0 ? agg.totalCost / agg.totalHours : 0;
  }
}

module.exports = { beforeCreate, beforeUpdate, afterRead };
