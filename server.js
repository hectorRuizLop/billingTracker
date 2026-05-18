"use strict";

const cds = require("@sap/cds");

module.exports = async function server(o) {
  const app = await cds.server(o);

  cds.on("served", () => {
    if (process.env.NODE_ENV !== "test" && process.env.RUN_BACKGROUND_JOBS === "true") {
      // Start the transactional outbox processor as a plain background task.
      // Do not wrap the endless loop in cds.spawn(): cds.spawn opens a CAP
      // transaction context, and an endless callback can keep the SQLite pool's
      // single connection busy forever in local development.
      // This decouples email delivery from HTTP requests and guarantees
      // that emails are retried independently of job execution.
      const { OutboxProcessor } = require("./srv/handlers/shared/outbox-processor");
      const outboxProcessor = new OutboxProcessor();
      outboxProcessor.start().catch((err) => {
        cds.log("outbox-processor").error("Outbox processor stopped unexpectedly:", err);
      });

      // Schedule jobs using node-cron. In a multi-instance deployment,
      // distributed locking inside each job.run() ensures only one
      // instance actually executes the business logic.
      const { PendingHoursReminder } = require("./srv/jobs/pending-hours-reminder");
      const pendingReminder = new PendingHoursReminder();
      pendingReminder.start();

      const { EmployeeDraftReminder } = require("./srv/jobs/employee-draft-reminder");
      const draftReminder = new EmployeeDraftReminder();
      draftReminder.start();

      const { MonthlyInvoiceJob } = require("./srv/jobs/monthly-invoice");
      const monthlyInvoice = new MonthlyInvoiceJob();
      monthlyInvoice.start();
    }
  });

  return app;
};
