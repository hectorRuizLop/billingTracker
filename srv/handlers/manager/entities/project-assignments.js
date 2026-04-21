"use strict";

const cds = require("@sap/cds");

/**
 * Validates a ProjectAssignment before it's created or updated.
 * Checks if the employee exists and is active
 * Prevents duplicate assignments for the same project
 * Allows custom rates natively
 */
async function beforeProjectAssignment(req) {
  const { employee_ID, project_ID } = req.data;

  // We only run these validations if employee_ID and project_ID are provided.
  if (req.event === "CREATE") {
    if (!employee_ID || !project_ID) {
      return req.error(400, "employee_ID and project_ID are required.");
    }
  }

  const { Employees, ProjectAssignments } = cds.entities("my.billing");

  if (employee_ID) {
    const employee = await SELECT.one
      .from(Employees)
      .where({ ID: employee_ID });

    if (!employee) {
      return req.error(400, "Employee does not exist.");
    }

    if (!employee.isActive) {
      return req.error(400, "Cannot assign an inactive employee.");
    }
  }

  // Check for duplicate assignments
  if (req.event === "CREATE") {
    const existingAssignment = await SELECT.one.from(ProjectAssignments).where({
      employee_ID,
      project_ID,
    });

    if (existingAssignment) {
      return req.error(400, "Employee is already assigned to this project.");
    }
  }
}

module.exports = {
  beforeCreate: beforeProjectAssignment,
  beforeUpdate: beforeProjectAssignment,
};
