"use strict";

const cds = require("@sap/cds");
const { resolveRateSnapshot } = require("../../shared/resolve-rate-snapshot");

function validateDate(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  if (day === 0 || day === 6) {
    return "Time entries cannot be logged on weekends";
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (date > todayStr) {
    return "Time entries cannot have future dates";
  }

  const [year, month] = date.split("-").map(Number);
  if (year !== today.getUTCFullYear() || month !== today.getUTCMonth() + 1) {
    return "Time can only be logged in the current month";
  }

  return null;
}

async function beforeCreate(req) {
  const { Projects } = cds.entities("my.billing");
  const { date, project_ID, employee_ID, status } = req.data;

  if (status && status !== "D") {
    return req.error(400, "Time entries can only be created in Draft status");
  }

  if (date) {
    const dateError = validateDate(date);
    if (dateError) return req.error(400, dateError);

    const d = new Date(date);
    req.data.month = d.getUTCMonth() + 1;
    req.data.year = d.getUTCFullYear();
  }

  if (project_ID) {
    const project = await SELECT.one.from(Projects).where({ ID: project_ID });
    if (project?.status !== "O") {
      return req.error(400, "Hours can only be logged on open projects");
    }
  }

  if (employee_ID && project_ID && !req.data.rateSnapshot) {
    req.data.rateSnapshot = await resolveRateSnapshot(employee_ID, project_ID);
  }
}

async function beforeUpdate(req) {
  const { TimeEntries, Projects } = cds.entities("my.billing");

  const id = req.params?.[0]?.ID ?? req.data.ID;
  const current = await SELECT.one.from(TimeEntries).where({ ID: id });

  if (!current) return req.error(404, "Time entry not found");
  if (current.status !== "D") {
    return req.error(
      400,
      "Time entries can only be modified when in Draft status",
    );
  }

  if (req.data.date) {
    const dateError = validateDate(req.data.date);
    if (dateError) return req.error(400, dateError);

    const d = new Date(req.data.date);
    req.data.month = d.getUTCMonth() + 1;
    req.data.year = d.getUTCFullYear();
  }

  if (req.data.project_ID) {
    const project = await SELECT.one
      .from(Projects)
      .where({ ID: req.data.project_ID });
    if (project?.status !== "O") {
      return req.error(400, "Hours can only be logged on open projects");
    }
  }
}

module.exports = { beforeCreate, beforeUpdate };
