"use strict";

const cds = require("@sap/cds");
const cron = require("node-cron");
const { acquireLock, releaseLock } = require("../handlers/shared/job-lock");

/**
 * MonthlyInvoiceJob generates invoice records in Draft status and
 * writes the corresponding email payloads to the transactional outbox.
 *
 * The OutboxProcessor handles actual email delivery and promotes
 * invoices from Draft to Sent, guaranteeing consistency even if the
 * container restarts or the SendPulse API is temporarily unavailable.
 */
class MonthlyInvoiceJob {
  constructor(options = {}) {
    this._cronExpression = options.cronExpression || "0 9 2 * *";
    this._jobName = options.jobName || "MonthlyInvoiceJob";
  }

  async run(now = new Date()) {
    const instanceId = `${this._jobName}-${process.pid}-${Date.now()}`;
    const hasLock = await acquireLock(this._jobName, instanceId, 60);
    if (!hasLock) {
      cds.log("monthly-invoice").info("Job already running on another instance — skipping.");
      return { created: 0, clients: [] };
    }

    try {
      return await this._execute(now);
    } finally {
      await releaseLock(this._jobName);
    }
  }

  async _execute(now = new Date()) {
    const { year, month } = this._getPreviousMonth(now);
    const log = cds.log("monthly-invoice");
    const createdClients = [];

    // Retry sending draft invoices first
    const retried = await this._retryDraftInvoices(year, month, now, log);
    createdClients.push(...retried);

    // Create new invoices for eligible clients
    const newlyCreated = await this._createNewInvoices(year, month, now, log);
    createdClients.push(...newlyCreated);

    return { created: createdClients.length, clients: createdClients };
  }

  _getPreviousMonth(now = new Date()) {
    let year = now.getFullYear();
    let month = now.getMonth();
    if (month === 0) {
      month = 12;
      year--;
    }
    return { year, month };
  }

  _buildInvoiceNumber(clientId, year, month) {
    return `INV-${clientId.substring(0, 8)}-${year}${String(month).padStart(2, "0")}`;
  }

  async _retryDraftInvoices(year, month, now, log) {
    const {
      Invoices,
      InvoiceLines,
      TimeEntries,
      Projects,
      Clients,
      EmailOutbox,
    } = cds.entities("my.billing");
    const createdClients = [];

    const invoiceNumberPattern = `%-${year}${String(month).padStart(2, "0")}`;
    const draftInvoices = await SELECT.from(Invoices)
      .where({
        status: "D",
        invoiceNumber: { like: invoiceNumberPattern },
      })
      .columns("ID", "client_ID", "invoiceNumber", "subtotal", "total");

    if (draftInvoices.length === 0) {
      return createdClients;
    }

    const invoiceIds = draftInvoices.map((i) => i.ID);
    const lines = await SELECT.from(InvoiceLines)
      .where({ invoice_ID: { in: invoiceIds } })
      .columns(
        "invoice_ID",
        "timeEntry_ID",
        "hours",
        "rateSnapshot",
        "amount",
        "description",
      );

    const entryIds = [...new Set(lines.map((l) => l.timeEntry_ID))];
    const entries = await SELECT.from(TimeEntries)
      .where({ ID: { in: entryIds } })
      .columns("ID", "project_ID", "hours", "rateSnapshot", "description");

    const projectIds = [...new Set(entries.map((e) => e.project_ID))];
    const projects = await SELECT.from(Projects)
      .where({ ID: { in: projectIds } })
      .columns("ID", "name", "client_ID");

    const clientIds = [...new Set(draftInvoices.map((i) => i.client_ID))];
    const clients = await SELECT.from(Clients)
      .where({ ID: { in: clientIds }, isDeleted: false })
      .columns("ID", "name", "email");

    const clientMap = {};
    for (const c of clients) clientMap[c.ID] = c;

    const projectMap = {};
    for (const p of projects) projectMap[p.ID] = p;

    const invoiceProjects = {};
    for (const line of lines) {
      const entry = entries.find((e) => e.ID === line.timeEntry_ID);
      if (!entry) continue;
      const project = projectMap[entry.project_ID];
      if (!project) continue;
      if (!invoiceProjects[line.invoice_ID]) {
        invoiceProjects[line.invoice_ID] = {};
      }
      if (!invoiceProjects[line.invoice_ID][project.ID]) {
        invoiceProjects[line.invoice_ID][project.ID] = {
          projectId: project.ID,
          name: project.name,
          totalHours: 0,
          totalCost: 0,
        };
      }
      const hours = parseFloat(entry.hours);
      const rate = parseFloat(entry.rateSnapshot || 0);
      invoiceProjects[line.invoice_ID][project.ID].totalHours += hours;
      invoiceProjects[line.invoice_ID][project.ID].totalCost += hours * rate;
    }

    for (const invoice of draftInvoices) {
      const client = clientMap[invoice.client_ID];
      if (!client || !client.email) continue;

      const projectsData = Object.values(invoiceProjects[invoice.ID] || {});
      let overallHours = 0;
      let overallCost = 0;

      const projectLines = projectsData
        .map((p) => {
          overallHours += p.totalHours;
          overallCost += p.totalCost;
          return `- ${p.name}\n  Hours: ${p.totalHours.toFixed(2)}h\n  Cost: €${p.totalCost.toFixed(2)}`;
        })
        .join("\n\n");

      const subject = `Monthly Invoice Summary - ${month}/${year}`;
      const text =
        `Dear ${client.name},\n\n` +
        `Please find below your monthly invoice summary for ${month}/${year}:\n\n` +
        `${projectLines}\n\n` +
        `Overall Total:\n` +
        `  Hours: ${overallHours.toFixed(2)}h\n` +
        `  Cost: €${overallCost.toFixed(2)}\n\n` +
        `Best regards,\nBilling Tracker`;

      const retryEntryIds = lines
        .filter((l) => l.invoice_ID === invoice.ID)
        .map((l) => l.timeEntry_ID);

      try {
        await cds.tx(async (tx) => {
          await tx.run(
            INSERT.into(EmailOutbox).entries({
              ID: cds.utils.uuid(),
              to: client.email,
              from: process.env.EMAIL_FROM || "noreply@nubexx.com",
              subject,
              text,
              status: "P",
              attempts: 0,
              maxAttempts: 3,
              referenceId: invoice.ID,
              referenceType: "InvoiceRetry",
              client_ID: client.ID,
              payload: JSON.stringify({
                entryIds: retryEntryIds,
                projectsData,
                year,
                month,
              }),
            }),
          );
        });

        createdClients.push(client.email);
      } catch (err) {
        log.error(
          `Failed to queue retry for invoice ${invoice.invoiceNumber} (${client.email}):`,
          err,
        );
      }
    }

    return createdClients;
  }

  async _createNewInvoices(year, month, now, log) {
    const {
      TimeEntries,
      Projects,
      Clients,
      Invoices,
      InvoiceLines,
      EmailOutbox,
    } = cds.entities("my.billing");
    const createdClients = [];

    // Projects with entries unbilled
    const entryProjects = await SELECT.distinct
      .from(TimeEntries)
      .where({
        year,
        month,
        billingStatus: { in: ["U", "B"] },
      })
      .columns("project_ID");

    if (entryProjects.length === 0) return createdClients;

    const projectIds = entryProjects.map((e) => e.project_ID);

    const projects = await SELECT.from(Projects)
      .where({ ID: { in: projectIds } })
      .columns("ID", "name", "status", "client_ID");

    // Bulk query of pendings
    const pendingEntries = await SELECT.from(TimeEntries)
      .where({
        project_ID: { in: projectIds },
        year,
        month,
        status: { in: ["D", "S"] },
      })
      .columns("project_ID");

    const projectsWithPending = new Set(
      pendingEntries.map((e) => e.project_ID),
    );

    const eligibleProjectIds = new Set();
    for (const project of projects) {
      if (project.status === "C" || !projectsWithPending.has(project.ID)) {
        eligibleProjectIds.add(project.ID);
      }
    }

    if (eligibleProjectIds.size === 0) return createdClients;

    // Eligible projects grouped by client
    const clientAllProjects = {};
    for (const project of projects) {
      const clientId = project.client_ID;
      if (!clientAllProjects[clientId]) {
        clientAllProjects[clientId] = [];
      }
      clientAllProjects[clientId].push(project);
    }

    const eligibleClientIds = [];
    const eligibleClientProjectIds = [];
    for (const [clientId, clientProjects] of Object.entries(
      clientAllProjects,
    )) {
      const allEligible = clientProjects.every((p) =>
        eligibleProjectIds.has(p.ID),
      );
      if (allEligible) {
        eligibleClientIds.push(clientId);
        for (const p of clientProjects) {
          eligibleClientProjectIds.push(p.ID);
        }
      }
    }

    if (eligibleClientIds.length === 0) return createdClients;

    // Clients that already have an invoice excluded
    const existingInvoices = await SELECT.from(Invoices)
      .where({
        client_ID: { in: eligibleClientIds },
        invoiceNumber: {
          like: `%-${year}${String(month).padStart(2, "0")}`,
        },
      })
      .columns("client_ID", "invoiceNumber");

    const clientsWithInvoice = new Set(
      existingInvoices.map((i) => i.client_ID),
    );

    const newEligibleClientIds = eligibleClientIds.filter(
      (id) => !clientsWithInvoice.has(id),
    );

    if (newEligibleClientIds.length === 0) return createdClients;

    // Approved entries
    const newEligibleProjectIds = projects
      .filter(
        (p) =>
          eligibleProjectIds.has(p.ID) &&
          newEligibleClientIds.includes(p.client_ID),
      )
      .map((p) => p.ID);

    const approvedEntries = await SELECT.from(TimeEntries)
      .where({
        project_ID: { in: newEligibleProjectIds },
        year,
        month,
        status: "A",
        billingStatus: { in: ["U", "B"] },
      })
      .columns("ID", "hours", "rateSnapshot", "project_ID", "description");

    const clients = await SELECT.from(Clients)
      .where({ ID: { in: newEligibleClientIds }, isDeleted: false })
      .columns("ID", "name", "email");

    if (clients.length === 0) return createdClients;

    const projectMap = {};
    for (const p of projects) projectMap[p.ID] = p;

    const clientMap = {};
    for (const c of clients) clientMap[c.ID] = c;

    // Group by client/project
    const clientProjectsData = {};
    for (const entry of approvedEntries) {
      const project = projectMap[entry.project_ID];
      if (!project) continue;
      const clientId = project.client_ID;
      if (!clientProjectsData[clientId]) {
        clientProjectsData[clientId] = {};
      }
      if (!clientProjectsData[clientId][project.ID]) {
        clientProjectsData[clientId][project.ID] = {
          projectId: project.ID,
          name: project.name,
          entries: [],
          totalHours: 0,
          totalCost: 0,
        };
      }
      const hours = parseFloat(entry.hours);
      const rate = parseFloat(entry.rateSnapshot || 0);
      const cost = hours * rate;
      clientProjectsData[clientId][project.ID].entries.push(entry);
      clientProjectsData[clientId][project.ID].totalHours += hours;
      clientProjectsData[clientId][project.ID].totalCost += cost;
    }

    // Ensure all eligible projects appear (even with zero approved entries)
    for (const projectId of newEligibleProjectIds) {
      const project = projectMap[projectId];
      if (!project) continue;
      const clientId = project.client_ID;
      if (!clientProjectsData[clientId]) {
        clientProjectsData[clientId] = {};
      }
      if (!clientProjectsData[clientId][project.ID]) {
        clientProjectsData[clientId][project.ID] = {
          projectId: project.ID,
          name: project.name,
          entries: [],
          totalHours: 0,
          totalCost: 0,
        };
      }
    }

    for (const clientId of Object.keys(clientProjectsData)) {
      const client = clientMap[clientId];
      if (!client || !client.email) continue;

      const projectsData = Object.values(clientProjectsData[clientId]);
      let overallHours = 0;
      let overallCost = 0;

      const projectLines = projectsData
        .map((p) => {
          overallHours += p.totalHours;
          overallCost += p.totalCost;
          return `- ${p.name}\n  Hours: ${p.totalHours.toFixed(2)}h\n  Cost: €${p.totalCost.toFixed(2)}`;
        })
        .join("\n\n");

      const subject = `Monthly Invoice Summary - ${month}/${year}`;
      const text =
        `${client.name},\n\n` +
        `Find below your monthly invoice summary for ${month}/${year}:\n\n` +
        `${projectLines}\n\n` +
        `Overall Total:\n` +
        `  Hours: ${overallHours.toFixed(2)}h\n` +
        `  Cost: €${overallCost.toFixed(2)}\n\n` +
        `Billing Tracker`;

      try {
        const invoiceId = cds.utils.uuid();
        const today = now.toISOString().split("T")[0];
        const invoiceNumber = this._buildInvoiceNumber(clientId, year, month);

        const entryIds = [];
        const invoiceLines = [];
        for (const p of projectsData) {
          for (const entry of p.entries) {
            entryIds.push(entry.ID);
            const hours = parseFloat(entry.hours);
            const rate = parseFloat(entry.rateSnapshot || 0);
            invoiceLines.push({
              ID: cds.utils.uuid(),
              invoice_ID: invoiceId,
              timeEntry_ID: entry.ID,
              description: entry.description || `${p.name} - ${month}/${year}`,
              hours: entry.hours,
              rateSnapshot: entry.rateSnapshot,
              amount: hours * rate,
            });
          }
        }

        // Single atomic transaction: create invoice, lines, update entries, queue email
        await cds.tx(async (tx) => {
          await tx.run(
            INSERT.into(Invoices).entries({
              ID: invoiceId,
              invoiceNumber,
              issueDate: today,
              status: "D",
              currency: "EUR",
              subtotal: overallCost,
              total: overallCost,
              client_ID: clientId,
            }),
          );

          if (invoiceLines.length > 0) {
            await tx.run(INSERT.into(InvoiceLines).entries(invoiceLines));
          }

          if (entryIds.length > 0) {
            await tx.run(
              UPDATE(TimeEntries)
                .set({ billingStatus: "B" })
                .where({ ID: { in: entryIds } }),
            );
          }

          await tx.run(
            INSERT.into(EmailOutbox).entries({
              ID: cds.utils.uuid(),
              to: client.email,
              from: process.env.EMAIL_FROM || "noreply@nubexx.com",
              subject,
              text,
              status: "P",
              attempts: 0,
              maxAttempts: 3,
              referenceId: invoiceId,
              referenceType: "InvoiceNew",
              client_ID: client.ID,
              payload: JSON.stringify({
                entryIds,
                projectsData: projectsData.map((p) => ({
                  projectId: p.projectId,
                  totalHours: p.totalHours,
                  totalCost: p.totalCost,
                })),
                year,
                month,
              }),
            }),
          );
        });

        createdClients.push(client.email);
      } catch (err) {
        log.error(
          `Failed to create invoice for ${client.email}. ` +
            `Invoice remains in Draft for retry.`,
          err,
        );
      }
    }

    return createdClients;
  }

  start() {
    cron.schedule(this._cronExpression, () => {
      this.run().catch((err) => {
        cds.log("monthly-invoice").error(err);
      });
    });
  }
}

module.exports = { MonthlyInvoiceJob };
