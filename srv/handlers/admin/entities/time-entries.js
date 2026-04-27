"use strict";

const {
  validateCreate,
  validateUpdate,
} = require("../../shared/time-entry-policy");

async function beforeCreate(req) {
  return validateCreate(req);
}

async function beforeUpdate(req) {
  // Prevent direct mutation of calculated fields
  delete req.data.billingStatus;
  delete req.data.reviewedAt;
  delete req.data.reviewedBy;
  delete req.data.rejectionNote;
  delete req.data.month;
  delete req.data.year;
  return validateUpdate(req, "TimeEntries");
}

module.exports = { beforeCreate, beforeUpdate };
