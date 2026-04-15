"use strict";

const cds = require("@sap/cds");

/**
 * Auto-rellena los campos Month, Year y RateSnapshot antes de crear una entrada de tiempo.
 * - Month y Year se calculan a partir de Date.
 * - RateSnapshot se obtiene de la categoría del empleado si no viene informado.
 * @param {import('@sap/cds').Request} req - Objeto de petición CAP
 */
async function beforeCreate(req) {
  const { Employees, Categories } = cds.entities("my.billing");
  const { employee_ID, date } = req.data;

  if (date) {
    const d = new Date(date);
    req.data.month = d.getUTCMonth() + 1;
    req.data.year = d.getUTCFullYear();
  }

  if (employee_ID && !req.data.rateSnapshot) {
    const employee = await SELECT.one
      .from(Employees)
      .where({ ID: employee_ID });
    if (employee?.category_ID) {
      const category = await SELECT.one
        .from(Categories)
        .where({ ID: employee.category_ID });
      if (category?.rate) req.data.rateSnapshot = category.rate;
    }
  }
}

module.exports = { beforeCreate };
