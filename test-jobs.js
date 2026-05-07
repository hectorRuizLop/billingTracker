"use strict";

/**
 * End-to-end test script for cron jobs with real SendPulse credentials.
 *
 * Usage:
 *   export $(grep -v '^#' .env | xargs) && node test-jobs.js
 *
 * Requires .env with:
 *   SENDPULSE_USER_ID=<oauth2-client-id>
 *   SENDPULSE_SECRET=<oauth2-client-secret>
 *   EMAIL_FROM=<verified-sender>
 */

process.env.NODE_ENV = "test";
process.env.TIME_ENTRY_POLICY_TODAY = "2026-04-20";

const cds = require("@sap/cds");
const { EmployeeDraftReminder } = require("./srv/jobs/employee-draft-reminder");
const { PendingHoursReminder } = require("./srv/jobs/pending-hours-reminder");
const { MonthlyInvoiceJob } = require("./srv/jobs/monthly-invoice");

async function test() {
  await cds.load(["./srv", "./db"]);
  await cds.connect.to("db");
  await cds.deploy("./srv");
  await cds.serve("all");

  // Seed March 2026 approved entries so MonthlyInvoiceJob has data to invoice
  const { TimeEntries } = cds.entities("my.billing");
  await cds.run(
    INSERT.into(TimeEntries).entries([
      {
        ID: "70000000-0000-0000-0000-000000000001",
        employee_ID: "20000000-0000-0000-0000-000000000001",
        project_ID: "40000000-0000-0000-0000-000000000001",
        date: "2026-03-10",
        year: 2026,
        month: 3,
        hours: 8,
        status: "A",
        billingStatus: "U",
      },
      {
        ID: "70000000-0000-0000-0000-000000000002",
        employee_ID: "20000000-0000-0000-0000-000000000002",
        project_ID: "40000000-0000-0000-0000-000000000001",
        date: "2026-03-11",
        year: 2026,
        month: 3,
        hours: 8,
        status: "A",
        billingStatus: "U",
      },
    ]),
  );

  console.log("=== 1. EmployeeDraftReminder (Apr 25) ===");
  const draftReminder = new EmployeeDraftReminder();
  const draftResult = await draftReminder.run(new Date("2026-04-25"));
  console.log("Result:", draftResult);

  console.log("\n=== 2. PendingHoursReminder (May 1) ===");
  const pendingReminder = new PendingHoursReminder();
  const pendingResult = await pendingReminder.run(new Date("2026-05-01"));
  console.log("Result:", pendingResult);

  console.log("\n=== 3. MonthlyInvoiceJob (Apr 2) ===");
  const invoiceJob = new MonthlyInvoiceJob();
  const invoiceResult = await invoiceJob.run(new Date("2026-04-02"));
  console.log("Result:", invoiceResult);

  console.log("\n=== Database State ===");
  const notifications = await cds.run(SELECT.from("my.billing.Notifications"));
  console.log("Notifications:", notifications.length, "rows");
  for (const n of notifications) {
    console.log(
      `  - ${n.type} | recipient:${n.recipient_ID || "-"} | client:${n.client_ID || "-"} | status:${n.status}`,
    );
  }

  const billingPeriods = await cds.run(
    SELECT.from("my.billing.BillingPeriods"),
  );
  console.log("BillingPeriods:", billingPeriods.length, "rows");
  for (const bp of billingPeriods) {
    console.log(
      `  - ${bp.year}/${bp.month} | project:${bp.project_ID} | status:${bp.status} | hours:${bp.totalHours}`,
    );
  }

  const invoices = await cds.run(SELECT.from("my.billing.Invoices"));
  console.log("Invoices:", invoices.length, "rows");
  for (const inv of invoices) {
    console.log(
      `  - ${inv.invoiceNumber} | client:${inv.client_ID} | status:${inv.status} | total:${inv.total}`,
    );
  }

  const invoiceLines = await cds.run(SELECT.from("my.billing.InvoiceLines"));
  console.log("InvoiceLines:", invoiceLines.length, "rows");

  process.exit(0);
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
