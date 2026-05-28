"use strict";

const cds = require("@sap/cds");

/**
 * Build calendar days for a given year/month with hour summaries
 * for the authenticated employee.
 */
async function onGetCalendarDays(req) {
  const { year, month } = req.data;
  if (!year || !month) {
    return req.error(400, "Year and month are required");
  }

  // Resolve authenticated employee
  const { Employees, TimeEntries } = cds.entities("my.billing");
  const me = await SELECT.one
    .from(Employees)
    .where({ externalId: req.user.id })
    .columns(["ID"]);

  if (!me) {
    return req.error(403, "Employee not found");
  }

  // Fetch all time entries for this employee in the given month
  const entries = await SELECT.from(TimeEntries).where({
    employee_ID: me.ID,
    year: year,
    month: month,
  }).columns(["date", "hours"]);

  // Aggregate hours per date
  const hoursByDate = {};
  for (const entry of entries) {
    const d = entry.date;
    if (!hoursByDate[d]) {
      hoursByDate[d] = 0;
    }
    hoursByDate[d] += Number(entry.hours);
  }

  // Build every day of the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const result = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dateObj = new Date(dateStr + "T00:00:00.000Z");
    const dayOfWeek = dateObj.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const totalHours = hoursByDate[dateStr] || 0;

    result.push({
      date: dateStr,
      totalHours: totalHours,
      hasEntries: totalHours > 0,
      dayType: isWeekend ? "weekend" : "weekday",
    });
  }

  return result;
}

module.exports = { onGetCalendarDays };
