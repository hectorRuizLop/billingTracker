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

  async run(now = new Date()) {
    const { year, month } = this._getPreviousMonth(now);
    const { TimeEntries, Projects, Clients, Invoices, InvoiceLines } =
      cds.entities("my.billing");

    const log = cds.log("monthly-invoice");

    // Projects entries unbilled of previous month
    const entryProjects = await SELECT.distinct
      .from(TimeEntries)
      .where({
        year,
        month,
        billingStatus: { in: ["U", "B"] },
      })
      .columns("project_ID");

    if (entryProjects.length === 0) {
      return { sent: 0, clients: [] };
    }

    const projectIds = entryProjects.map((e) => e.project_ID);

    // Obtain projects
    const projects = await SELECT.from(Projects)
      .where({ ID: { in: projectIds } })
      .columns("ID", "name", "status", "client_ID");

    // One only bulk query
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

    if (eligibleProjectIds.size === 0) {
      return { sent: 0, clients: [] };
    }

    // Group projects by client
    const clientAllProjects = {};
    for (const project of projects) {
      const clientId = project.client_ID;
      if (!clientAllProjects[clientId]) {
        clientAllProjects[clientId] = [];
      }
      clientAllProjects[clientId].push(project);
    }

    // One client is elegible if ALL its projects are elegible 
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

    if (eligibleClientIds.length === 0) {
      return { sent: 0, clients: [] };
    }

    const approvedEntries = await SELECT.from(TimeEntries)
      .where({
        project_ID: { in: eligibleClientProjectIds },
        year,
        month,
        status: "A",
        billingStatus: { in: ["U", "B"] },
      })
      .columns("ID", "hours", "rateSnapshot", "project_ID", "description");

    const clients = await SELECT.from(Clients)
      .where({ ID: { in: eligibleClientIds }, isDeleted: false })
      .columns("ID", "name", "email");

    if (clients.length === 0) {
      return { sent: 0, clients: [] };
    }

    const projectMap = {};
    for (const p of projects) {
      projectMap[p.ID] = p;
    }

    const clientMap = {};
    for (const c of clients) {
      clientMap[c.ID] = c;
    }

    // Group by client → project
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

    for (const projectId of eligibleClientProjectIds) {
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

    const transporter = this._transporter || this._createTransporter();
    const sentClients = [];

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
        `Summary${month}/${year}:\n\n` +
        `${projectLines}\n\n` +
        `Overall Total:\n` +
        `Hours: ${overallHours.toFixed(2)}\n` +
        `Cost: ${overallCost.toFixed(2)}\n` +
        `Billing Tracker`;

      try {
        const invoiceId = cds.utils.uuid();
        const today = now.toISOString().split("T")[0];
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

        await cds.tx(async (tx) => {
          await tx.run(
            INSERT.into(Invoices).entries({
              ID: invoiceId,
              invoiceNumber: `INV-${clientId.substring(0, 8)}-${year}${String(month).padStart(2, "0")}`,
              issueDate: today,
              status: "S",
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
                .set({ billingStatus: "I" })
                .where({ ID: { in: entryIds } }),
            );
          }
        });

        // Email is send after transaction commit to avoid sending emails for failed transactions
        if (transporter) {
          await transporter.sendMail({
            from: process.env.EMAIL_FROM || "noreply@nubexx.com",
            to: client.email,
            subject,
            text,
          });
        } else {
          log.info(`[Simulated Email] To: ${client.email}\nSubject: ${subject}\n${text}`);
        }

        sentClients.push(client.email);
      } catch (err) {
        log.error(`Failed to process invoice for ${client.email}:`, err);
      }
    }

    return { sent: sentClients.length, clients: sentClients };
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