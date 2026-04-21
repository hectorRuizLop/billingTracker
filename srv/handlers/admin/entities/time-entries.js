"use strict";

const {
  validateCreate,
  validateUpdate,
} = require("../../shared/time-entry-policy");

async function beforeCreate(req) {
  return validateCreate(req);
}

async function beforeUpdate(req) {
  return validateUpdate(req, "TimeEntries");
}

module.exports = { beforeCreate, beforeUpdate };
