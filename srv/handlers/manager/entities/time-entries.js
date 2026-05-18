"use strict";

const cds = require("@sap/cds");
const { resolveRateSnapshot } = require("../../shared/resolve-rate-snapshot");

const STATUS_CRITICALITY = {
  D: 0, // Draft
  S: 2, // Submitted
  A: 3, // Approved
  R: 1, // Rejected
};

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

async function afterRead(results, _req) {
  if (!results) return;
  const entries = Array.isArray(results) ? results : [results];

  // Fetch all unique UUIDs from the reviewedBy property
  const reviewerIds = [
    ...new Set(entries.filter((e) => e.reviewedBy).map((e) => e.reviewedBy)),
  ];
  const reviewerMap = {};

  // Perform a single batch query to Employees to resolve the UUIDs into full names
  if (reviewerIds.length > 0) {
    const { Employees } = cds.entities("my.billing");
    const reviewers = await SELECT.from(Employees).where({
      externalId: { in: reviewerIds },
    });
    for (const r of reviewers) {
      reviewerMap[r.externalId] = `${r.firstName} ${r.lastName}`;
    }
  }

  for (const entry of entries) {
    entry.statusCriticality = STATUS_CRITICALITY[entry.status] ?? 0;
    if (entry.reviewedBy && reviewerMap[entry.reviewedBy]) {
      entry.reviewerName = reviewerMap[entry.reviewedBy];
    } else if (entry.reviewedBy) {
      entry.reviewerName = entry.reviewedBy; // Fallback to ID
    }
  }
}

module.exports = { beforeCreate, afterRead };
