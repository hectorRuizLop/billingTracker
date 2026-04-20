"use strict";

const cds = require("@sap/cds");

async function resolveRateSnapshot(employee_ID, project_ID) {
  const { Employees, Categories, ProjectAssignments } = cds.entities("my.billing");

  const assignment = await SELECT.one
    .from(ProjectAssignments)
    .where({ employee_ID, project_ID });

  if (assignment?.customRate != null) return assignment.customRate;

  const employee = await SELECT.one.from(Employees).where({ ID: employee_ID });
  if (employee?.category_ID) {
    const category = await SELECT.one
      .from(Categories)
      .where({ ID: employee.category_ID });
    if (category?.rate != null) return category.rate;
  }

  return null;
}

module.exports = { resolveRateSnapshot };
