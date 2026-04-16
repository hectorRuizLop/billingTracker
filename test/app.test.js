"use strict";

const cds = require("@sap/cds");
const { GET, POST, PATCH } = cds.test(__dirname + "/..");

const ADMIN = {
  username: "20000000-0000-0000-0000-000000000005",
  password: "pass",
};
const EMP1 = {
  username: "20000000-0000-0000-0000-000000000001",
  password: "pass",
};
const EMP2 = {
  username: "20000000-0000-0000-0000-000000000002",
  password: "pass",
};
const MGR1 = {
  username: "20000000-0000-0000-0000-000000000003",
  password: "pass",
};
const MGR2 = {
  username: "20000000-0000-0000-0000-000000000004",
  password: "pass",
};

const EMP1_ID = "20000000-0000-0000-0000-000000000001";
const PROJECT_CP = "40000000-0000-0000-0000-000000000001";
const PROJECT_ERP = "40000000-0000-0000-0000-000000000002";
const ASSIGNMENT_1 = "50000000-0000-0000-0000-000000000001";

describe("Billing Tracker - Integration Tests", () => {
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

    // COMENTADO: AuditLogs manual eliminado, sustituido por @cap-js/audit-logging.
    // El plugin registra automáticamente los cambios en entidades anotadas con @PersonalData.
    // test("Creating a client writes an AuditLog entry", async () => {
    //   const clientName = "Audit Target Corp";
    //   await POST(
    //     `${BASE}/Clients`,
    //     { name: clientName, email: "audit@nubexx.com" },
    //     { auth: ADMIN },
    //   );
    //   const { data } = await GET(
    //     `${BASE}/AuditLogs?$filter=entityName eq 'Clients'&$orderby=timestamp desc&$top=1`,
    //     { auth: ADMIN },
    //   );
    //   expect(data.value).toHaveLength(1);
    //   expect(data.value[0].action).toBe("CREATE");
    // });
  });

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
      const { data, status } = await POST(
        `${BASE}/MyTimeEntries`,
        {
          date: "2026-04-10",
          hours: 6,
          description: "Unit test entry",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
        },
        { auth: EMP1 },
      );
      expect(status).toBe(201);
      expect(data.ID).toBeTruthy();
    });

    test("EMP2 cannot read a time entry owned by EMP1", async () => {
      const { data: created } = await POST(
        `${BASE}/MyTimeEntries`,
        {
          date: "2026-04-12",
          hours: 2,
          description: "Private",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
        },
        { auth: EMP1 },
      );
      const res = await GET(`${BASE}/MyTimeEntries/${created.ID}`, {
        auth: EMP2,
        validateStatus: () => true,
      });
      expect(res.status).toBe(404);
    });
  });

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

    test("Time entries expose computed fields: EmployeeName and Cost", async () => {
      const { data } = await GET(
        `${BASE}/TimeEntries?$select=ID,hours,rateSnapshot,employeeName,cost`,
        { auth: MGR1 },
      );
      if (data.value.length > 0) {
        const entry = data.value[0];
        expect(typeof entry.employeeName).toBe("string");
        if (entry.rateSnapshot !== null && entry.hours !== null) {
          expect(entry.cost).toBeCloseTo(entry.hours * entry.rateSnapshot, 2);
        }
      }
    });
  });
});
