"use strict";

const cds = require("@sap/cds");

async function beforeCreate(req) {
  const { budget } = req.data;

  if (!budget || budget <= 0) {
    return req.error(400, "Project budget must be greater than 0");
  }

  const { Employees, Categories } = cds.entities("my.billing");

  const manager = await SELECT.one
    .from(Employees)
    .where({ externalId: req.user.id });
  let rate = null;
  if (manager?.category_ID) {
    const category = await SELECT.one
      .from(Categories)
      .where({ ID: manager.category_ID });
    rate = category?.rate ?? null;
  }

  req.data.assignments = req.data.assignments ?? [];
  if (manager) {
    req.data.assignments.push({
      employee_ID: manager.ID,
      customRate: rate,
      isActive: true,
    });
  }
}

module.exports = { beforeCreate };
