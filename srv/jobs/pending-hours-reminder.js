"use strict";

const cds = require("@sap/cds");
const cron = require("node-cron");
const { acquireLock, releaseLock } = require("../handlers/shared/job-lock");

/**
 * PendingHoursReminder identifies submitted time entries from the
 * previous month, groups them by manager, and writes reminder emails
 * to the transactional outbox. The OutboxProcessor handles actual
 * delivery, guaranteeing consistency between DB state and email delivery.
 */
class PendingHoursReminder {
  constructor(options = {}) {
    this._cronExpression = options.cronExpression || "0 9 1 * *";
    this._jobName = options.jobName || "PendingHoursReminder";
  }

  async run(now = new Date()) {
    const instanceId = `${this._jobName}-${process.pid}-${Date.now()}`;
    const hasLock = await acquireLock(this._jobName, instanceId, 30);
    if (!hasLock) {
      cds.log("pending-hours-reminder").info("Job already running on another instance — skipping.");
      return { created: 0, managers: [] };
    }

    try {
      return await this._execute(now);
    } finally {
      await releaseLock(this._jobName);
    }
  }

  async _execute(now = new Date()) {
    const { year, month } = this._getPreviousMonth(now);

    const { TimeEntries, Projects, Employees, EmailOutbox } = cds.entities("my.billing");

    const entries = await SELECT.from(TimeEntries)
      .where({ status: "S", year, month })
      .columns("ID", "project_ID");

    if (entries.length === 0) {
      return { created: 0, managers: [] };
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

    const createdManagers = [];
    const { EmailOutbox: Outbox } = cds.entities("my.billing");

    for (const data of Object.values(summary)) {
      const manager = data.manager;
      if (!manager || !manager.email) continue;

      const projectSummaries = Object.values(data.projects)
        .map(
          (p) =>
            `- ${p.name}: ${p.count} submitted time ${p.count === 1 ? "entry" : "entries"}`,
        )
        .join("\n");

      const subject = `Pending Time Entries for Review - ${month}/${year}`;
      const text = `Hello ${manager.firstName || "Manager"},\n\nYou have pending time entries awaiting your review from ${month}/${year}:\n\n${projectSummaries}\n\nPlease review and approve or reject them at your earliest convenience.\n\nBest regards,\nBilling Tracker`;

      try {
        await cds.tx(async (tx) => {
          await tx.run(
            INSERT.into(Outbox).entries({
              ID: cds.utils.uuid(),
              to: manager.email,
              from: process.env.EMAIL_FROM || "noreply@nubexx.com",
              subject,
              text,
              status: "P",
              attempts: 0,
              maxAttempts: 3,
              referenceType: "PendingHoursReminder",
              recipient_ID: manager.ID,
            }),
          );
        });

        createdManagers.push(manager.email);
      } catch (err) {
        cds.log("pending-hours-reminder").error(
          `Failed to queue reminder for ${manager.email}`,
          err,
        );
      }
    }

    return { created: createdManagers.length, managers: createdManagers };
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

  start() {
    cron.schedule(this._cronExpression, () => {
      this.run().catch((err) => {
        cds.log("pending-hours-reminder").error(err);
      });
    });
  }
}

module.exports = { PendingHoursReminder };
