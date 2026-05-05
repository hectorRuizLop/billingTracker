"use strict";

const cds = require("@sap/cds");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

class MonthlyInvoiceJob {
  constructor(options = {}) {
    this._transporter = options.transporter;
    this._cronExpression = options.cronExpression || "0 9 2 * *";
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

  async run(now = new Date()) {
    const { year, month } = this._getPreviousMonth(now);
    const log = cds.log("monthly-invoice");
    const transporter = this._transporter || this._createTransporter();
    const sentClients = [];

    // Re try sending draft invoices first
    const retried = await this._retryDraftInvoices(
      year,
      month,
      now,
      transporter,
      log,
    );
    sentClients.push(...retried);

    // Create new invoices for eligible clients and send
    const newlySent = await this._createNewInvoices(
      year,
      month,
      now,
      transporter,
      log,
    );
    sentClients.push(...newlySent);

    return { sent: sentClients.length, clients: sentClients };
  }

  async _retryDraftInvoices(year, month, now, transporter, log) {
    const { Invoices, InvoiceLines, TimeEntries, Projects, Clients } =
      cds.entities("my.billing");
    const sentClients = [];

    const invoiceNumberPattern = `%-${year}${String(month).padStart(2, "0")}`;
    const draftInvoices = await SELECT.from(Invoices)
      .where({
        status: "D",
        invoiceNumber: { like: invoiceNumberPattern },
      })
      .columns("ID", "client_ID", "invoiceNumber", "subtotal", "total");

    if (draftInvoices.length === 0) {
      return sentClients;
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

      try {
        if (transporter) {
          await transporter.sendMail({
            from: process.env.EMAIL_FROM || "noreply@nubexx.com",
            to: client.email,
            subject,
            text,
          });
        } else {
          log.info(
            `[Simulated Email] To: ${client.email}\nSubject: ${subject}\n${text}`,
          );
        }

        const invoiceEntryIds = lines
          .filter((l) => l.invoice_ID === invoice.ID)
          .map((l) => l.timeEntry_ID);

        await cds.tx(async (tx) => {
          await tx.run(
            UPDATE(Invoices).set({ status: "S" }).where({ ID: invoice.ID }),
          );
          if (invoiceEntryIds.length > 0) {
            await tx.run(
              UPDATE(TimeEntries)
                .set({ billingStatus: "I" })
                .where({ ID: { in: invoiceEntryIds } }),
            );
          }
        });

        sentClients.push(client.email);
      } catch (err) {
        log.error(
          `Retry failed for invoice ${invoice.invoiceNumber} (${client.email}):`,
          err,
        );
      }
    }

    return sentClients;
  }

  async _createNewInvoices(year, month, now, transporter, log) {
    const { TimeEntries, Projects, Clients, Invoices, InvoiceLines } =
      cds.entities("my.billing");
    const sentClients = [];

    // Projects with entries unbilled
    const entryProjects = await SELECT.distinct
      .from(TimeEntries)
      .where({
        year,
        month,
        billingStatus: { in: ["U", "B"] },
      })
      .columns("project_ID");

    if (entryProjects.length === 0) return sentClients;

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

    if (eligibleProjectIds.size === 0) return sentClients;

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

    if (eligibleClientIds.length === 0) return sentClients;

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

    if (newEligibleClientIds.length === 0) return sentClients;

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

    if (clients.length === 0) return sentClients;

    const projectMap = {};
    for (const p of projects) projectMap[p.ID] = p;

    const clientMap = {};
    for (const c of clients) clientMap[c.ID] = c;

    // 6. Agrupar
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

    for (const projectId of newEligibleProjectIds) {
      const project = projectMap[projectId];
      if (!project) continue;
      const clientId = project.client_ID;
      if (!clientProjectsData[clientId]) {
        clientProjectsData[clientId] = {};
      }
      if (!clientProjectsData[clientId][project.ID]) {
        clientProjectsData[clientId][project.ID] = {
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

        // Create invoice and lines and update entries
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
        });

        // Enviar email DESPUÉS del commit
        if (transporter) {
          await transporter.sendMail({
            from: process.env.EMAIL_FROM || "noreply@nubexx.com",
            to: client.email,
            subject,
            text,
          });
        } else {
          log.info(
            `[Simulated Email] To: ${client.email}\nSubject: ${subject}\n${text}`,
          );
        }

        await cds.tx(async (tx) => {
          await tx.run(
            UPDATE(Invoices).set({ status: "S" }).where({ ID: invoiceId }),
          );
          if (entryIds.length > 0) {
            await tx.run(
              UPDATE(TimeEntries)
                .set({ billingStatus: "I" })
                .where({ ID: { in: entryIds } }),
            );
          }
        });

        sentClients.push(client.email);
      } catch (err) {
        log.error(
          `Failed to send invoice email for ${client.email}. ` +
            `Invoice remains in Draft for retry.`,
          err,
        );
      }
    }

    return sentClients;
  }

  _createTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT
        ? parseInt(process.env.SMTP_PORT, 10)
        : undefined,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
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
