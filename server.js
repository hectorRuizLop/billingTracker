"use strict";

const cds = require("@sap/cds");

module.exports = async function server(o) {
  const app = await cds.server(o);

  if (process.env.NODE_ENV !== "test") {
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
