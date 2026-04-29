"use strict";

const { cds, EMP1_ID, PROJECT_CP, PROJECT_MOBILE } = require("./helpers");
const { PendingHoursReminder } = require("../srv/jobs/pending-hours-reminder");

jest.mock("nodemailer");
const nodemailer = require("nodemailer");

describe("PendingHoursReminder", () => {
  let sendMailMock;
  let createTransportMock;

  beforeEach(() => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: "test" });
    createTransportMock = jest.fn().mockReturnValue({
      sendMail: sendMailMock,
    });
    nodemailer.createTransport = createTransportMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("sends email summaries to managers with submitted time entries from previous month", async () => {
    const reminder = new PendingHoursReminder();

    const result = await reminder.run(new Date("2026-05-01"));

    expect(result.sent).toBe(2);
    expect(result.managers).toContain("alejandro.martinez@nubexx.com");
    expect(result.managers).toContain("alejandro.lopez@nubexx.com");

    expect(sendMailMock).toHaveBeenCalledTimes(2);

    const mgr1Call = sendMailMock.mock.calls.find(
      (call) => call[0].to === "alejandro.martinez@nubexx.com",
    );
    expect(mgr1Call[0].subject).toBe(
      "Pending Time Entries for Review - 4/2026",
    );
    expect(mgr1Call[0].text).toMatch(/Customer Portal/);
    expect(mgr1Call[0].text).toMatch(/2 submitted time entries/);

    const mgr2Call = sendMailMock.mock.calls.find(
      (call) => call[0].to === "alejandro.lopez@nubexx.com",
    );
    expect(mgr2Call[0].subject).toBe(
      "Pending Time Entries for Review - 4/2026",
    );
    expect(mgr2Call[0].text).toMatch(/ERP Migration/);
    expect(mgr2Call[0].text).toMatch(/1 submitted time entry/);
  });

  test("returns empty result when no submitted entries exist for previous month", async () => {
    const reminder = new PendingHoursReminder();

    const result = await reminder.run(new Date("2026-01-01"));

    expect(result.sent).toBe(0);
    expect(result.managers).toEqual([]);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  test("uses provided transporter instead of creating one", async () => {
    const customSendMail = jest.fn().mockResolvedValue({ messageId: "custom" });
    const customTransporter = { sendMail: customSendMail };

    const reminder = new PendingHoursReminder({
      transporter: customTransporter,
    });
    await reminder.run(new Date("2026-05-01"));

    expect(createTransportMock).not.toHaveBeenCalled();
    expect(customSendMail).toHaveBeenCalledTimes(2);
  });

  test("groups multiple projects for the same manager", async () => {
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000001",
          date: "2026-02-10",
          hours: 5,
          description: "Test",
          status: "S",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 2,
          year: 2026,
        },
        {
          ID: "70000000-0000-0000-0000-000000000002",
          date: "2026-02-11",
          hours: 3,
          description: "Test",
          status: "S",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_MOBILE,
          month: 2,
          year: 2026,
        },
      ]),
    );

    const reminder = new PendingHoursReminder();
    const result = await reminder.run(new Date("2026-03-01"));

    expect(result.sent).toBe(1);

    const mgr1Call = sendMailMock.mock.calls.find(
      (call) => call[0].to === "alejandro.martinez@nubexx.com",
    );
    expect(mgr1Call[0].text).toMatch(/Customer Portal/);
    expect(mgr1Call[0].text).toMatch(/Sales Mobile App/);

    await cds.run(
      DELETE.from("my.billing.TimeEntries").where({
        ID: {
          in: [
            "70000000-0000-0000-0000-000000000001",
            "70000000-0000-0000-0000-000000000002",
          ],
        },
      }),
    );
  });

  test("correctly handles year rollover for January", async () => {
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000003",
          date: "2025-12-15",
          hours: 5,
          description: "Test",
          status: "S",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 12,
          year: 2025,
        },
      ]),
    );

    const reminder = new PendingHoursReminder();
    const result = await reminder.run(new Date("2026-01-01"));

    expect(result.sent).toBe(1);
    expect(result.managers).toContain("alejandro.martinez@nubexx.com");

    const mgr1Call = sendMailMock.mock.calls.find(
      (call) => call[0].to === "alejandro.martinez@nubexx.com",
    );
    expect(mgr1Call[0].subject).toBe(
      "Pending Time Entries for Review - 12/2025",
    );

    await cds.run(
      DELETE.from("my.billing.TimeEntries").where({
        ID: "70000000-0000-0000-0000-000000000003",
      }),
    );
  });
});
