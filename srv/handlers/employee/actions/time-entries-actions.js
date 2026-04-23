"use strict";

const cds = require("@sap/cds");

async function submitMonth(req) {
  const { year, month } = req.data;

  if (!req.user.is("Employee")) {
    return req.error(403, "Only employees can submit monthly time entries.");
  }

  if (!Number.isInteger(year) || year < 1) {
    return req.error(400, "Year must be a valid positive integer.");
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return req.error(400, "Month must be an integer between 1 and 12.");
  }

  const { Employees, TimeEntries } = cds.entities("my.billing");

  const employee = await SELECT.one
    .from(Employees)
    .where({ externalId: req.user.id });

  if (!employee) {
    return req.error(404, "Employee not found.");
  }

  const drafts = await SELECT.from(TimeEntries).where({
    employee_ID: employee.ID,
    year,
    month,
    status: "D",
  });

  if (!drafts.length) {
    return req.error(
      400,
      `No draft time entries found for ${year}-${String(month).padStart(2, "0")}.`,
    );
  }

  await UPDATE(TimeEntries)
    .set({ status: "S" })
    .where({
      employee_ID: employee.ID,
      year,
      month,
      status: "D",
    });

  return `Submitted ${drafts.length} time entr${drafts.length === 1 ? "y" : "ies"} for ${year}-${String(month).padStart(2, "0")}.`;
}

module.exports = {
  submitMonth,
};
