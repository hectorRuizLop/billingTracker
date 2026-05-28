"use strict";

const cds = require("@sap/cds");

async function submitMonth(req) {
  const { year, month } = req.data;

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

  await UPDATE(TimeEntries).set({ status: "S" }).where({
    employee_ID: employee.ID,
    year,
    month,
    status: "D",
  });

  // Notify project managers via Work Zone
  const { Projects, EmailOutbox, Notifications } = cds.entities("my.billing");
  const projectIds = [...new Set(drafts.map((d) => d.project_ID))];
  for (const pid of projectIds) {
    const project = await SELECT.one.from(Projects).where({ ID: pid }).columns(["name", "manager_ID"]);
    if (!project?.manager_ID) continue;

    const manager = await SELECT.one.from("my.billing.Employees").where({ ID: project.manager_ID }).columns(["email"]);
    if (!manager?.email) continue;

    const subject = `Time entries submitted for ${project.name}`;
    const text = `${employee.firstName} ${employee.lastName} has submitted ${drafts.filter((d) => d.project_ID === pid).length} time entr${drafts.filter((d) => d.project_ID === pid).length === 1 ? "y" : "ies"} for ${year}-${String(month).padStart(2, "0")}.`;

    const notificationId = cds.utils.uuid();
    await INSERT.into(Notifications).entries({
      ID: notificationId,
      recipient_ID: project.manager_ID,
      type: "TimeEntrySubmitted",
      subject,
      message: text,
      status: "P",
      channel: "WorkZone",
    });

    await INSERT.into(EmailOutbox).entries({
      ID: cds.utils.uuid(),
      to: manager.email,
      from: "billing-tracker@nubexx.com",
      subject,
      text,
      status: "P",
      channel: "WorkZone",
      referenceType: "WorkZoneNotification",
      referenceId: notificationId,
      recipient_ID: project.manager_ID,
    });
  }

  return `Submitted ${drafts.length} time entr${drafts.length === 1 ? "y" : "ies"} for ${year}-${String(month).padStart(2, "0")}.`;
}

module.exports = {
  submitMonth,
};
