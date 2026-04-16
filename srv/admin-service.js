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

    // Exclude soft-deleted clients from all reads
    this.before("READ", "Clients", (req) => {
      const { SELECT } = req.query;
      const filter = [{ ref: ["isDeleted"] }, "=", { val: false }];
      SELECT.where = SELECT.where
        ? [...SELECT.where, "and", ...filter]
        : filter;
    });

    this.on("DELETE", "Clients", async (req) => {
      const [{ ID }] = req.params;
      const { Clients } = cds.entities("my.billing");

      const client = await SELECT.one
        .from(Clients)
        .where({ ID, isDeleted: false });
      if (!client) return req.error(404, "Client not found");

      await UPDATE(Clients)
        .set({ isDeleted: true, deletedAt: new Date(), deletedBy: req.user.id })
        .where({ ID });

      const audit = await cds.connect.to("audit-log");
      await audit.log("SecurityEvent", {
        user: req.user.id,
        data: {
          subject: "Client soft-deleted",
          object: { type: "my.billing.Clients", id: { ID } },
          attributes: [{ name: "isDeleted", old: false, new: true }],
        },
      });

      return req.reply();
    });

    this.on("changeEmployeeRole", handlers.admin.actions.changeEmployeeRole);
    this.on("reactivateClient", handlers.admin.actions.reactivateClient);
    return super.init();
  }
};
