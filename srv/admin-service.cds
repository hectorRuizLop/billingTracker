using {my.billing as db} from '../db/schema';

service AdminService @(path: '/api/admin')@(requires: 'Admin') {

  entity Employees          as projection on db.Employees;
  entity Clients            as projection on db.Clients;
  entity Projects           as projection on db.Projects;
  entity ProjectAssignments as projection on db.ProjectAssignments;

  entity TimeEntries        as
    projection on db.TimeEntries {
      *,
      @readonly rateSnapshot,
      @readonly billingStatus,
      @readonly reviewedAt,
      @readonly reviewedBy,
      @readonly rejectionNote,
      @readonly month,
      @readonly year
    };

  entity Categories         as projection on db.Categories;
  entity Notifications      as projection on db.Notifications;

  entity Invoices           as projection on db.Invoices;
  entity InvoiceLines       as projection on db.InvoiceLines;
  entity BillingPeriods     as projection on db.BillingPeriods;

  action changeEmployeeRole(employeeId: UUID, newRole: String) returns String;
  action reactivateClient(clientId: UUID)                      returns String;

}
