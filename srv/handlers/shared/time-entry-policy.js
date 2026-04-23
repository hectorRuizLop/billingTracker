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

async function ensureMonthIsOpen(employeeId, month, year) {
  if (!employeeId || !month || !year) return null;

  const { TimeEntries } = cds.entities("my.billing");
  const lockedEntry = await SELECT.one.from(TimeEntries).where({
    employee_ID: employeeId,
    month,
    year,
    status: { in: ["S", "A"] },
  });

  if (lockedEntry) {
    return "Cannot create time entries for a month that already has submitted or approved records";
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

function validateHoursIncrement(hours) {
  if (hours !== undefined && hours !== null) {
    if ((Number(hours) * 100) % 25 !== 0) {
      return "Hours must be entered in quarter-hour increments (multiples of 0.25)";
    }
  }
  return null;
}

async function validateDailyLimit(
  employeeId,
  date,
  hoursToAdd,
  currentEntryId = null,
) {
  if (!employeeId || !date || hoursToAdd === undefined || hoursToAdd === null)
    return null;

  const { TimeEntries } = cds.entities("my.billing");

  const query = SELECT.one
    .columns("sum(hours) as total")
    .from(TimeEntries)
    .where({
      employee_ID: employeeId,
      date: date,
    });

  if (currentEntryId) {
    query.and({ ID: { "!=": currentEntryId } });
  }

  const result = await query;
  const currentTotal = result?.total || 0;

  if (Number(currentTotal) + Number(hoursToAdd) > 8) {
    return "Cannot log more than 8 hours on the same day";
  }

  return null;
}

async function validateCreate(req) {
  const { date, project_ID, hours, employee_ID } = req.data;

  if (
    rejectIfStatusIsNotDraft(
      req,
      req.data.status,
      "Time entries can only be created in Draft status",
    )
  ) {
    return;
  }

  const hoursError = validateHoursIncrement(hours);
  if (hoursError) return req.error(400, hoursError);

  if (date) {
    const dateError = validateDate(date);
    if (dateError) return req.error(400, dateError);
    applyMonthAndYear(req.data, date);
  }

  const monthLockError = await ensureMonthIsOpen(
    employee_ID,
    req.data.month,
    req.data.year,
  );
  if (monthLockError) return req.error(400, monthLockError);

  if (date && employee_ID && hours !== undefined) {
    const dailyLimitError = await validateDailyLimit(employee_ID, date, hours);
    if (dailyLimitError) return req.error(400, dailyLimitError);
  }

  if (project_ID) {
    const projectError = await ensureProjectIsOpen(project_ID);
    if (projectError) return req.error(400, projectError);
  }

  await ensureRateSnapshot(req.data);
}

async function validateUpdate(req, entityName) {
  const { [entityName]: TimeEntries } = cds.entities("my.billing");
  // Check if req.params is an array or object to get the ID properly depending on how CAP is calling it
  const id =
    (Array.isArray(req.params) ? req.params[0]?.ID : req.params?.ID) ??
    req.data.ID;
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

  const newHours =
    req.data.hours !== undefined ? req.data.hours : current.hours;
  const hoursError = validateHoursIncrement(newHours);
  if (hoursError) return req.error(400, hoursError);

  const newDate = req.data.date !== undefined ? req.data.date : current.date;
  const newEmployeeId =
    req.data.employee_ID !== undefined
      ? req.data.employee_ID
      : current.employee_ID;

  if (req.data.date) {
    const dateError = validateDate(newDate);
    if (dateError) return req.error(400, dateError);
    applyMonthAndYear(req.data, newDate);
  }

  const dailyLimitError = await validateDailyLimit(
    newEmployeeId,
    newDate,
    newHours,
    id,
  );
  if (dailyLimitError) return req.error(400, dailyLimitError);

  if (req.data.project_ID) {
    const projectError = await ensureProjectIsOpen(req.data.project_ID);
    if (projectError) return req.error(400, projectError);
  }

  await ensureRateSnapshot(req.data, current);
}

module.exports = {
  ensureMonthIsOpen,
  validateCreate,
  validateUpdate,
};
