"use strict";

const cds = require("@sap/cds");
const { GET, POST, PATCH, DELETE: HTTP_DELETE } = cds.test(__dirname + "/..");

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
const MGR1_ID = "20000000-0000-0000-0000-000000000003";
const PROJECT_CP = "40000000-0000-0000-0000-000000000001";
const PROJECT_ERP = "40000000-0000-0000-0000-000000000002";
const PROJECT_MOBILE = "40000000-0000-0000-0000-000000000003";
const ASSIGNMENT_1 = "50000000-0000-0000-0000-000000000001";
const CLIENT_1 = "30000000-0000-0000-0000-000000000001";
const TIME_ENTRY_SUBMITTED_EMP1 = "60000000-0000-0000-0000-000000000001";
const VALID_WORKDAY = "2026-04-10";
const SECOND_VALID_WORKDAY = "2026-04-15";
const WEEKEND_DATE = "2026-04-11";
const FUTURE_DATE = "2026-04-21";
const PREVIOUS_MONTH_WORKDAY = "2026-03-16";

async function clearEmployeeMonthEntries(employeeId, year = 2026, month = 4) {
  await cds.run(
    DELETE.from("my.billing.TimeEntries").where({
      employee_ID: employeeId,
      year,
      month,
    }),
  );
}

module.exports = {
  cds,
  GET,
  POST,
  PATCH,
  HTTP_DELETE,
  ADMIN,
  EMP1,
  EMP2,
  MGR1,
  MGR2,
  EMP1_ID,
  MGR1_ID,
  PROJECT_CP,
  PROJECT_ERP,
  PROJECT_MOBILE,
  ASSIGNMENT_1,
  CLIENT_1,
  TIME_ENTRY_SUBMITTED_EMP1,
  VALID_WORKDAY,
  SECOND_VALID_WORKDAY,
  WEEKEND_DATE,
  FUTURE_DATE,
  PREVIOUS_MONTH_WORKDAY,
  clearEmployeeMonthEntries,
};
