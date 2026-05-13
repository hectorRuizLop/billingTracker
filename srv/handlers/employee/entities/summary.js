"use strict";

const cds = require("@sap/cds");

async function onReadMyProjectSummary(req) {
  const { TimeEntries, Employees } = cds.entities("my.billing");

  const me = await SELECT.one
    .from(Employees)
    .where({ externalId: req.user.id })
    .columns(["ID"]);

  if (!me) {
    return [];
  }

  const results = await cds.run(
    cds.ql`SELECT project_ID, project.name as projectName, sum(hours) as totalHours, count(*) as entryCount FROM ${TimeEntries} WHERE employee_ID = ${me.ID} GROUP BY project_ID, project.name`,
  );

  return (results || []).map((r) => ({
    ID: r.project_ID,
    project_ID: r.project_ID,
    projectName: r.projectName,
    totalHours: r.totalHours,
    entryCount: r.entryCount,
  }));
}

async function onReadMyMonthlySummary(req) {
  const { TimeEntries, Employees } = cds.entities("my.billing");

  const me = await SELECT.one
    .from(Employees)
    .where({ externalId: req.user.id })
    .columns(["ID"]);

  if (!me) {
    return [];
  }

  const results = await cds.run(
    cds.ql`SELECT year, month, sum(hours) as totalHours, count(*) as entryCount FROM ${TimeEntries} WHERE employee_ID = ${me.ID} GROUP BY year, month`,
  );

  return (results || []).map((r) => ({
    ID: `${r.year}-${String(r.month).padStart(2, "0")}`,
    year: r.year,
    month: r.month,
    totalHours: r.totalHours,
    entryCount: r.entryCount,
  }));
}

module.exports = {
  onReadMyProjectSummary,
  onReadMyMonthlySummary,
};
