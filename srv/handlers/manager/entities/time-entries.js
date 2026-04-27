"use strict";

const { resolveRateSnapshot } = require("../../shared/resolve-rate-snapshot");

async function beforeCreate(req) {
  // Reject any client-injected rate snapshot to prevent rate manipulation.
  delete req.data.rateSnapshot;
  // Security: prevent injecting status or billing fields on creation
  delete req.data.status;
  delete req.data.billingStatus;
  delete req.data.reviewedAt;
  delete req.data.reviewedBy;
  delete req.data.rejectionNote;

  const { employee_ID, project_ID, date } = req.data;

  if (date) {
    const d = new Date(date);
    req.data.month = d.getUTCMonth() + 1;
    req.data.year = d.getUTCFullYear();
  }

  if (employee_ID && project_ID) {
    req.data.rateSnapshot = await resolveRateSnapshot(
      employee_ID,
      project_ID,
      date,
    );
  }
}

module.exports = { beforeCreate };
