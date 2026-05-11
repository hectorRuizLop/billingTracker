"use strict";

const cds = require("@sap/cds");

module.exports = async function server(o) {
  const app = await cds.server(o);

  if (process.env.NODE_ENV !== "test") {
    // Start transactional outbox processor in a background spawn.
    // This decouples email delivery from HTTP requests and guarantees
    // that emails are retried independently of job execution.
    cds.spawn(async () => {
      const { OutboxProcessor } = require("./srv/handlers/shared/outbox-processor");
      const processor = new OutboxProcessor();
      await processor.start();
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

  return app;
};
