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
      "UPDATE",
      "Projects",
      handlers.manager.entities.projects.beforeUpdate,
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
    this.on(
      "approveTimeEntry",
      "TimeEntries",
      handlers.manager.actions.timeEntries.approveTimeEntry,
    );
    this.on(
      "rejectTimeEntry",
      "TimeEntries",
      handlers.manager.actions.timeEntries.rejectTimeEntry,
    );
    this.on(
      "approveTimeEntries",
      handlers.manager.actions.timeEntries.approveTimeEntries,
    );
    this.on(
      "rejectTimeEntries",
      handlers.manager.actions.timeEntries.rejectTimeEntries,
    );
    this.after(
      "READ",
      "Projects",
      handlers.manager.entities.projects.afterRead,
    );
    this.after(
      "READ",
      "TimeEntries",
      handlers.manager.entities.timeEntries.afterRead,
    );

    this.before("UPDATE", "TimeEntries", (req) => {
      // Force state transitions only through custom actions
      return req.error(
        403,
        "Direct updates to TimeEntries are not allowed. Use approveTimeEntry or rejectTimeEntry.",
      );
    });

    return super.init();
  }
};
