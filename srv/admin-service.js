"use strict";

const cds = require("@sap/cds");
const handlers = require("./handlers");
const { logSecurityEvent } = require("./handlers/shared/audit-logs");

module.exports = class AdminService extends cds.ApplicationService {
  async init() {
    this.before(
      "CREATE",
      "Clients",
      handlers.admin.entities.clients.beforeCreate,
    );
    this.before(
      "CREATE",
      "TimeEntries",
      handlers.admin.entities.timeEntries.beforeCreate,
    );
    this.before(
      "UPDATE",
      "TimeEntries",
      handlers.admin.entities.timeEntries.beforeUpdate,
    );
    this.before(
      "UPDATE",
      "Projects",
      handlers.admin.entities.projects.beforeUpdate,
    );
    this.before(
      "CREATE",
      "ProjectAssignments",
      handlers.admin.entities.projectAssignments.beforeCreate,
    );
    this.before(
      "UPDATE",
      "ProjectAssignments",
      handlers.admin.entities.projectAssignments.beforeUpdate,
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

      return await cds.tx(async (tx) => {
        const client = await tx.run(
          SELECT.one.from(Clients).where({ ID, isDeleted: false }),
        );
        if (!client) return req.error(404, "Client not found");

        await tx.run(
          UPDATE(Clients)
            .set({ isDeleted: true, deletedAt: new Date(), deletedBy: req.user.id })
            .where({ ID }),
        );

        await logSecurityEvent(req, {
          subject: "Client soft-deleted",
          object: { type: "my.billing.Clients", id: { ID } },
          attributes: [{ name: "isDeleted", old: false, new: true }],
        });

        return req.reply();
      });
    });

    this.on("changeEmployeeRole", handlers.admin.actions.changeEmployeeRole);
    this.on("reactivateClient", handlers.admin.actions.reactivateClient);
    return super.init();
  }
};
