"use strict";

const { cds, EMP1_ID, PROJECT_CP, PROJECT_ERP, PROJECT_MOBILE } = require("./helpers");
const { PendingHoursReminder } = require("../srv/jobs/pending-hours-reminder");
const { OutboxProcessor } = require("../srv/handlers/shared/outbox-processor");

describe("PendingHoursReminder", () => {
  beforeAll(async () => {
    // Seed submitted entries for April (previous month to May)
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        // MGR1 projects: Customer Portal (5 entries) + Mobile (1 entry)
        { ID: "70000000-0000-0000-0000-000000000200", date: "2026-04-01", hours: 1, description: "P1", status: "S", rateSnapshot: 45, employee_ID: EMP1_ID, project_ID: PROJECT_CP, month: 4, year: 2026, isOvertime: false },
        { ID: "70000000-0000-0000-0000-000000000201", date: "2026-04-02", hours: 1, description: "P2", status: "S", rateSnapshot: 45, employee_ID: EMP1_ID, project_ID: PROJECT_CP, month: 4, year: 2026, isOvertime: false },
        { ID: "70000000-0000-0000-0000-000000000202", date: "2026-04-03", hours: 1, description: "P3", status: "S", rateSnapshot: 45, employee_ID: EMP1_ID, project_ID: PROJECT_CP, month: 4, year: 2026, isOvertime: false },
        { ID: "70000000-0000-0000-0000-000000000203", date: "2026-04-04", hours: 1, description: "P4", status: "S", rateSnapshot: 45, employee_ID: EMP1_ID, project_ID: PROJECT_CP, month: 4, year: 2026, isOvertime: false },
        { ID: "70000000-0000-0000-0000-000000000204", date: "2026-04-05", hours: 1, description: "P5", status: "S", rateSnapshot: 45, employee_ID: EMP1_ID, project_ID: PROJECT_CP, month: 4, year: 2026, isOvertime: false },
        { ID: "70000000-0000-0000-0000-000000000205", date: "2026-04-06", hours: 1, description: "M1", status: "S", rateSnapshot: 45, employee_ID: EMP1_ID, project_ID: PROJECT_MOBILE, month: 4, year: 2026, isOvertime: false },
        // MGR2 project: ERP Migration (2 entries)
        { ID: "70000000-0000-0000-0000-000000000206", date: "2026-04-07", hours: 1, description: "E1", status: "S", rateSnapshot: 45, employee_ID: EMP1_ID, project_ID: PROJECT_ERP, month: 4, year: 2026, isOvertime: false },
        { ID: "70000000-0000-0000-0000-000000000207", date: "2026-04-08", hours: 1, description: "E2", status: "S", rateSnapshot: 45, employee_ID: EMP1_ID, project_ID: PROJECT_ERP, month: 4, year: 2026, isOvertime: false },
      ]),
    );
  });

  afterAll(async () => {
    await cds.run(
      DELETE.from("my.billing.TimeEntries").where({
        ID: { in: [
          "70000000-0000-0000-0000-000000000200",
          "70000000-0000-0000-0000-000000000201",
          "70000000-0000-0000-0000-000000000202",
          "70000000-0000-0000-0000-000000000203",
          "70000000-0000-0000-0000-000000000204",
          "70000000-0000-0000-0000-000000000205",
          "70000000-0000-0000-0000-000000000206",
          "70000000-0000-0000-0000-000000000207",
        ]},
      }),
    );
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await cds.run(
      DELETE.from("my.billing.EmailOutbox").where({
        referenceType: "PendingHoursReminder",
      }),
    );
    await cds.run(
      DELETE.from("my.billing.Notifications").where({
        type: "PendingHoursReminder",
      }),
    );
  });

  test("queues outbox entries for managers with submitted time entries from previous month", async () => {
    const reminder = new PendingHoursReminder();
    const result = await reminder.run(new Date("2026-05-01"));

    expect(result.created).toBe(2);
    expect(result.managers).toContain("alejandro.martinez@nubexx.com");
    expect(result.managers).toContain("alejandro.lopez@nubexx.com");

    const outbox = await cds.run(
      SELECT.from("my.billing.EmailOutbox").where({
        referenceType: "PendingHoursReminder",
      }),
    );
    expect(outbox.length).toBe(2);

    const mgr1Entry = outbox.find(
      (o) => o.to === "alejandro.martinez@nubexx.com",
    );
    expect(mgr1Entry.subject).toBe("Pending Time Entries for Review - 4/2026");
    expect(mgr1Entry.text).toMatch(/Customer Portal/);
    expect(mgr1Entry.text).toMatch(/5 submitted time entries/);
    expect(mgr1Entry.text).toMatch(/Sales Mobile App/);
    expect(mgr1Entry.text).toMatch(/1 submitted time entry/);

    const mgr2Entry = outbox.find((o) => o.to === "alejandro.lopez@nubexx.com");
    expect(mgr2Entry.subject).toBe("Pending Time Entries for Review - 4/2026");
    expect(mgr2Entry.text).toMatch(/ERP Migration/);
    expect(mgr2Entry.text).toMatch(/2 submitted time entries/);
  });

  test("returns empty result when no submitted entries exist for previous month", async () => {
    const reminder = new PendingHoursReminder();
    const result = await reminder.run(new Date("2026-01-01"));

    expect(result.created).toBe(0);
    expect(result.managers).toEqual([]);

    const outbox = await cds.run(
      SELECT.from("my.billing.EmailOutbox").where({
        referenceType: "PendingHoursReminder",
      }),
    );
    expect(outbox.length).toBe(0);
  });

  test("outbox processor sends queued emails and writes notification records", async () => {
    const reminder = new PendingHoursReminder();
    await reminder.run(new Date("2026-05-01"));

    const sendMock = jest.fn().mockResolvedValue({ sent: true });
    const processor = new OutboxProcessor({ emailSender: { send: sendMock } });
    await processor.processPending();

    expect(sendMock).toHaveBeenCalledTimes(2);

    const notifications = await cds.run(
      SELECT.from("my.billing.Notifications").where({
        type: "PendingHoursReminder",
      }),
    );
    expect(notifications.length).toBeGreaterThanOrEqual(2);
    expect(notifications[0].status).toBe("S");
    expect(notifications[0].subject).toMatch(/Pending Time Entries/);
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

    expect(result.created).toBe(1);

    const outbox = await cds.run(
      SELECT.from("my.billing.EmailOutbox").where({
        referenceType: "PendingHoursReminder",
      }),
    );
    expect(outbox.length).toBe(1);
    expect(outbox[0].text).toMatch(/Customer Portal/);
    expect(outbox[0].text).toMatch(/Sales Mobile App/);

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

    expect(result.created).toBe(1);
    expect(result.managers).toContain("alejandro.martinez@nubexx.com");

    const outbox = await cds.run(
      SELECT.from("my.billing.EmailOutbox").where({
        referenceType: "PendingHoursReminder",
      }),
    );
    expect(outbox[0].subject).toBe("Pending Time Entries for Review - 12/2025");

    await cds.run(
      DELETE.from("my.billing.TimeEntries").where({
        ID: "70000000-0000-0000-0000-000000000003",
      }),
    );
  });
});
