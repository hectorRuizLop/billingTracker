"use strict";

const {
  cds,
  GET,
  POST,
  PATCH,
  ADMIN,
  EMP2,
  MGR1,
  MGR2,
  EMP1_ID,
  PROJECT_CP,
  PROJECT_ERP,
  ASSIGNMENT_1,
  CLIENT_1,
  TIME_ENTRY_SUBMITTED_EMP1,
  VALID_WORKDAY,
  clearEmployeeMonthEntries,
} = require("./helpers");

describe("ManagerService", () => {
  const BASE = "/api/manager";

  test("MGR1 sees only projects they manage", async () => {
    const { data, status } = await GET(`${BASE}/Projects`, { auth: MGR1 });
    expect(status).toBe(200);
    for (const p of data.value) {
      expect(p.manager_ID).toBe(MGR1.username);
    }
  });

  test("MGR1 cannot read a project managed by MGR2", async () => {
    const res = await GET(`${BASE}/Projects/${PROJECT_ERP}`, {
      auth: MGR1,
      validateStatus: () => true,
    });
    expect(res.status).toBe(404);
  });

  test("MGR1 can update the budget on their own project", async () => {
    const { status } = await PATCH(
      `${BASE}/Projects/${PROJECT_CP}`,
      { budget: 160000.0 },
      { auth: MGR1 },
    );
    expect(status).toBe(200);
  });

  test("MGR2 cannot read an assignment from MGR1 project", async () => {
    const res = await GET(`${BASE}/ProjectAssignments/${ASSIGNMENT_1}`, {
      auth: MGR2,
      validateStatus: () => true,
    });
    expect(res.status).toBe(404);
  });

  test("Manager cannot create a project with budget <= 0", async () => {
    const { status } = await POST(
      `${BASE}/Projects`,
      {
        name: "Bad Budget Project",
        budget: 0,
        client_ID: CLIENT_1,
        manager_ID: MGR1.username,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
  });

  test("Manager creates a project and is auto-assigned as billable employee", async () => {
    const { data, status } = await POST(
      `${BASE}/Projects`,
      {
        name: "Auto Assign Test Project",
        budget: 75000,
        client_ID: CLIENT_1,
        manager_ID: MGR1.username,
      },
      { auth: MGR1 },
    );
    expect(status).toBe(201);

    const { data: assignments } = await GET(
      `${BASE}/ProjectAssignments?$filter=project_ID eq '${data.ID}' and employee_ID eq '${MGR1.username}'`,
      { auth: MGR1 },
    );
    expect(assignments.value).toHaveLength(1);
    expect(assignments.value[0].customRate).toBeTruthy();
  });

  test("Rejects assignment if employee_ID or project_ID is missing", async () => {
    const { status } = await POST(
      `${BASE}/ProjectAssignments`,
      {
        project_ID: PROJECT_CP,
        customRate: 150,
        isActive: true,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
  });

  test("Rejects assignment if employee does not exist", async () => {
    const { status } = await POST(
      `${BASE}/ProjectAssignments`,
      {
        employee_ID: "99999999-9999-9999-9999-999999999999",
        project_ID: PROJECT_CP,
        customRate: 150,
        isActive: true,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
  });

  test("Rejects duplicate project assignment", async () => {
    const { data: project } = await POST(
      `${BASE}/Projects`,
      {
        name: "Dup Project",
        budget: 10000,
        client_ID: CLIENT_1,
        manager_ID: MGR1.username,
      },
      { auth: MGR1 },
    );

    // Assign first time
    await POST(
      `${BASE}/ProjectAssignments`,
      {
        employee_ID: EMP1_ID,
        project_ID: project.ID,
        customRate: 150,
        isActive: true,
      },
      { auth: MGR1 },
    );

    // Assign second time (duplicate)
    const { status, data } = await POST(
      `${BASE}/ProjectAssignments`,
      {
        employee_ID: EMP1_ID,
        project_ID: project.ID,
        customRate: 160,
        isActive: true,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/already assigned/i);
  });

  test("Rejects assigning an inactive employee", async () => {
    // Deactivate an employee using Admin
    await PATCH(
      `/api/admin/Employees/${EMP2.username}`,
      { isActive: false },
      { auth: ADMIN },
    );

    const { status, data } = await POST(
      `${BASE}/ProjectAssignments`,
      {
        employee_ID: EMP2.username,
        project_ID: PROJECT_CP,
        customRate: 100,
        isActive: true,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/inactive/i);

    // Restore
    await PATCH(
      `/api/admin/Employees/${EMP2.username}`,
      { isActive: true },
      { auth: ADMIN },
    );
  });

  test("Projects expose computed financial fields on collection read", async () => {
    const { data, status } = await GET(`${BASE}/Projects`, { auth: MGR1 });
    expect(status).toBe(200);

    const cp = data.value.find((p) => p.ID === PROJECT_CP);
    expect(cp).toBeDefined();
    expect(parseFloat(cp.totalHours)).toBe(6);
    expect(parseFloat(cp.totalCost)).toBeCloseTo(270, 2);
    expect(parseFloat(cp.budgetRemaining)).toBeCloseTo(
      parseFloat(cp.budget) - 270,
      2,
    );
    expect(parseFloat(cp.avgCostPerHour)).toBeCloseTo(45, 2);

    const mobile = data.value.find(
      (p) => p.ID === "40000000-0000-0000-0000-000000000003",
    );
    expect(mobile).toBeDefined();
    expect(parseFloat(mobile.totalHours)).toBe(0);
    expect(parseFloat(mobile.totalCost)).toBe(0);
    expect(parseFloat(mobile.budgetRemaining)).toBeCloseTo(95000, 2);
    expect(parseFloat(mobile.avgCostPerHour)).toBe(0);
  });

  test("Projects expose projected and category breakdown fields", async () => {
    const { data, status } = await GET(`${BASE}/Projects`, { auth: MGR1 });
    expect(status).toBe(200);

    const cp = data.value.find((p) => p.ID === PROJECT_CP);
    expect(cp).toBeDefined();
    // Approved = 6h =270 / Submitted = 16h = 720 / Projected = 22h =990
    expect(parseFloat(cp.projectedTotalHours)).toBe(22);
    expect(parseFloat(cp.projectedTotalCost)).toBeCloseTo(990, 2);
    expect(parseFloat(cp.projectedBudgetRemaining)).toBeCloseTo(
      parseFloat(cp.budget) - 990,
      2,
    );
    expect(parseFloat(cp.submittedHours)).toBe(16);
    expect(parseFloat(cp.submittedCost)).toBeCloseTo(720, 2);

    // Category breakdown, approved only, both employees are Junior
    expect(parseFloat(cp.juniorHours)).toBe(6);
    expect(parseFloat(cp.juniorCost)).toBeCloseTo(270, 2);
    expect(parseFloat(cp.midLevelHours)).toBe(0);
    expect(parseFloat(cp.midLevelCost)).toBe(0);
    expect(parseFloat(cp.seniorHours)).toBe(0);
    expect(parseFloat(cp.seniorCost)).toBe(0);
    expect(parseFloat(cp.leadHours)).toBe(0);
    expect(parseFloat(cp.leadCost)).toBe(0);

    const mobile = data.value.find(
      (p) => p.ID === "40000000-0000-0000-0000-000000000003",
    );
    expect(mobile).toBeDefined();
    expect(parseFloat(mobile.projectedTotalHours)).toBe(0);
    expect(parseFloat(mobile.projectedTotalCost)).toBe(0);
    expect(parseFloat(mobile.submittedHours)).toBe(0);
    expect(parseFloat(mobile.juniorHours)).toBe(0);
  });

  test("Projects expose computed financial fields on single read", async () => {
    const { data, status } = await GET(`${BASE}/Projects/${PROJECT_CP}`, {
      auth: MGR1,
    });
    expect(status).toBe(200);
    expect(parseFloat(data.totalHours)).toBe(6);
    expect(parseFloat(data.totalCost)).toBeCloseTo(270, 2);
    expect(parseFloat(data.budgetRemaining)).toBeCloseTo(
      parseFloat(data.budget) - 270,
      2,
    );
    expect(parseFloat(data.avgCostPerHour)).toBeCloseTo(45, 2);
  });

  test("Time entries expose computed fields: EmployeeName and Cost", async () => {
    const { data } = await GET(
      `${BASE}/TimeEntries?$select=ID,hours,rateSnapshot,employeeName,cost`,
      { auth: MGR1 },
    );
    if (data.value.length > 0) {
      const entry = data.value[0];
      expect(typeof entry.employeeName).toBe("string");
      if (
        entry.rateSnapshot !== null &&
        entry.hours !== null &&
        entry.cost !== null
      ) {
        expect(parseFloat(entry.cost)).toBeCloseTo(
          parseFloat(entry.hours) * parseFloat(entry.rateSnapshot),
          2,
        );
      }
    }
  });

  test("Rejects closing a project with submitted time entries", async () => {
    const { data: project } = await POST(
      `${BASE}/Projects`,
      {
        name: "Close Check Project",
        budget: 10000,
        client_ID: CLIENT_1,
        manager_ID: MGR1.username,
      },
      { auth: MGR1 },
    );

    // Assign MGR2 so they can create a time entry
    await POST(
      `${BASE}/ProjectAssignments`,
      {
        employee_ID: MGR2.username,
        project_ID: project.ID,
        customRate: 100,
        isActive: true,
      },
      { auth: MGR1 },
    );

    await clearEmployeeMonthEntries(MGR2.username);

    // Create and submit a time entry
    const { data: entry } = await POST(
      `/api/employee/MyTimeEntries`,
      {
        date: VALID_WORKDAY,
        hours: 2,
        description: "Submitted entry",
        employee_ID: MGR2.username,
        project_ID: project.ID,
      },
      { auth: MGR2 },
    );

    await POST(
      `/api/employee/submitMonth`,
      { year: 2026, month: 4 },
      { auth: MGR2 },
    );

    const { status, data } = await PATCH(
      `${BASE}/Projects/${project.ID}`,
      { status: "C" },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/submitted/i);

    // Cleanup
    await cds.run(
      DELETE.from("my.billing.TimeEntries").where({ ID: entry.ID }),
    );
    await cds.run(
      DELETE.from("my.billing.ProjectAssignments").where({
        project_ID: project.ID,
      }),
    );
    await cds.run(DELETE.from("my.billing.Projects").where({ ID: project.ID }));
  });

  test("Allows closing a project without submitted time entries and sets closedAt/closedBy", async () => {
    const { data: project } = await POST(
      `${BASE}/Projects`,
      {
        name: "Safe Close Project",
        budget: 10000,
        client_ID: CLIENT_1,
        manager_ID: MGR1.username,
      },
      { auth: MGR1 },
    );

    const { status } = await PATCH(
      `${BASE}/Projects/${project.ID}`,
      { status: "C" },
      { auth: MGR1 },
    );
    expect(status).toBe(200);

    const { data: updated } = await GET(`${BASE}/Projects/${project.ID}`, {
      auth: MGR1,
    });
    expect(updated.status).toBe("C");
    expect(updated.closedAt).toBeTruthy();
    expect(updated.closedBy).toBe(MGR1.username);

    // Cleanup
    await cds.run(DELETE.from("my.billing.Projects").where({ ID: project.ID }));
  });

  test("Rejects creating an assignment on a closed project", async () => {
    const { data: project } = await POST(
      `${BASE}/Projects`,
      {
        name: "Closed Assignment Project",
        budget: 10000,
        client_ID: CLIENT_1,
        manager_ID: MGR1.username,
      },
      { auth: MGR1 },
    );

    await PATCH(
      `${BASE}/Projects/${project.ID}`,
      { status: "C" },
      { auth: MGR1 },
    );

    const { status, data } = await POST(
      `${BASE}/ProjectAssignments`,
      {
        employee_ID: EMP1_ID,
        project_ID: project.ID,
        customRate: 150,
        isActive: true,
      },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/closed/i);

    // Cleanup
    await cds.run(DELETE.from("my.billing.Projects").where({ ID: project.ID }));
  });
  test("MGR1 cannot update a Time Entry directly", async () => {
    const { status, data } = await PATCH(
      `/api/manager/TimeEntries/${TIME_ENTRY_SUBMITTED_EMP1}`,
      { hours: 10 },
      { auth: MGR1, validateStatus: () => true },
    );

    expect(status).toBe(403);
  });
});
