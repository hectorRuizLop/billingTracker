using {my.billing as db} from '../db/schema';

service AdminService @(path: '/api/admin')@(requires: 'Admin') {

  entity Employees          as
    projection on db.Employees {
      *,
      category.name as categoryName : String,
      (firstName || ' ' || lastName) as fullName : String,
      case role
        when 'E' then 'Employee'
        when 'M' then 'Manager'
        when 'A' then 'Admin'
      end as roleText : String
    };

  entity Clients            as projection on db.Clients;

  entity Projects           as
    projection on db.Projects {
      *,
      client.name as clientName : String
    };

  entity ProjectAssignments as
    projection on db.ProjectAssignments {
      *,
      (employee.firstName || ' ' || employee.lastName) as employeeName : String,
      project.name as projectName : String
    };

  entity TimeEntries        as
    projection on db.TimeEntries {
      *,
      @readonly year         : String,
      @readonly rateSnapshot : Decimal(15, 2),
      @readonly billingStatus,
      @readonly reviewedAt,
      @readonly reviewedBy,
      @readonly rejectionNote,
      @readonly month,
      (employee.firstName || ' ' || employee.lastName) as employeeName : String,
      project.name as projectName : String,
      case when status = 'R' then 0 else (hours * rateSnapshot) end as cost : Decimal(19, 4)
    };

  entity Categories         as projection on db.Categories;
  entity Notifications      as projection on db.Notifications;

  entity Invoices           as
    projection on db.Invoices {
      *,
      client.name as clientName : String
    };

  entity InvoiceLines       as
    projection on db.InvoiceLines {
      *
    };

  entity BillingPeriods     as projection on db.BillingPeriods;

  action changeEmployeeRole(employeeId: UUID, newRole: String) returns String;
  action reactivateClient(clientId: UUID)                      returns String;

}
