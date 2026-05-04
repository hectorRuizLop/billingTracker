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

    // Eligible projects
    const eligibleProjectIds = [];
    for (const project of projects) {
      if (project.status === "C") {
        eligibleProjectIds.push(project.ID);
        continue;
      }

      // One consult per project
      const pendingEntry = await SELECT.one
        .from(TimeEntries)
        .where({
          project_ID: project.ID,
          year,
          month,
          status: { in: ["D", "S"] },
        })
        .columns("ID");

      if (!pendingEntry) {
        eligibleProjectIds.push(project.ID);
      }
    }

    if (eligibleProjectIds.length === 0) {
      return { sent: 0, clients: [] };
    } // 4. Entries aprobadas de proyectos elegibles

    const approvedEntries = await SELECT.from(TimeEntries)

      .where({
        project_ID: { in: eligibleProjectIds },

        year,

        month,

        status: "A",

        billingStatus: { in: ["U", "B"] },
      })

      .columns("ID", "hours", "rateSnapshot", "project_ID", "description");

    const eligibleProjects = projects.filter((p) =>
      eligibleProjectIds.includes(p.ID),
    );

    const clientIds = [...new Set(eligibleProjects.map((p) => p.client_ID))];

    const clients = await SELECT.from(Clients)

      .where({ ID: { in: clientIds }, isDeleted: false })
      .columns("ID", "name", "email");

    const projectMap = {};

    for (const p of eligibleProjects) {
      projectMap[p.ID] = p;
    }

    const clientMap = {};

    for (const c of clients) {
      clientMap[c.ID] = c;
    }

    // Group per client and project

    const clientProjects = {};
    for (const entry of approvedEntries) {
      const project = projectMap[entry.project_ID];
      if (!project) continue;
      const clientId = project.client_ID;
      if (!clientProjects[clientId]) {
        clientProjects[clientId] = {};
      }

      if (!clientProjects[clientId][project.ID]) {
        clientProjects[clientId][project.ID] = {
          name: project.name,
          entries: [],
          totalHours: 0,
          totalCost: 0,
        };
      }

      const hours = parseFloat(entry.hours);

      const rate = parseFloat(entry.rateSnapshot || 0);

      const cost = hours * rate;

      clientProjects[clientId][project.ID].entries.push(entry);

      clientProjects[clientId][project.ID].totalHours += hours;

      clientProjects[clientId][project.ID].totalCost += cost;
    }

    // Make sure all eligible projects are included

    for (const projectId of eligibleProjectIds) {
      const project = projectMap[projectId];

      if (!project) continue;

      const clientId = project.client_ID;

      if (!clientProjects[clientId]) {
        clientProjects[clientId] = {};
      }

      if (!clientProjects[clientId][project.ID]) {
        clientProjects[clientId][project.ID] = {
          name: project.name,

          entries: [],

          totalHours: 0,

          totalCost: 0,
        };
      }
    }

    const transporter = this._transporter || this._createTransporter();

    const sentClients = [];

    for (const clientId of Object.keys(clientProjects)) {
      const client = clientMap[clientId];

      if (!client || !client.email) continue;

      const projectsData = Object.values(clientProjects[clientId]);

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

        // Create invoice 

        const invoiceId = cds.utils.uuid();

        const today = now.toISOString().split("T")[0];

        await INSERT.into(Invoices).entries({
          ID: invoiceId,

          invoiceNumber: `INV-${clientId.substring(0, 8)}-${year}${String(month).padStart(2, "0")}`,
          issueDate: today,
          status: "S",
          currency: "EUR",
          subtotal: overallCost,
          total: overallCost,
          client_ID: clientId,
        });

        const invoiceLines = [];

        for (const p of projectsData) {
          for (const entry of p.entries) {
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

        if (invoiceLines.length > 0) {
          await INSERT.into(InvoiceLines).entries(invoiceLines);
        }

        const entryIds = [];

        for (const p of projectsData) {
          for (const entry of p.entries) {
            entryIds.push(entry.ID);
          }
        }

        if (entryIds.length > 0) {
          await UPDATE(TimeEntries)
            .set({ billingStatus: "I" })
            .where({ ID: { in: entryIds } });
        }

        sentClients.push(client.email);
      } catch (err) {
        log.error(`Failed to send invoice to ${client.email}:`, err);
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
