"use strict";

const cds = require("@sap/cds");
const cron = require("node-cron");
const { acquireLock, releaseLock } = require("../handlers/shared/job-lock");

/**
 * EmployeeDraftReminder identifies employees with draft time entries
 * for the current month and writes reminder emails to the transactional
 * outbox. The OutboxProcessor handles actual delivery, guaranteeing
 * consistency between DB state and email delivery even across restarts.
 */
class EmployeeDraftReminder {
  constructor(options = {}) {
    this._cronExpression = options.cronExpression || "0 9 25 * *";
    this._jobName = options.jobName || "EmployeeDraftReminder";
  }

  async run(now = new Date()) {
    const instanceId = `${this._jobName}-${process.pid}-${Date.now()}`;
    const hasLock = await acquireLock(this._jobName, instanceId, 30);
    if (!hasLock) {
      cds
        .log("employee-draft-reminder")
        .info("Job already running on another instance — skipping.");
      return { created: 0, employees: [] };
    }

    try {
      return await this._execute(now);
    } finally {
      await releaseLock(this._jobName);
    }
  }

  async _execute(now = new Date()) {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const { TimeEntries, Employees, EmailOutbox } = cds.entities("my.billing");

    const draftEntries = await SELECT.from(TimeEntries)
      .where({ status: "D", year, month })
      .columns("ID", "employee_ID", "project_ID", "date", "hours");

    if (draftEntries.length === 0) {
      return { created: 0, employees: [] };
    }

    const employeeIds = [...new Set(draftEntries.map((e) => e.employee_ID))];

    const employees = await SELECT.from(Employees)
      .where({ ID: { in: employeeIds } })
      .columns("ID", "email", "firstName");

    const employeeMap = {};
    for (const emp of employees) {
      employeeMap[emp.ID] = emp;
    }

    const summary = {};
    for (const e of draftEntries) {
      const empId = e.employee_ID;
      if (!summary[empId]) {
        summary[empId] = {
          employee: employeeMap[empId],
          entries: [],
        };
      }
      summary[empId].entries.push(e);
    }

    const createdEmployees = [];
    const log = cds.log("employee-draft-reminder");

    for (const data of Object.values(summary)) {
      const employee = data.employee;
      if (!employee || !employee.email) continue;

      const count = data.entries.length;
      const subject = `Reminder: Finalize Your Timesheet - ${month}/${year}`;
      const text = `Hello ${employee.firstName || "Employee"},\n\nYou have ${count} draft time ${count === 1 ? "entry" : "entries"} pending for ${month}/${year}.\n\nPlease review and submit your timesheet before the monthly deadline.\n\nBest regards,\nBilling Tracker`;

      try {
        await cds.tx(async (tx) => {
          await tx.run(
            INSERT.into(EmailOutbox).entries({
              ID: cds.utils.uuid(),
              to: employee.email,
              from: process.env.EMAIL_FROM || "noreply@nubexx.com",
              subject,
              text,
              status: "P",
              attempts: 0,
              maxAttempts: 3,
              referenceType: "DraftReminder",
              recipient_ID: employee.ID,
            }),
          );
        });

        createdEmployees.push(employee.email);
      } catch (err) {
        // Log and continue — one bad outbox write should not abort the rest of the loop
        log.error(`Failed to queue reminder for ${employee.email}`, err);
      }
    }

    return { created: createdEmployees.length, employees: createdEmployees };
  }

  start() {
    cron.schedule(this._cronExpression, () => {
      this.run().catch((err) => {
        cds.log("employee-draft-reminder").error(err);
      });
    });
  }
}

module.exports = { EmployeeDraftReminder };
