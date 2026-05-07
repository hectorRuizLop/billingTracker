"use strict";

const cds = require("@sap/cds");
const cron = require("node-cron");
const { EmailSender } = require("../handlers/shared/email-sender");

class PendingHoursReminder {
  constructor(options = {}) {
    this._emailSender = options.emailSender || new EmailSender();
    this._cronExpression = options.cronExpression || "0 9 1 * *";
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

    const { TimeEntries, Projects, Employees } = cds.entities("my.billing");

    const entries = await SELECT.from(TimeEntries)
      .where({ status: "S", year, month })
      .columns("ID", "project_ID");

    if (entries.length === 0) {
      return { sent: 0, managers: [] };
    }

    const projectIds = [...new Set(entries.map((e) => e.project_ID))];

    const projects = await SELECT.from(Projects)
      .where({ ID: { in: projectIds } })
      .columns("ID", "name", "manager_ID");

    const managerIds = [...new Set(projects.map((p) => p.manager_ID))];

    const managers = await SELECT.from(Employees)
      .where({ ID: { in: managerIds } })
      .columns("ID", "email", "firstName");

    const projectMap = {};
    for (const p of projects) {
      projectMap[p.ID] = p;
    }

    const managerMap = {};
    for (const m of managers) {
      managerMap[m.ID] = m;
    }

    const summary = {};
    for (const e of entries) {
      const project = projectMap[e.project_ID];
      const managerId = project.manager_ID;
      if (!summary[managerId]) {
        summary[managerId] = {
          manager: managerMap[managerId],
          projects: {},
        };
      }
      if (!summary[managerId].projects[project.ID]) {
        summary[managerId].projects[project.ID] = {
          name: project.name,
          count: 0,
        };
      }
      summary[managerId].projects[project.ID].count++;
    }

    const sentManagers = [];
    const { Notifications } = cds.entities("my.billing");

    for (const data of Object.values(summary)) {
      const manager = data.manager;
      const projectSummaries = Object.values(data.projects)
        .map(
          (p) =>
            `- ${p.name}: ${p.count} submitted time ${p.count === 1 ? "entry" : "entries"}`,
        )
        .join("\n");

      const subject = `Pending Time Entries for Review - ${month}/${year}`;
      const text = `Hello ${manager.firstName || "Manager"},\n\nYou have pending time entries awaiting your review from ${month}/${year}:\n\n${projectSummaries}\n\nPlease review and approve or reject them at your earliest convenience.\n\nBest regards,\nBilling Tracker`;

      await this._emailSender.send({
        to: manager.email,
        from: process.env.EMAIL_FROM || "noreply@nubexx.com",
        subject,
        text,
      });

      await INSERT.into(Notifications).entries({
        recipient_ID: manager.ID,
        type: "PendingHoursReminder",
        subject,
        message: text,
        sentAt: new Date().toISOString(),
        status: "S",
      });

      sentManagers.push(manager.email);
    }

    return { sent: sentManagers.length, managers: sentManagers };
  }

  start() {
    cron.schedule(this._cronExpression, () => {
      this.run().catch((err) => {
        cds.log("pending-hours-reminder").error(err);
      });
    });
  }
}

module.exports = { PendingHoursReminder };
