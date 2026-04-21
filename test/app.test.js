"use strict";
process.env.NODE_ENV = "test";
process.env.TIME_ENTRY_POLICY_TODAY = "2026-04-20";

const cds = require("@sap/cds");
const { GET, POST, PATCH, DELETE } = cds.test(__dirname + "/..");

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
const CLIENT_1 = "30000000-0000-0000-0000-000000000001";
const TIME_ENTRY_SUBMITTED_EMP1 = "60000000-0000-0000-0000-000000000001";
const VALID_WORKDAY = "2026-04-10";
const SECOND_VALID_WORKDAY = "2026-04-15";
const WEEKEND_DATE = "2026-04-11";
const FUTURE_DATE = "2026-04-21";
const PREVIOUS_MONTH_WORKDAY = "2026-03-16";

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

      const { status: delStatus } = await DELETE(
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

      await DELETE(`${BASE}/Clients/${clientId}`, { auth: ADMIN });

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
        `/api/manager/Projects/${PROJECT_CP}`,
        { status: "C" },
        { auth: MGR1 },
      );

      const { status, data } = await POST(
        `${BASE}/TimeEntries`,
        {
          date: VALID_WORKDAY,
          hours: 4,
          description: "Admin closed project check",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
        },
        { auth: ADMIN, validateStatus: () => true },
      );
      expect(status).toBe(400);
      expect(data.error.message).toMatch(/open/i);

      await PATCH(
        `/api/manager/Projects/${PROJECT_CP}`,
        { status: "O" },
        { auth: MGR1 },
      );
    });

    test("Admin cannot update a draft time entry to a non-draft status", async () => {
      const { data: created } = await POST(
        `${BASE}/TimeEntries`,
        {
          date: VALID_WORKDAY,
          hours: 2,
          description: "Admin draft policy",
          employee_ID: EMP1_ID,
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
          date: VALID_WORKDAY,
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
          date: SECOND_VALID_WORKDAY,
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

  describe("TimeEntry Validations", () => {
    const BASE = "/api/employee";

    test("Rejects time entry on a weekend", async () => {
      const { status, data } = await POST(
        `${BASE}/MyTimeEntries`,
        {
          date: WEEKEND_DATE,
          hours: 4,
          description: "Saturday entry",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
        },
        { auth: EMP1, validateStatus: () => true },
      );
      expect(status).toBe(400);
      expect(data.error.message).toMatch(/weekend/i);
    });

    test("Rejects time entry with a future date", async () => {
      const { status, data } = await POST(
        `${BASE}/MyTimeEntries`,
        {
          date: FUTURE_DATE,
          hours: 4,
          description: "Future entry",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
        },
        { auth: EMP1, validateStatus: () => true },
      );
      expect(status).toBe(400);
      expect(data.error.message).toMatch(/future/i);
    });

    test("Rejects time entry from a previous month", async () => {
      const { status, data } = await POST(
        `${BASE}/MyTimeEntries`,
        {
          date: PREVIOUS_MONTH_WORKDAY,
          hours: 4,
          description: "March entry",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
        },
        { auth: EMP1, validateStatus: () => true },
      );
      expect(status).toBe(400);
      expect(data.error.message).toMatch(/current month/i);
    });

    test("Rejects time entry on a closed project", async () => {
      await PATCH(
        `/api/manager/Projects/${PROJECT_CP}`,
        { status: "C" },
        { auth: MGR1 },
      );

      const { status, data } = await POST(
        `${BASE}/MyTimeEntries`,
        {
          date: VALID_WORKDAY,
          hours: 4,
          description: "Closed project",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
        },
        { auth: EMP1, validateStatus: () => true },
      );
      expect(status).toBe(400);
      expect(data.error.message).toMatch(/open/i);

      await PATCH(
        `/api/manager/Projects/${PROJECT_CP}`,
        { status: "O" },
        { auth: MGR1 },
      );
    });

    test("Rejects update on a non-Draft time entry", async () => {
      const { status, data } = await PATCH(
        `${BASE}/MyTimeEntries/${TIME_ENTRY_SUBMITTED_EMP1}`,
        { hours: 6 },
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
          hours: 3,
          description: "Draft status guard",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
        },
        { auth: EMP1 },
      );

      const { status, data } = await PATCH(
        `${BASE}/MyTimeEntries/${created.ID}`,
        { status: "S" },
        { auth: EMP1, validateStatus: () => true },
      );
      expect(status).toBe(400);
      expect(data.error.message).toMatch(/draft/i);
    });

    test("Allows updating a Draft time entry with a valid date", async () => {
      const { data: created } = await POST(
        `${BASE}/MyTimeEntries`,
        {
          date: SECOND_VALID_WORKDAY,
          hours: 3,
          description: "Draft to update",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
        },
        { auth: EMP1 },
      );

      const { status } = await PATCH(
        `${BASE}/MyTimeEntries/${created.ID}`,
        { hours: 5, description: "Updated hours" },
        { auth: EMP1 },
      );
      expect(status).toBe(200);
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
  });

  describe("rateSnapshot", () => {
    const EMP_BASE = "/api/employee";
    const MGR_BASE = "/api/manager";

    test("Employee-created entry gets rateSnapshot from category when no customRate", async () => {
      let expectedRate = 0;
      const { data: assignments } = await GET(
        `${MGR_BASE}/ProjectAssignments?$filter=employee_ID eq '${EMP1_ID}' and project_ID eq '${PROJECT_CP}'`,
        { auth: MGR1 },
      );
      if (
        assignments &&
        assignments.value &&
        assignments.value.length > 0 &&
        assignments.value[0].customRate !== null
      ) {
        expectedRate = parseFloat(assignments.value[0].customRate);
      } else {
        const { data: emp } = await GET(`/api/admin/Employees/${EMP1_ID}`, {
          auth: ADMIN,
        });
        if (emp && emp.category_ID) {
          const { data: cat } = await GET(
            `/api/admin/Categories/${emp.category_ID}`,
            { auth: ADMIN },
          );
          expectedRate = parseFloat(cat.rate);
        }
      }

      const { data: created, status } = await POST(
        `${EMP_BASE}/MyTimeEntries`,
        {
          date: VALID_WORKDAY,
          hours: 4,
          description: "rateSnapshot category fallback",
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
        },
        { auth: EMP1 },
      );
      expect(status).toBe(201);

      const { data: entries } = await GET(
        `${MGR_BASE}/TimeEntries?$filter=ID eq '${created.ID}'`,
        { auth: MGR1 },
      );
      expect(parseFloat(entries.value[0].rateSnapshot)).toBeCloseTo(
        expectedRate,
        2,
      );
    });

    test("Manager-created entry gets rateSnapshot from category when no customRate", async () => {
      let expectedRate = 0;
      const { data: assignments } = await GET(
        `${MGR_BASE}/ProjectAssignments?$filter=employee_ID eq '${MGR1.username}' and project_ID eq '${PROJECT_CP}'`,
        { auth: MGR1 },
      );
      if (
        assignments &&
        assignments.value &&
        assignments.value.length > 0 &&
        assignments.value[0].customRate !== null
      ) {
        expectedRate = parseFloat(assignments.value[0].customRate);
      } else {
        const { data: emp } = await GET(
          `/api/admin/Employees/${MGR1.username}`,
          { auth: ADMIN },
        );
        if (emp && emp.category_ID) {
          const { data: cat } = await GET(
            `/api/admin/Categories/${emp.category_ID}`,
            { auth: ADMIN },
          );
          expectedRate = parseFloat(cat.rate);
        }
      }

      const { data: created, status } = await POST(
        `${EMP_BASE}/MyTimeEntries`,
        {
          date: VALID_WORKDAY,
          hours: 3,
          description: "manager category fallback",
          employee_ID: MGR1.username,
          project_ID: PROJECT_CP,
        },
        { auth: MGR1 },
      );
      expect(status).toBe(201);

      const { data: entries } = await GET(
        `${MGR_BASE}/TimeEntries?$filter=ID eq '${created.ID}'`,
        { auth: MGR1 },
      );
      expect(parseFloat(entries.value[0].rateSnapshot)).toBeCloseTo(
        expectedRate,
        2,
      );
    });

    test("Manager-created entry uses customRate over category rate", async () => {
      const { data: project } = await POST(
        `${MGR_BASE}/Projects`,
        {
          name: "Custom Rate Test Project",
          budget: 50000,
          client_ID: CLIENT_1,
          manager_ID: MGR1.username,
        },
        { auth: MGR1 },
      );

      const customRate = 200.0;
      await POST(
        `${MGR_BASE}/ProjectAssignments`,
        {
          employee_ID: EMP1_ID,
          project_ID: project.ID,
          customRate,
          isActive: true,
        },
        { auth: MGR1 },
      );

      const { data: created, status } = await POST(
        `${EMP_BASE}/MyTimeEntries`,
        {
          date: VALID_WORKDAY,
          hours: 2,
          description: "custom rate wins",
          employee_ID: EMP1_ID,
          project_ID: project.ID,
        },
        { auth: EMP1 },
      );
      expect(status).toBe(201);

      const { data: entries } = await GET(
        `${MGR_BASE}/TimeEntries?$filter=ID eq '${created.ID}'`,
        { auth: MGR1 },
      );
      expect(parseFloat(entries.value[0].rateSnapshot)).toBeCloseTo(
        customRate,
        2,
      );
    });
  });
});
