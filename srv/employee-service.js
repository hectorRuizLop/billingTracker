"use strict";

const cds = require("@sap/cds");
const handlers = require("./handlers");

module.exports = class EmployeeService extends cds.ApplicationService {
  async init() {
    this.before(
      "CREATE",
      "MyTimeEntries",
      handlers.employee.entities.timeEntries.beforeCreate,
    );
    this.before(
      "UPDATE",
      "MyTimeEntries",
      handlers.employee.entities.timeEntries.beforeUpdate,
    );
    this.on("submitMonth", handlers.employee.actions.timeEntries.submitMonth);
    return super.init();
  }
};
