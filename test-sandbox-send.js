const fs = require("fs");
const path = require("path");
const cds = require("@sap/cds");
const { MonthlyInvoiceJob } = require("./srv/jobs/monthly-invoice");
const { OutboxProcessor } = require("./srv/handlers/shared/outbox-processor");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
loadEnv(path.join(__dirname, ".env"));

process.env.NODE_ENV = "test";

async function test() {
  const emailFrom = process.env.EMAIL_FROM;
  if (!emailFrom) {
    console.error("Error: EMAIL_FROM is not set in .env");
    process.exit(1);
  }

  await cds.load(["./srv", "./db"]);
  await cds.connect.to("db");
  await cds.deploy("./srv");
  await cds.serve("all");

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

  await cds.run(
    UPDATE("my.billing.Clients")
      .set({ email: emailFrom })
      .where({ ID: "30000000-0000-0000-0000-000000000001" }),
  );

  console.log("1. Running invoice job...");
  const job = new MonthlyInvoiceJob();
  const result = await job.run(new Date("2026-04-02"));
  console.log("Job result:", JSON.stringify(result, null, 2));

  console.log("\n2. Processing outbox (sending via SendPulse)...");
  const processor = new OutboxProcessor();
  const sendResult = await processor.processPending();
  console.log("Outbox result:", JSON.stringify(sendResult, null, 2));

  if (sendResult.succeeded > 0) {
    console.log("\n Email enviado correctamente a:", process.env.EMAIL_SANDBOX_RECIPIENTS || "destinatario original");
  } else if (sendResult.failed > 0) {
    console.log("\n El email falló. Revisa las credenciales de SendPulse en .env");
  } else {
    console.log("\nℹ No había emails pendientes en el outbox");
  }

  // Force exit because CDS keeps handles open
  setTimeout(() => process.exit(0), 500);
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
