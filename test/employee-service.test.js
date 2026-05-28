"use strict";

const {
  cds,
  GET,
  POST,
  PATCH,
  EMP1,
  EMP2,
  MGR1,
  MGR2,
  EMP1_ID,
  MGR1_ID,
  PROJECT_CP,
  PROJECT_ERP,
  PROJECT_MOBILE,
  TIME_ENTRY_SUBMITTED_EMP1,
  VALID_WORKDAY,
  SECOND_VALID_WORKDAY,
  WEEKEND_DATE,
  FUTURE_DATE,
  PREVIOUS_MONTH_WORKDAY,
  clearEmployeeMonthEntries,
} = require("./helpers");

describe("EmployeeService", () => {
  const BASE = "/api/employee";

  test("Employee sees only their own record", async () => {
    const { data, status } = await GET(`${BASE}/Employees`, { auth: EMP1 });
    expect(status).toBe(200);
    expect(data.value).toHaveLength(1);
    expect(data.value[0].ID).toBe(EMP1_ID);
  });

  test("Manager (with Employee role) sees all employees", async () => {
    const { data, status } = await GET(`${BASE}/Employees`, { auth: MGR1 });
    expect(status).toBe(200);
    expect(data.value.length).toBeGreaterThan(1);
  });

  test("Employee sees only their assigned projects", async () => {
    const { data, status } = await GET(`${BASE}/MyProjects`, { auth: EMP1 });
    expect(status).toBe(200);
    const ids = data.value.map((p) => p.ID);
    expect(ids).toContain(PROJECT_CP);
  });

  test("Employee sees only their own assignments", async () => {
    const { data, status } = await GET(`${BASE}/MyAssignments`, {
      auth: EMP1,
    });
    expect(status).toBe(200);
    expect(data.value.length).toBeGreaterThan(0);
    for (const a of data.value) {
      expect(a.employee_ID).toBe(EMP1_ID);
    }
  });

  test("Employee can create a time entry", async () => {
    await clearEmployeeMonthEntries(MGR1_ID);

    const { data, status } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: VALID_WORKDAY,
        hours: 1,
        description: "Unit test entry",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1 },
    );
    expect(status).toBe(201);
    expect(data.ID).toBeTruthy();
  });

  test("EMP2 cannot read a time entry owned by EMP1", async () => {
    const res = await GET(
      `${BASE}/MyTimeEntries/${TIME_ENTRY_SUBMITTED_EMP1}`,
      {
        auth: EMP2,
        validateStatus: () => true,
      },
    );
    expect(res.status).toBe(404);
  });

  test("Employee can submit all draft entries for a month", async () => {
    await clearEmployeeMonthEntries(MGR1_ID);

    const { data: firstDraft } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: "2026-04-16",
        hours: 2,
        description: "Month submit entry 1",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1 },
    );

    const { data: secondDraft } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: "2026-04-17",
        hours: 3,
        description: "Month submit entry 2",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1 },
    );

    const { status, data } = await POST(
      `${BASE}/submitMonth`,
      { year: 2026, month: 4 },
      { auth: MGR1 },
    );
    expect(status).toBe(200);
    expect(data.value).toMatch(/submitted .* time entr/i);

    const { data: submittedEntries } = await GET(
      `${BASE}/MyTimeEntries?$filter=ID eq '${firstDraft.ID}' or ID eq '${secondDraft.ID}'`,
      { auth: MGR1 },
    );
    expect(submittedEntries.value).toHaveLength(2);
    for (const entry of submittedEntries.value) {
      expect(entry.status).toBe("S");
    }

    await clearEmployeeMonthEntries(MGR1_ID);
  });

  test("submitMonth fails when the employee has no draft entries for that month", async () => {
    const { status, data } = await POST(
      `${BASE}/submitMonth`,
      { year: 2026, month: 2 },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/no draft time entries found/i);
  });
});

describe("TimeEntry Validations", () => {
  const BASE = "/api/employee";

  beforeAll(async () => {
    // Seed the submitted entry that tests assume exists
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries({
        ID: TIME_ENTRY_SUBMITTED_EMP1,
        date: "2026-04-01",
        hours: 8,
        description: "Submitted seed entry",
        status: "S",
        employee_ID: EMP1_ID,
        project_ID: PROJECT_CP,
        month: 4,
        year: 2026,
      }),
    );
  });

  test("Rejects time entry on a weekend", async () => {
    const { status, data } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: WEEKEND_DATE,
        hours: 1,
        description: "Saturday entry",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/weekend/i);
  });

  test("Rejects time entry with a future date", async () => {
    const { status, data } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: FUTURE_DATE,
        hours: 1,
        description: "Future entry",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/future/i);
  });

  test("Rejects hours that are not in quarter-hour increments", async () => {
    const { status, data } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: VALID_WORKDAY,
        hours: 1.1,
        description: "Bad increment",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/quarter-hour/i);
  });

  test("Employee cannot log more than 8 hours on the same day", async () => {
    // Add first entry of 5 hours
    await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: SECOND_VALID_WORKDAY,
        hours: 5,
        description: "Morning entry",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1, validateStatus: () => true },
    );

    // Try adding another 4 hours which exceeds 8
    const { status, data } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: SECOND_VALID_WORKDAY,
        hours: 4,
        description: "Afternoon entry",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/more than 8 hours/i);
  });

  test("Rejects time entry from a previous month", async () => {
    const { status, data } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: PREVIOUS_MONTH_WORKDAY,
        hours: 1,
        description: "March entry",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/current month/i);
  });

  test("Rejects time entry on a closed project", async () => {
    // Approve any submitted entries so the project can be closed
    await cds.run(
      UPDATE("my.billing.TimeEntries")
        .set({ status: "A" })
        .where({ project_ID: PROJECT_MOBILE, status: "S" }),
    );

    await PATCH(
      `/api/manager/Projects/${PROJECT_MOBILE}`,
      { status: "C" },
      { auth: MGR1 },
    );

    const { status, data } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: VALID_WORKDAY,
        hours: 1,
        description: "Closed project",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_MOBILE,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/open/i);

    await PATCH(
      `/api/manager/Projects/${PROJECT_MOBILE}`,
      { status: "O" },
      { auth: MGR1 },
    );
  });

  test("Rejects update on a non-Draft time entry", async () => {
    const { status, data } = await PATCH(
      `${BASE}/MyTimeEntries/${TIME_ENTRY_SUBMITTED_EMP1}`,
      { hours: 1 },
      { auth: EMP1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/draft/i);
  });

  test("Rejects updating a draft time entry to a non-Draft status", async () => {
    const { data: created } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: VALID_WORKDAY,
        hours: 1,
        description: "Draft status guard",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1 },
    );

    const { status, data } = await PATCH(
      `${BASE}/MyTimeEntries/${created.ID}`,
      { status: "S" },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/draft/i);
  });

  test("Allows updating a Draft time entry with a valid date", async () => {
    const { data: created } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: SECOND_VALID_WORKDAY,
        hours: 1,
        description: "Draft to update",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1 },
    );

    const { status } = await PATCH(
      `${BASE}/MyTimeEntries/${created.ID}`,
      { hours: 1, description: "Updated hours" },
      { auth: MGR1 },
    );
    expect(status).toBe(200);
  });

  test("Rejects creating a new time entry in a month that already has submitted records", async () => {
    const { status, data } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: "2026-04-20",
        hours: 1,
        description: "Should be blocked after submit",
        employee_ID: EMP1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: EMP1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/submitted or approved records/i);
  });

  test("Allows creating a new draft in the same month to correct a rejected entry", async () => {
    await clearEmployeeMonthEntries(MGR2.username);

    const rejectionSourceDate = "2026-04-14";
    const correctionDate = "2026-04-15";

    const { data: created } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: rejectionSourceDate,
        hours: 2,
        description: "Entry to be rejected",
        employee_ID: MGR2.username,
        project_ID: PROJECT_ERP,
      },
      { auth: MGR2 },
    );

    await cds.run(
      UPDATE("my.billing.TimeEntries")
        .set({
          status: "R",
          rejectionNote: "Rejected so the employee can correct the month.",
        })
        .where({ ID: created.ID }),
    );

    const { data: correction, status } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: correctionDate,
        hours: 1,
        description: "Corrected entry after rejection",
        employee_ID: MGR2.username,
        project_ID: PROJECT_ERP,
      },
      { auth: MGR2 },
    );

    expect(status).toBe(201);
    expect(correction.status).toBe("D");
  });
});

describe("Overtime Logic", () => {
  const BASE = "/api/employee";

  test("Rejects entry exceeding 8h without justification", async () => {
    await clearEmployeeMonthEntries(MGR1_ID);

    // First entry: 5h
    await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: VALID_WORKDAY,
        hours: 5,
        description: "Morning",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1 },
    );

    // Second entry: 4h → total 9h, no justification
    const { status, data } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: VALID_WORKDAY,
        hours: 4,
        description: "Afternoon",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1, validateStatus: () => true },
    );

    expect(status).toBe(400);
    expect(data.error.message).toMatch(/justification/i);
  });

  test("Allows entry exceeding 8h with justification and sets overtime fields", async () => {
    await clearEmployeeMonthEntries(MGR1_ID);

    await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: VALID_WORKDAY,
        hours: 6,
        description: "Morning",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: MGR1 },
    );

    const { status, data } = await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: VALID_WORKDAY,
        hours: 4,
        description: "Afternoon",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
        overtimeJustification: "Critical release deadline",
      },
      { auth: MGR1, validateStatus: () => true },
    );

    expect(status).toBe(201);
    expect(data.isOvertime).toBe(true);
    expect(parseFloat(data.overtimeHours)).toBe(2);
  });
});

describe("Calendar", () => {
  const BASE = "/api/employee";

  test("getCalendarDays returns days with hour aggregates", async () => {
    await clearEmployeeMonthEntries(EMP1_ID, 2026, 4);

    await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: "2026-04-14",
        hours: 3,
        description: "Calendar test",
        employee_ID: EMP1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: EMP1 },
    );

    const { status, data } = await GET(
      `${BASE}/getCalendarDays(year=2026,month=4)`,
      { auth: EMP1 },
    );

    expect(status).toBe(200);
    expect(data.value).toBeInstanceOf(Array);
    expect(data.value.length).toBe(30);

    const day14 = data.value.find((d) => d.date === "2026-04-14");
    expect(day14).toBeTruthy();
    expect(day14.totalHours).toBe(3);
    expect(day14.hasEntries).toBe(true);
    expect(day14.dayType).toBe("weekday");

    const day12 = data.value.find((d) => d.date === "2026-04-12");
    expect(day12.dayType).toBe("weekend");
  });
});

describe("Work Zone Notifications", () => {
  const BASE = "/api/employee";

  test("submitMonth creates WorkZone notification for project manager", async () => {
    await clearEmployeeMonthEntries(EMP1_ID, 2026, 4);
    await cds.run(
      DELETE.from("my.billing.Notifications").where({ channel: "WorkZone" }),
    );
    await cds.run(
      DELETE.from("my.billing.EmailOutbox").where({ channel: "WorkZone" }),
    );

    await POST(
      `${BASE}/MyTimeEntries`,
      {
        date: "2026-04-17",
        hours: 2,
        description: "Notification test",
        employee_ID: EMP1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: EMP1 },
    );

    const { status, data } = await POST(
      `${BASE}/submitMonth`,
      { year: 2026, month: 4 },
      { auth: EMP1 },
    );
    expect(status).toBe(200);

    // Manager should see the notification
    const { data: notifs } = await GET(`${BASE}/MyNotifications`, {
      auth: MGR1,
    });
    const notif = notifs.value.find((n) => n.subject.includes("Customer Portal"));
    expect(notif).toBeTruthy();
    expect(notif.channel).toBe("WorkZone");
    expect(notif.isRead).toBe(false);

    // Outbox entry should exist with reference to notification
    const outbox = await cds.run(
      SELECT.from("my.billing.EmailOutbox").where({ channel: "WorkZone" }),
    );
    expect(outbox.length).toBeGreaterThan(0);
    expect(outbox[0].referenceType).toBe("WorkZoneNotification");
    expect(outbox[0].referenceId).toBe(notif.ID);
  });

  test("markNotificationRead sets isRead to true", async () => {
    // Create a notification directly for MGR1
    const notifId = cds.utils.uuid();
    await cds.run(
      INSERT.into("my.billing.Notifications").entries({
        ID: notifId,
        recipient_ID: MGR1_ID,
        type: "Test",
        subject: "Test notification",
        message: "Please mark me as read",
        status: "P",
        channel: "WorkZone",
        isRead: false,
      }),
    );

    const { status, data } = await POST(
      `${BASE}/markNotificationRead`,
      { notificationId: notifId },
      { auth: MGR1 },
    );
    expect(status).toBe(200);
    expect(data.value).toMatch(/marked as read/i);

    const { data: notifs } = await GET(`${BASE}/MyNotifications`, {
      auth: MGR1,
    });
    const notif = notifs.value.find((n) => n.ID === notifId);
    expect(notif.isRead).toBe(true);
  });
});
