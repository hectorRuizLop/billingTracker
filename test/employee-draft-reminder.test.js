"use strict";

const { cds, EMP2_ID, PROJECT_CP } = require("./helpers");
const {
  EmployeeDraftReminder,
} = require("../srv/jobs/employee-draft-reminder");
const { OutboxProcessor } = require("../srv/handlers/shared/outbox-processor");

describe("EmployeeDraftReminder", () => {
  let logInfoMock;
  let logErrorMock;

  beforeAll(async () => {
    // Seed a draft entry for EMP2 in April so the reminder has something to find
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries({
        ID: "70000000-0000-0000-0000-000000000300",
        date: "2026-04-18",
        hours: 2,
        description: "Seed draft",
        status: "D",
        employee_ID: EMP2_ID,
        project_ID: PROJECT_CP,
        month: 4,
        year: 2026,
        isOvertime: false,
      }),
    );
  });

  afterAll(async () => {
    await cds.run(
      DELETE.from("my.billing.TimeEntries").where({
        ID: "70000000-0000-0000-0000-000000000300",
      }),
    );
  });

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

  afterEach(async () => {
    jest.restoreAllMocks();
    await cds.run(
      DELETE.from("my.billing.EmailOutbox").where({
        referenceType: "DraftReminder",
      }),
    );
    await cds.run(
      DELETE.from("my.billing.Notifications").where({
        type: "DraftReminder",
      }),
    );
  });

  test("queues reminder outbox entries for employees with draft time entries for current month", async () => {
    const reminder = new EmployeeDraftReminder();
    const result = await reminder.run(new Date("2026-04-25"));

    expect(result.created).toBe(1);
    expect(result.employees).toContain("minerva.jimenez@nubexx.com");

    const outbox = await cds.run(
      SELECT.from("my.billing.EmailOutbox").where({
        referenceType: "DraftReminder",
      }),
    );
    expect(outbox.length).toBe(1);
    expect(outbox[0].to).toBe("minerva.jimenez@nubexx.com");
    expect(outbox[0].subject).toBe(
      "Reminder: Finalize Your Timesheet - 4/2026",
    );
  });

  test("returns empty result when no draft entries exist for current month", async () => {
    const reminder = new EmployeeDraftReminder();
    const result = await reminder.run(new Date("2026-05-25"));

    expect(result.created).toBe(0);
    expect(result.employees).toEqual([]);

    const outbox = await cds.run(
      SELECT.from("my.billing.EmailOutbox").where({
        referenceType: "DraftReminder",
      }),
    );
    expect(outbox.length).toBe(0);
  });

  test("outbox processor sends the queued email and writes notification record", async () => {
    const reminder = new EmployeeDraftReminder();
    await reminder.run(new Date("2026-04-25"));

    const sendMock = jest.fn().mockResolvedValue({ sent: true });
    const processor = new OutboxProcessor({ emailSender: { send: sendMock } });
    await processor.processPending();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].to).toBe("minerva.jimenez@nubexx.com");
    expect(sendMock.mock.calls[0][0].subject).toBe(
      "Reminder: Finalize Your Timesheet - 4/2026",
    );

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
    expect(empNotification.status).toBe("S");
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

    expect(result.created).toBe(1);

    const outbox = await cds.run(
      SELECT.from("my.billing.EmailOutbox").where({
        referenceType: "DraftReminder",
      }),
    );
    expect(outbox.length).toBe(1);
    expect(outbox[0].text).toMatch(/2 draft time entries/);

    await cds.run(
      DELETE.from("my.billing.TimeEntries").where({
        ID: "70000000-0000-0000-0000-000000000010",
      }),
    );
  });

  test("does not remind employees with only submitted or approved entries", async () => {
    const reminder = new EmployeeDraftReminder();
    const result = await reminder.run(new Date("2026-04-25"));

    expect(result.employees).not.toContain("hector.ruiz@nubexx.com");
  });
});
