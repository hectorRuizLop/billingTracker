"use strict";

const {
  GET,
  POST,
  PATCH,
  HTTP_DELETE,
  ADMIN,
  EMP1,
  MGR1,
  EMP1_ID,
  MGR1_ID,
  PROJECT_CP,
  PROJECT_MOBILE,
  VALID_WORKDAY,
} = require("./helpers");

describe("AdminService", () => {
  const BASE = "/api/admin";

  test("Admin can read all employees", async () => {
    const { data, status } = await GET(`${BASE}/Employees`, { auth: ADMIN });
    expect(status).toBe(200);
    expect(data.value.length).toBeGreaterThan(0);
  });

  test("Non-admin is forbidden from AdminService", async () => {
    const res = await GET(`${BASE}/Employees`, {
      auth: EMP1,
      validateStatus: () => true,
    });
    expect(res.status).toBe(403);
  });

  test("Admin reads all 4 seed categories", async () => {
    const { data, status } = await GET(`${BASE}/Categories`, { auth: ADMIN });
    expect(status).toBe(200);
    expect(data.value).toHaveLength(4);
  });

  test("Admin can create a valid client", async () => {
    const { data, status } = await POST(
      `${BASE}/Clients`,
      {
        name: "Test Corp SA",
        email: "testcorp@nubexx.com",
        phone: "+52 55 0000 0001",
      },
      { auth: ADMIN },
    );
    expect(status).toBe(201);
    expect(data.ID).toBeTruthy();
  });

  test("Rejects client with empty name", async () => {
    const { status, data } = await POST(
      `${BASE}/Clients`,
      { name: "", email: "ok@nubexx.com" },
      { auth: ADMIN, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/name is required| missing value/i);
  });

  test("Changes employee role to Manager and auto-assigns Lead category", async () => {
    const { data, status } = await POST(
      `${BASE}/changeEmployeeRole`,
      { employeeId: EMP1_ID, newRole: "M" },
      { auth: ADMIN },
    );
    expect(status).toBe(200);
    expect(data.value).toMatch(/updated/i);

    const { data: emp } = await GET(`${BASE}/Employees/${EMP1_ID}`, {
      auth: ADMIN,
    });
    expect(emp.role).toBe("M");
    expect(emp.category_ID).toBe("10000000-0000-0000-0000-000000000004");
  });

  test("Rejects changeEmployeeRole with invalid role code", async () => {
    const { status } = await POST(
      `${BASE}/changeEmployeeRole`,
      { employeeId: EMP1_ID, newRole: "X" },
      { auth: ADMIN, validateStatus: () => true },
    );
    expect(status).toBe(400);
  });

  test("Soft-deletes a client and hides it from reads", async () => {
    const { data: created } = await POST(
      `${BASE}/Clients`,
      { name: "To Be Deleted SA", email: "del@nubexx.com" },
      { auth: ADMIN },
    );
    const clientId = created.ID;

    const { status: delStatus } = await HTTP_DELETE(
      `${BASE}/Clients/${clientId}`,
      { auth: ADMIN },
    );
    expect(delStatus).toBe(204);

    const { data: list } = await GET(`${BASE}/Clients`, { auth: ADMIN });
    expect(list.value.map((c) => c.ID)).not.toContain(clientId);
  });

  test("Reactivates a soft-deleted client", async () => {
    const { data: created } = await POST(
      `${BASE}/Clients`,
      { name: "To Reactivate Corp", email: "react@nubexx.com" },
      { auth: ADMIN },
    );
    const clientId = created.ID;

    await HTTP_DELETE(`${BASE}/Clients/${clientId}`, { auth: ADMIN });

    const { data, status } = await POST(
      `${BASE}/reactivateClient`,
      { clientId },
      { auth: ADMIN },
    );
    expect(status).toBe(200);
    expect(data.value).toMatch(/reactivated/i);

    const { data: list } = await GET(`${BASE}/Clients`, { auth: ADMIN });
    expect(list.value.map((c) => c.ID)).toContain(clientId);
  });

  test("Admin cannot create a time entry on a closed project", async () => {
    await PATCH(
      `/api/manager/Projects/${PROJECT_MOBILE}`,
      { status: "C" },
      { auth: MGR1 },
    );

    const { status, data } = await POST(
      `${BASE}/TimeEntries`,
      {
        date: VALID_WORKDAY,
        hours: 1,
        description: "Admin closed project check",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_MOBILE,
      },
      { auth: ADMIN, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/open/i);

    await PATCH(
      `/api/manager/Projects/${PROJECT_MOBILE}`,
      { status: "O" },
      { auth: MGR1 },
    );
  });

  test("Admin cannot update a draft time entry to a non-draft status", async () => {
    const { data: created } = await POST(
      `${BASE}/TimeEntries`,
      {
        date: VALID_WORKDAY,
        hours: 1,
        description: "Admin draft policy",
        employee_ID: MGR1_ID,
        project_ID: PROJECT_CP,
      },
      { auth: ADMIN },
    );

    const { status, data } = await PATCH(
      `${BASE}/TimeEntries/${created.ID}`,
      { status: "S" },
      { auth: ADMIN, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/draft/i);
  });

  test("Admin can access Invoices, InvoiceLines and BillingPeriods", async () => {
    const invoices = await GET(`${BASE}/Invoices`, { auth: ADMIN });
    expect(invoices.status).toBe(200);

    const lines = await GET(`${BASE}/InvoiceLines`, { auth: ADMIN });
    expect(lines.status).toBe(200);

    const periods = await GET(`${BASE}/BillingPeriods`, { auth: ADMIN });
    expect(periods.status).toBe(200);
  });
});
