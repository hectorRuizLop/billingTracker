"use strict";

const { resolveRateSnapshot } = require("../../shared/resolve-rate-snapshot");

async function beforeCreate(req) {
  const { employee_ID, project_ID, date } = req.data;

  if (date) {
    const d = new Date(date);
    req.data.month = d.getUTCMonth() + 1;
    req.data.year = d.getUTCFullYear();
  }

  if (employee_ID && project_ID && !req.data.rateSnapshot) {
    req.data.rateSnapshot = await resolveRateSnapshot(employee_ID, project_ID);
  }
}

module.exports = { beforeCreate };
