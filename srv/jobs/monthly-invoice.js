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
    }
  }
}
