"use strict";

const {
  cds,
  EMP1_ID,
  EMP2_ID,
  MGR1_ID,
  PROJECT_CP,
  PROJECT_MOBILE,
  CLIENT_1,
} = require("./helpers");
const { MonthlyInvoiceJob } = require("../srv/jobs/monthly-invoice");

jest.mock("nodemailer");
const nodemailer = require("nodemailer");

describe("MonthlyInvoiceJob", () => {
  let sendMailMock;
  let createTransportMock;
  let logInfoMock;
  let logErrorMock;

  const SECOND_PROJECT_ID = "40000000-0000-0000-0000-000000000099";

  beforeEach(() => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: "test" });
    createTransportMock = jest.fn().mockReturnValue({
      sendMail: sendMailMock,
    });
    nodemailer.createTransport = createTransportMock;

    logInfoMock = jest.fn();
    logErrorMock = jest.fn();
    jest.spyOn(cds, "log").mockImplementation((name) => {
      if (name === "monthly-invoice") {
        return { info: logInfoMock, error: logErrorMock };
      }
      return { info: jest.fn(), error: jest.fn() };
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    await cds.run(
      DELETE.from("my.billing.TimeEntries").where({
        ID: {
          in: [
            "70000000-0000-0000-0000-000000000100",
            "70000000-0000-0000-0000-000000000101",
            "70000000-0000-0000-0000-000000000102",
            "70000000-0000-0000-0000-000000000103",
            "70000000-0000-0000-0000-000000000104",
            "70000000-0000-0000-0000-000000000105",
          ],
        },
      }),
    );
    await cds.run(
      DELETE.from("my.billing.Invoices").where({
        invoiceNumber: { like: "INV-%" },
      }),
    );
    await cds.run(
      UPDATE("my.billing.TimeEntries")
        .set({ billingStatus: "U" })
        .where({ billingStatus: { in: ["B", "I"] } }),
    );
    await cds.run(
      UPDATE("my.billing.Projects")
        .set({ status: "O" })
        .where({ ID: PROJECT_CP }),
    );
    await cds.run(
      DELETE.from("my.billing.Projects").where({
        ID: SECOND_PROJECT_ID,
      }),
    );
  });

  test("sends invoice email to client with approved hours breakdown", async () => {
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2026-03-10",
          hours: 8,
          description: "Design work",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
        {
          ID: "70000000-0000-0000-0000-000000000101",
          date: "2026-03-11",
          hours: 6,
          description: "Development",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP2_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob();
    const result = await job.run(new Date("2026-04-01"));

    expect(result.sent).toBe(1);
    expect(result.clients).toContain("contacto@techcorp.mx");
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe("contacto@techcorp.mx");
    expect(call.subject).toBe("Monthly Invoice Summary - 3/2026");
    expect(call.text).toMatch(/TechCorp SA de CV/);
    expect(call.text).toMatch(/Customer Portal/);
    expect(call.text).toMatch(/14\.00h/);
    expect(call.text).toMatch(/€630\.00/);
  });

  test("does not invoice client when any of their projects has pending entries", async () => {
    await cds.run(
      INSERT.into("my.billing.Projects").entries({
        ID: SECOND_PROJECT_ID,
        name: "Second Project",
        status: "O",
        budget: 100000,
        client_ID: CLIENT_1,
        manager_ID: MGR1_ID,
      }),
    );

    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2026-03-10",
          hours: 8,
          description: "Approved work on first project",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
        {
          ID: "70000000-0000-0000-0000-000000000101",
          date: "2026-03-11",
          hours: 5,
          description: "Draft work on second project",
          status: "D",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: SECOND_PROJECT_ID,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob();
    const result = await job.run(new Date("2026-04-01"));

    expect(result.sent).toBe(0);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  test("skips projects with pending draft or submitted entries", async () => {
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2026-03-10",
          hours: 8,
          description: "Design work",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
        {
          ID: "70000000-0000-0000-0000-000000000101",
          date: "2026-03-11",
          hours: 6,
          description: "Development",
          status: "S",
          rateSnapshot: 45.0,
          employee_ID: EMP2_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob();
    const result = await job.run(new Date("2026-04-01"));

    expect(result.sent).toBe(0);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  test("includes closed projects even with pending entries logic", async () => {
    await cds.run(
      UPDATE("my.billing.Projects")
        .set({ status: "C" })
        .where({ ID: PROJECT_CP }),
    );

    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2026-03-10",
          hours: 8,
          description: "Design work",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob();
    const result = await job.run(new Date("2026-04-01"));

    expect(result.sent).toBe(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  test("returns empty when no unbilled entries exist for previous month", async () => {
    const job = new MonthlyInvoiceJob();
    const result = await job.run(new Date("2026-01-01"));

    expect(result.sent).toBe(0);
    expect(result.clients).toEqual([]);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  test("uses provided transporter instead of creating one", async () => {
    const customSendMail = jest.fn().mockResolvedValue({ messageId: "custom" });
    const customTransporter = { sendMail: customSendMail };

    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2026-03-10",
          hours: 8,
          description: "Design work",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob({ transporter: customTransporter });
    await job.run(new Date("2026-04-01"));

    expect(createTransportMock).not.toHaveBeenCalled();
    expect(customSendMail).toHaveBeenCalledTimes(1);
  });

  test("creates invoice in Draft and promotes to Sent after email", async () => {
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2026-03-10",
          hours: 8,
          description: "Design work",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob();
    await job.run(new Date("2026-04-01"));

    const invoices = await cds.run(
      SELECT.from("my.billing.Invoices").where({ client_ID: CLIENT_1 }),
    );

    expect(invoices.length).toBeGreaterThanOrEqual(1);
    const invoice = invoices.find((i) => i.invoiceNumber.includes("202603"));
    expect(invoice).toBeDefined();
    expect(invoice.status).toBe("S");
    expect(parseFloat(invoice.subtotal)).toBeCloseTo(360, 2);

    const lines = await cds.run(
      SELECT.from("my.billing.InvoiceLines").where({
        invoice_ID: invoice.ID,
      }),
    );

    expect(lines.length).toBe(1);
    expect(parseFloat(lines[0].hours)).toBe(8);
    expect(parseFloat(lines[0].amount)).toBeCloseTo(360, 2);
  });

  // Covers the case where email sending fails after invoice creation
  test("keeps invoice in Draft and hours as Billed when email fails", async () => {
    sendMailMock.mockRejectedValue(new Error("SMTP error"));

    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2026-03-10",
          hours: 8,
          description: "Design work",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob();
    const result = await job.run(new Date("2026-04-01"));

    expect(result.sent).toBe(0);
    expect(logErrorMock).toHaveBeenCalled();

    const invoice = await cds.run(
      SELECT.one
        .from("my.billing.Invoices")
        .where({ client_ID: CLIENT_1 })
        .columns("status"),
    );

    expect(invoice).toBeDefined();
    expect(invoice.status).toBe("D");

    const entry = await cds.run(
      SELECT.one
        .from("my.billing.TimeEntries")
        .where({ ID: "70000000-0000-0000-0000-000000000100" })
        .columns("billingStatus"),
    );

    expect(entry.billingStatus).toBe("B");
  });

  // TEST NUEVO: cubre el reintento automático
  test("retries draft invoices on subsequent runs", async () => {
    const draftInvoiceId = "80000000-0000-0000-0000-000000000001";
    await cds.run(
      INSERT.into("my.billing.Invoices").entries({
        ID: draftInvoiceId,
        invoiceNumber: `INV-${CLIENT_1.substring(0, 8)}-202603`,
        issueDate: "2026-04-01",
        status: "D",
        currency: "EUR",
        subtotal: 360,
        total: 360,
        client_ID: CLIENT_1,
      }),
    );

    await cds.run(
      INSERT.into("my.billing.InvoiceLines").entries({
        ID: "90000000-0000-0000-0000-000000000001",
        invoice_ID: draftInvoiceId,
        timeEntry_ID: "60000000-0000-0000-0000-000000000001",
        description: "Prior month entry",
        hours: 8,
        rateSnapshot: 45.0,
        amount: 360,
      }),
    );

    const job = new MonthlyInvoiceJob();
    const result = await job.run(new Date("2026-04-01"));

    expect(result.sent).toBe(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const invoice = await cds.run(
      SELECT.one
        .from("my.billing.Invoices")
        .where({ ID: draftInvoiceId })
        .columns("status"),
    );

    expect(invoice.status).toBe("S");
  });

  test("updates time entry billing status to Invoiced after successful email", async () => {
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2026-03-10",
          hours: 8,
          description: "Design work",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob();
    await job.run(new Date("2026-04-01"));

    const entry = await cds.run(
      SELECT.one
        .from("my.billing.TimeEntries")
        .where({ ID: "70000000-0000-0000-0000-000000000100" })
        .columns("billingStatus"),
    );

    expect(entry.billingStatus).toBe("I");
  });

  // Duplicates prevention test
  test("does not create duplicate invoice for same client-month", async () => {
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2026-03-10",
          hours: 8,
          description: "Design work",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob();
    await job.run(new Date("2026-04-01"));
    await job.run(new Date("2026-04-01"));

    const invoices = await cds.run(
      SELECT.from("my.billing.Invoices").where({ client_ID: CLIENT_1 }),
    );

    expect(invoices.length).toBe(1);
  });

  test("sends emails to multiple clients with their respective projects", async () => {
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2026-03-10",
          hours: 8,
          description: "Design work",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
        {
          ID: "70000000-0000-0000-0000-000000000101",
          date: "2026-03-11",
          hours: 5,
          description: "Mobile dev",
          status: "A",
          rateSnapshot: 50.0,
          employee_ID: EMP2_ID,
          project_ID: PROJECT_MOBILE,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob();
    const result = await job.run(new Date("2026-04-01"));

    expect(result.sent).toBe(2);

    const techCorpCall = sendMailMock.mock.calls.find(
      (call) => call[0].to === "contacto@techcorp.mx",
    );
    expect(techCorpCall[0].text).toMatch(/Customer Portal/);

    const dataSoftCall = sendMailMock.mock.calls.find(
      (call) => call[0].to === "info@datasoft.io",
    );
    expect(dataSoftCall[0].text).toMatch(/Sales Mobile App/);
  });

  test("handles year rollover for January", async () => {
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2025-12-15",
          hours: 8,
          description: "Year-end work",
          status: "A",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 12,
          year: 2025,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob();
    const result = await job.run(new Date("2026-01-01"));

    expect(result.sent).toBe(1);

    const call = sendMailMock.mock.calls[0][0];
    expect(call.subject).toBe("Monthly Invoice Summary - 12/2025");
  });

  test("shows zero cost for projects with only rejected entries", async () => {
    await cds.run(
      INSERT.into("my.billing.TimeEntries").entries([
        {
          ID: "70000000-0000-0000-0000-000000000100",
          date: "2026-03-10",
          hours: 8,
          description: "Rejected work",
          status: "R",
          rateSnapshot: 45.0,
          employee_ID: EMP1_ID,
          project_ID: PROJECT_CP,
          month: 3,
          year: 2026,
          billingStatus: "U",
        },
      ]),
    );

    const job = new MonthlyInvoiceJob();
    const result = await job.run(new Date("2026-04-01"));

    expect(result.sent).toBe(1);

    const call = sendMailMock.mock.calls[0][0];
    expect(call.text).toMatch(/Customer Portal/);
    expect(call.text).toMatch(/0\.00h/);
    expect(call.text).toMatch(/€0\.00/);
  });
});