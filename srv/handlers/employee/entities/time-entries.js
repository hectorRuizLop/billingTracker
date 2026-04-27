"use strict";

const cds = require("@sap/cds");
const {
  validateCreate,
  validateUpdate,
} = require("../../shared/time-entry-policy");

async function beforeCreate(req) {
  const { project_ID, employee_ID } = req.data;

  // Force the entry owner to the authenticated employee
  const { Employees } = cds.entities("my.billing");
  const me = await SELECT.one.from(Employees).where({ externalId: req.user.id }).columns(["ID"]);
  if (me && employee_ID !== me.ID) {
    return req.error(403, "You can only create time entries for yourself.");
  }

  // Ensure the employee is assigned to the target project
  if (project_ID && employee_ID) {
    const { ProjectAssignments } = cds.entities("my.billing");
    const assigned = await SELECT.one.from(ProjectAssignments).where({
      employee_ID,
      project_ID,
      isActive: true,
    });
    if (!assigned) {
      return req.error(400, "You are not assigned to this project.");
    }
  }

  return validateCreate(req);
}

async function beforeUpdate(req) {
  // Ensure the user owns the record before updating
  const { TimeEntries, Employees } = cds.entities("my.billing");
  const id =
    (Array.isArray(req.params) ? req.params[0]?.ID : req.params?.ID) ??
    req.data.ID;
  const current = await SELECT.one.from(TimeEntries).where({ ID: id });
  if (current) {
    const me = await SELECT.one.from(Employees).where({ externalId: req.user.id }).columns(["ID"]);
    if (me && current.employee_ID !== me.ID) {
      return req.error(403, "You can only update your own time entries.");
    }
  }

  return validateUpdate(req, "TimeEntries");
}

module.exports = { beforeCreate, beforeUpdate };
