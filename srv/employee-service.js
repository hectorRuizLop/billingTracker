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
    this.after(
      "READ",
      "MyTimeEntries",
      handlers.employee.entities.timeEntries.afterRead,
    );
    this.on(
      "READ",
      "MyProjectSummary",
      handlers.employee.entities.summary.onReadMyProjectSummary,
    );
    this.on(
      "READ",
      "MyMonthlySummary",
      handlers.employee.entities.summary.onReadMyMonthlySummary,
    );
    this.on(
      "getCalendarDays",
      handlers.employee.entities.calendar.onGetCalendarDays,
    );
    this.on(
      "READ",
      "MyNotifications",
      handlers.employee.entities.notifications.onReadMyNotifications,
    );
    this.on(
      "markNotificationRead",
      handlers.employee.entities.notifications.markNotificationRead,
    );
    return super.init();
  }
};
