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
    const sendMock = jest.fn().mockResolvedValue({ simulated: true });
    const reminder = new EmployeeDraftReminder({
      emailSender: { send: sendMock },
    });

    const result = await reminder.run(new Date("2026-04-25"));

    expect(result.sent).toBe(1);
    expect(result.employees).toContain("minerva.jimenez@nubexx.com");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].to).toBe("minerva.jimenez@nubexx.com");
  });

  test("returns empty result when no draft entries exist for current month", async () => {
    const sendMock = jest.fn().mockResolvedValue({ simulated: true });
    const reminder = new EmployeeDraftReminder({
      emailSender: { send: sendMock },
    });

    const result = await reminder.run(new Date("2026-05-25"));

    expect(result.sent).toBe(0);
    expect(result.employees).toEqual([]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("uses provided emailSender instead of simulated logging", async () => {
    const sendMock = jest.fn().mockResolvedValue({ sent: true });

    const reminder = new EmployeeDraftReminder({
      emailSender: { send: sendMock },
    });
    await reminder.run(new Date("2026-04-25"));

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].to).toBe("minerva.jimenez@nubexx.com");
    expect(sendMock.mock.calls[0][0].subject).toBe(
      "Reminder: Finalize Your Timesheet - 4/2026",
    );
  });

  test("inserts notification records for each employee reminded", async () => {
    const sendMock = jest.fn().mockResolvedValue({ simulated: true });
    const reminder = new EmployeeDraftReminder({
      emailSender: { send: sendMock },
    });

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

    const sendMock = jest.fn().mockResolvedValue({ simulated: true });
    const reminder = new EmployeeDraftReminder({
      emailSender: { send: sendMock },
    });
    const result = await reminder.run(new Date("2026-04-25"));

    expect(result.sent).toBe(1);
    expect(sendMock.mock.calls[0][0].text).toMatch(/2 draft time entries/);

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
    const sendMock = jest.fn().mockResolvedValue({ simulated: true });
    const reminder = new EmployeeDraftReminder({
      emailSender: { send: sendMock },
    });

    const result = await reminder.run(new Date("2026-04-25"));

    expect(result.employees).not.toContain("hector.ruiz@nubexx.com");
  });
});
