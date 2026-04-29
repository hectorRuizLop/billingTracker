"use strict";

const cds = require("@sap/cds");

function validateRejectionNote(req, rejectionNote) {
  if (!rejectionNote || rejectionNote.trim().length <= 10) {
    req.error(
      400,
      "Must require a mandatory justification text of more than 10 characters.",
    );
    return false;
  }

  return true;
}

async function rejectEntries(req, timeEntryIds, rejectionNote) {
  if (!validateRejectionNote(req, rejectionNote)) return;

  if (!Array.isArray(timeEntryIds) || timeEntryIds.length === 0) {
    return req.error(400, "At least one time entry ID is required.");
  }

  const uniqueIds = [...new Set(timeEntryIds)];
  const { TimeEntries, Projects } = cds.entities("my.billing");

  const entries = await SELECT.from(TimeEntries).where({
    ID: { in: uniqueIds },
  });

  if (entries.length !== uniqueIds.length) {
    return req.error(404, "One or more time entries were not found.");
  }

  // RBAC: verify all entries belong to projects managed by the current user
  const projectIds = [...new Set(entries.map((e) => e.project_ID))];
  const managedProjects = await SELECT.from(Projects)
    .where({ ID: { in: projectIds }, "manager.externalId": req.user.id })
    .columns(["ID"]);
  const managedIds = new Set(managedProjects.map((p) => p.ID));
  const foreignEntries = entries.filter((e) => !managedIds.has(e.project_ID));
  if (foreignEntries.length > 0) {
    return req.error(
      403,
      "You can only reject time entries for projects you manage.",
    );
  }

  const notSubmitted = entries.filter((e) => e.status !== "S");
  if (notSubmitted.length > 0) {
    return req.error(400, "Only valid if the entries are in Submitted status.");
  }

  const now = new Date().toISOString();
  const reviewer = req.user?.id ?? "system";

  await UPDATE(TimeEntries)
    .set({ status: "R", rejectionNote, reviewedAt: now, reviewedBy: reviewer })
    .where({ ID: { in: uniqueIds } });

  return uniqueIds.length;
}

async function approveTimeEntry(req) {
  const { timeEntryId } = req.data;
  const { TimeEntries, Projects } = cds.entities("my.billing");

  const entry = await SELECT.one.from(TimeEntries).where({ ID: timeEntryId });
  if (!entry) {
    return req.error(404, `Time entry not found.`);
  }

  // RBAC: verify the entry belongs to a project managed by the current user
  const project = await SELECT.one.from(Projects).where({
    ID: entry.project_ID,
    "manager.externalId": req.user.id,
  });
  if (!project) {
    return req.error(
      403,
      "You can only approve time entries for projects you manage.",
    );
  }

  if (entry.status !== "S") {
    return req.error(400, "Only valid if the entry was in Submitted status.");
  }

  const now = new Date().toISOString();
  const reviewer = req.user?.id ?? "system";

  await UPDATE(TimeEntries)
    .set({
      status: "A",
      billingStatus: "U",
      reviewedAt: now,
      reviewedBy: reviewer,
    })
    .where({ ID: timeEntryId });

  return `Time entry ${timeEntryId} approved successfully.`;
}

async function rejectTimeEntry(req) {
  const { timeEntryId, rejectionNote } = req.data;
  const rejectedCount = await rejectEntries(req, [timeEntryId], rejectionNote);
  if (!rejectedCount) return;

  return `Time entry ${timeEntryId} rejected successfully.`;
}

async function rejectTimeEntries(req) {
  const { timeEntryIds, rejectionNote } = req.data;
  const rejectedCount = await rejectEntries(req, timeEntryIds, rejectionNote);
  if (!rejectedCount) return;

  return `${rejectedCount} time entries rejected successfully.`;
}

module.exports = {
  approveTimeEntry,
  rejectTimeEntry,
  rejectTimeEntries,
};
