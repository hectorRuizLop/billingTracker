"use strict";

const cds = require("@sap/cds");

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
  const { TimeEntries } = cds.entities("my.billing");

  const entry = await SELECT.one.from(TimeEntries).where({ ID: timeEntryId });
  if (!entry) {
    return req.error(404, `Time entry not found.`);
  }

  if (!rejectionNote || rejectionNote.trim().length <= 10) {
    return req.error(
      400,
      "Must require a mandatory justification text of more than 10 characters.",
    );
  }

  await UPDATE(TimeEntries)
    .set({ status: "R", rejectionNote: rejectionNote })
    .where({ ID: timeEntryId });

  return `Time entry ${timeEntryId} rejected successfully.`;
}

module.exports = {
  approveTimeEntry,
  rejectTimeEntry,
};
