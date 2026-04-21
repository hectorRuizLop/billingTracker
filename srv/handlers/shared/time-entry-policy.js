"use strict";

const cds = require("@sap/cds");
const { resolveRateSnapshot } = require("./resolve-rate-snapshot");

function getTodayUtc() {
  const override = process.env.TIME_ENTRY_POLICY_TODAY;
  const source = override ? new Date(`${override}T00:00:00.000Z`) : new Date();
  return new Date(
    Date.UTC(
      source.getUTCFullYear(),
      source.getUTCMonth(),
      source.getUTCDate(),
    ),
  );
}

function validateDate(date) {
  const entryDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(entryDate.getTime())) {
    return "Time entries must use a valid date";
  }

  const day = entryDate.getUTCDay();
  if (day === 0 || day === 6) {
    return "Time entries cannot be logged on weekends";
  }

  const todayUtc = getTodayUtc();
  if (entryDate > todayUtc) {
    return "Time entries cannot have future dates";
  }

  if (
    entryDate.getUTCFullYear() !== todayUtc.getUTCFullYear() ||
    entryDate.getUTCMonth() !== todayUtc.getUTCMonth()
  ) {
    return "Time can only be logged in the current month";
  }

  return null;
}

function applyMonthAndYear(data, date) {
  const entryDate = new Date(`${date}T00:00:00.000Z`);
  data.month = entryDate.getUTCMonth() + 1;
  data.year = entryDate.getUTCFullYear();
}

async function ensureProjectIsOpen(projectId) {
  const { Projects } = cds.entities("my.billing");
  const project = await SELECT.one.from(Projects).where({ ID: projectId });

  if (project?.status !== "O") {
    return "Hours can only be logged on open projects";
  }

  return null;
}

async function ensureRateSnapshot(data, current = {}) {
  const employeeId = data.employee_ID ?? current.employee_ID;
  const projectId = data.project_ID ?? current.project_ID;
  if (!employeeId || !projectId || data.rateSnapshot) return;

  data.rateSnapshot = await resolveRateSnapshot(employeeId, projectId);
}

function rejectIfStatusIsNotDraft(req, status, message) {
  if (status && status !== "D") {
    req.error(400, message);
    return true;
  }

  return false;
}

async function validateCreate(req) {
  const { date, project_ID } = req.data;

  if (
    rejectIfStatusIsNotDraft(
      req,
      req.data.status,
      "Time entries can only be created in Draft status",
    )
  ) {
    return;
  }

  if (date) {
    const dateError = validateDate(date);
    if (dateError) return req.error(400, dateError);
    applyMonthAndYear(req.data, date);
  }

  if (project_ID) {
    const projectError = await ensureProjectIsOpen(project_ID);
    if (projectError) return req.error(400, projectError);
  }

  await ensureRateSnapshot(req.data);
}

async function validateUpdate(req, entityName) {
  const { [entityName]: TimeEntries } = cds.entities("my.billing");
  const id = req.params?.[0]?.ID ?? req.data.ID;
  const current = await SELECT.one.from(TimeEntries).where({ ID: id });

  if (!current) return req.error(404, "Time entry not found");

  if (current.status !== "D") {
    return req.error(
      400,
      "Time entries can only be modified when in Draft status",
    );
  }

  if (
    rejectIfStatusIsNotDraft(
      req,
      req.data.status,
      "Time entries can only be updated in Draft status",
    )
  ) {
    return;
  }

  if (req.data.date) {
    const dateError = validateDate(req.data.date);
    if (dateError) return req.error(400, dateError);
    applyMonthAndYear(req.data, req.data.date);
  }

  if (req.data.project_ID) {
    const projectError = await ensureProjectIsOpen(req.data.project_ID);
    if (projectError) return req.error(400, projectError);
  }

  await ensureRateSnapshot(req.data, current);
}

module.exports = {
  validateCreate,
  validateUpdate,
};
