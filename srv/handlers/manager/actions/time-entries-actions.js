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
  const { TimeEntries } = cds.entities("my.billing");

  const entries = await SELECT.from(TimeEntries).where({ ID: { in: uniqueIds } });

  if (entries.length !== uniqueIds.length) {
    return req.error(404, "One or more time entries were not found.");
  }

  const notSubmitted = entries.filter((e) => e.status !== "S");
  if (notSubmitted.length > 0) {
    return req.error(
      400,
      "Only valid if the entries are in Submitted status.",
    );
  }

  await UPDATE(TimeEntries)
    .set({ status: "R", rejectionNote })
    .where({ ID: { in: uniqueIds } });

  return uniqueIds.length;
}

async function approveTimeEntry(req) {
  const { timeEntryId } = req.data;
  const { TimeEntries } = cds.entities("my.billing");

  const entry = await SELECT.one.from(TimeEntries).where({ ID: timeEntryId });
  if (!entry) {
    return req.error(404, `Time entry not found.`);
  }

  if (entry.status !== "S") {
    return req.error(400, "Only valid if the entry was in Submitted status.");
  }

  await UPDATE(TimeEntries).set({ status: "A" }).where({ ID: timeEntryId });

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
