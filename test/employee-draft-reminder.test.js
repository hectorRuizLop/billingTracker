"use strict";

const { cds, EMP2_ID, PROJECT_CP } = require("./helpers");
const {
  EmployeeDraftReminder,
} = require("../srv/jobs/employee-draft-reminder");

describe("EmployeeDraftReminder", () => {
  let logInfoMock;
  let logErrorMock;

  beforeEach(() => {
    logInfoMock = jest.fn();
    logErrorMock = jest.fn();
    jest.spyOn(cds, "log").mockImplementation((name) => {
      if (name === "employee-draft-reminder") {
        return { info: logInfoMock, error: logErrorMock };
      }
      return { info: jest.fn(), error: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sends reminder to employees with draft time entries for current month", async () => {
    const reminder = new EmployeeDraftReminder();

    const result = await reminder.run(new Date("2026-04-25"));

    expect(result.sent).toBe(1);
    expect(result.employees).toContain("minerva.jimenez@nubexx.com");
    expect(logInfoMock).toHaveBeenCalledTimes(1);
    expect(logInfoMock.mock.calls[0][0]).toMatch(/minerva.jimenez@nubexx.com/);
  });

  test("returns empty result when no draft entries exist for current month", async () => {
    const reminder = new EmployeeDraftReminder();

    const result = await reminder.run(new Date("2026-05-25"));

    expect(result.sent).toBe(0);
    expect(result.employees).toEqual([]);
    expect(logInfoMock).not.toHaveBeenCalled();
  });

  test("uses provided transporter instead of logging to console", async () => {
    const sendMailMock = jest.fn().mockResolvedValue({ messageId: "test" });
    const customTransporter = { sendMail: sendMailMock };

    const reminder = new EmployeeDraftReminder({
      transporter: customTransporter,
    });
    await reminder.run(new Date("2026-04-25"));

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].to).toBe("minerva.jimenez@nubexx.com");
    expect(sendMailMock.mock.calls[0][0].subject).toBe(
      "Reminder: Finalize Your Timesheet - 4/2026",
    );
    expect(logInfoMock).not.toHaveBeenCalled();
  });

  test("inserts notification records for each employee reminded", async () => {
    const reminder = new EmployeeDraftReminder();

    await reminder.run(new Date("2026-04-25"));

    const notifications = await cds.run(
      SELECT.from("my.billing.Notifications").where({
        type: "DraftReminder",
      }),
    );

    expect(notifications.length).toBeGreaterThanOrEqual(1);
    const empNotification = notifications.find(
      (n) => n.recipient_ID === EMP2_ID,
    );
    expect(empNotification).toBeDefined();
    expect(empNotification.subject).toBe(
      "Reminder: Finalize Your Timesheet - 4/2026",
    );
    expect(empNotification.status).toBe("S");

    await cds.run(
      DELETE.from("my.billing.Notifications").where({
        type: "DraftReminder",
      }),
    );
  });

  test("groups multiple draft entries for the same employee", async () => {
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000010",
          date: "2026-04-20",
          hours: 3,
          description: "Extra draft entry",
          status: "D",
          employee_ID: EMP2_ID,
          project_ID: PROJECT_CP,
          month: 4,
          year: 2026,
        },
      ]),
    );

    const reminder = new EmployeeDraftReminder();
    const result = await reminder.run(new Date("2026-04-25"));

    expect(result.sent).toBe(1);

    const logCall = logInfoMock.mock.calls[0][0];
    expect(logCall).toMatch(/2 draft time entries/);

    await cds.run(
      DELETE.from("my.billing.TimeEntries").where({
        ID: "70000000-0000-0000-0000-000000000010",
      }),
    );
    await cds.run(
      DELETE.from("my.billing.Notifications").where({
        type: "DraftReminder",
      }),
    );
  });

  test("does not remind employees with only submitted or approved entries", async () => {
    const reminder = new EmployeeDraftReminder();

    const result = await reminder.run(new Date("2026-04-25"));

    expect(result.employees).not.toContain("hector.ruiz@nubexx.com");
  });
});
