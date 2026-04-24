"use strict";

const cds = require("@sap/cds");

// Resolve the billing rate effective on a given date
async function resolveRateSnapshot(employee_ID, project_ID, asOfDate) {
  const { Employees, Categories, ProjectAssignments } =
    cds.entities("my.billing");

  const refDate = asOfDate || new Date().toISOString().split("T")[0];

  const assignment = await SELECT.one.from(ProjectAssignments).where({
    employee_ID,
    project_ID,
    validFrom: { "<=": refDate },
    validTo: { ">=": refDate },
  });

  if (assignment?.customRate !== null && assignment?.customRate !== undefined)
    return assignment.customRate;

  const employee = await SELECT.one.from(Employees).where({ ID: employee_ID });
  if (employee?.category_ID) {
    const category = await SELECT.one.from(Categories).where({
      ID: employee.category_ID,
      validFrom: { "<=": refDate },
      validTo: { ">=": refDate },
    });
    if (category?.rate !== null && category?.rate !== undefined)
      return category.rate;
  }

  return null;
}

module.exports = { resolveRateSnapshot };
