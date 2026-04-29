"use strict";

const cds = require("@sap/cds");
const cron = require("node-cron");

class EmployeeDraftReminder {
  constructor(options = {}) {
    this._transporter = options.transporter;
    this._cronExpression = options.cronExpression || "0 9 25 * *";
  }

  async run(now = new Date()) {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const { TimeEntries, Employees, Notifications } =
      cds.entities("my.billing");

    const draftEntries = await SELECT.from(TimeEntries)
      .where({ status: "D", year, month })
      .columns("ID", "employee_ID", "project_ID", "date", "hours");

    if (draftEntries.length === 0) {
      return { sent: 0, employees: [] };
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

    const sentEmployees = [];
    const log = cds.log("employee-draft-reminder");

    for (const data of Object.values(summary)) {
      const employee = data.employee;
      const count = data.entries.length;

      const subject = `Reminder: Finalize Your Timesheet - ${month}/${year}`;
      const text = `Hello ${employee.firstName || "Employee"},\n\nYou have ${count} draft time ${count === 1 ? "entry" : "entries"} pending for ${month}/${year}.\n\nPlease review and submit your timesheet before the monthly deadline.\n\nBest regards,\nBilling Tracker`;

      await this._sendNotification(employee.email, subject, text, log);

      await INSERT.into(Notifications).entries({
        recipient_ID: employee.ID,
        type: "DraftReminder",
        subject,
        message: text,
        sentAt: new Date().toISOString(),
        status: "S",
      });

      sentEmployees.push(employee.email);
    }

    return { sent: sentEmployees.length, employees: sentEmployees };
  }

  async _sendNotification(to, subject, text, log) {
    if (this._transporter) {
      await this._transporter.sendMail({
        from: process.env.EMAIL_FROM || "noreply@nubexx.com",
        to,
        subject,
        text,
      });
    } else {
      log.info(`[Simulated Email] To: ${to}\nSubject: ${subject}\n${text}`);
    }
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
