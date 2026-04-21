"use strict";

const cds = require("@sap/cds");
const handlers = require("./handlers");

module.exports = class ManagerService extends cds.ApplicationService {
  async init() {
    this.before(
      "CREATE",
      "Projects",
      handlers.manager.entities.projects.beforeCreate,
    );
    this.before(
      "CREATE",
      "TimeEntries",
      handlers.manager.entities.timeEntries.beforeCreate,
    );
    this.before(
      "CREATE",
      "ProjectAssignments",
      handlers.manager.entities.projectAssignments.beforeCreate,
    );
    this.before(
      "UPDATE",
      "ProjectAssignments",
      handlers.manager.entities.projectAssignments.beforeUpdate,
    );
    return super.init();
  }
};
