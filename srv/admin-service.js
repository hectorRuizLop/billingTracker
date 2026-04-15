"use strict";

const cds = require("@sap/cds");
const handlers = require("./handlers");

module.exports = class AdminService extends cds.ApplicationService {
  async init() {
    this.before(
      "CREATE",
      "Clients",
      handlers.admin.entities.clients.beforeCreate,
    );
    this.after(
      "CREATE",
      "Clients",
      handlers.admin.entities.clients.afterCreate,
    );
    this.on("changeEmployeeRole", handlers.admin.actions.changeEmployeeRole);
    this.on("reactivateClient", handlers.admin.actions.reactivateClient);
    return super.init();
  }
};
