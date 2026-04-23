"use strict";

const {
  cds,
  GET,
  POST,
  MGR1,
  MGR2,
  CLIENT_1,
  clearEmployeeMonthEntries,
} = require("./helpers");

describe("Time Entry Approval and Rejection", () => {
  const EMP_BASE = "/api/employee";
  const MGR_BASE = "/api/manager";
  const NEW_DATE = "2026-04-13";

  async function createApprovalProjectForMGR2() {
    await clearEmployeeMonthEntries(MGR2.username);

    const { data: project, status } = await POST(
      `${MGR_BASE}/Projects`,
      {
        name: `Approval Flow ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`,
        budget: 50000,
        client_ID: CLIENT_1,
        manager_ID: MGR1.username,
      },
      { auth: MGR1 },
    );
    expect(status).toBe(201);

    const { status: assignmentStatus } = await POST(
      `${MGR_BASE}/ProjectAssignments`,
      {
        employee_ID: MGR2.username,
        project_ID: project.ID,
        customRate: 180,
        isActive: true,
      },
      { auth: MGR1 },
    );
    expect(assignmentStatus).toBe(201);

    return project.ID;
  }

  test("Manager can approve a submitted entry", async () => {
    const projectId = await createApprovalProjectForMGR2();

    // 1. Create entry via employee
    const { data: created } = await POST(
      `${EMP_BASE}/MyTimeEntries`,
      {
        date: NEW_DATE,
        hours: 2,
        description: "approval test entry",
        employee_ID: MGR2.username,
        project_ID: projectId,
      },
      { auth: MGR2 },
    );

    // 2. Put it in Submitted state manually via DB override
    await cds.run(
      UPDATE("my.billing.TimeEntries")
        .set({ status: "S" })
        .where({ ID: created.ID }),
    );

    // 3. Manager approves
    const { status } = await POST(
      `${MGR_BASE}/approveTimeEntry`,
      { timeEntryId: created.ID },
      { auth: MGR1 },
    );
    expect(status).toBe(200);

    // 4. Verify status 'A'
    const { data: fetchEntry } = await GET(
      `${MGR_BASE}/TimeEntries/${created.ID}`,
      { auth: MGR1 },
    );
    expect(fetchEntry.status).toBe("A");
  });

  test("Rejects approval on a non-submitted entry", async () => {
    const projectId = await createApprovalProjectForMGR2();

    // Create 'D'raft entry
    const { data: created } = await POST(
      `${EMP_BASE}/MyTimeEntries`,
      {
        date: NEW_DATE,
        hours: 1,
        description: "draft test entry",
        employee_ID: MGR2.username,
        project_ID: projectId,
      },
      { auth: MGR2 },
    );

    const { status, data } = await POST(
      `${MGR_BASE}/approveTimeEntry`,
      { timeEntryId: created.ID },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/Submitted/i);
  });

  test("Manager can reject a submitted entry with justification", async () => {
    const projectId = await createApprovalProjectForMGR2();

    const { data: created } = await POST(
      `${EMP_BASE}/MyTimeEntries`,
      {
        date: NEW_DATE,
        hours: 3,
        description: "rejection test entry",
        employee_ID: MGR2.username,
        project_ID: projectId,
      },
      { auth: MGR2 },
    );
    await cds.run(
      UPDATE("my.billing.TimeEntries")
        .set({ status: "S" })
        .where({ ID: created.ID }),
    );

    const { status } = await POST(
      `${MGR_BASE}/rejectTimeEntry`,
      {
        timeEntryId: created.ID,
        rejectionNote: "This work was not authorized",
      },
      { auth: MGR1 },
    );
    expect(status).toBe(200);

    const { data: fetchEntry } = await GET(
      `${MGR_BASE}/TimeEntries/${created.ID}`,
      { auth: MGR1 },
    );
    expect(fetchEntry.status).toBe("R");
    expect(fetchEntry.rejectionNote).toBe("This work was not authorized");
    // ensure cost drops to 0
    expect(parseFloat(fetchEntry.cost)).toBe(0);
  });

  test("Rejection fails if justification is too short", async () => {
    const projectId = await createApprovalProjectForMGR2();

    const { data: created } = await POST(
      `${EMP_BASE}/MyTimeEntries`,
      {
        date: NEW_DATE,
        hours: 1,
        description: "short rejection test",
        employee_ID: MGR2.username,
        project_ID: projectId,
      },
      { auth: MGR2 },
    );
    await cds.run(
      UPDATE("my.billing.TimeEntries")
        .set({ status: "S" })
        .where({ ID: created.ID }),
    );

    const { status, data } = await POST(
      `${MGR_BASE}/rejectTimeEntry`,
      { timeEntryId: created.ID, rejectionNote: "too short" },
      { auth: MGR1, validateStatus: () => true },
    );
    expect(status).toBe(400);
    expect(data.error.message).toMatch(/10 characters/i);
  });
});
