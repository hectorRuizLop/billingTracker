using {my.billing as db} from '../db/schema';

service AdminService @(path: '/api/admin')@(requires: 'Admin') {

  entity Employees          as projection on db.Employees;
  entity Clients            as projection on db.Clients;
  entity Projects           as projection on db.Projects;
  entity ProjectAssignments as projection on db.ProjectAssignments;

  entity TimeEntries        as
    projection on db.TimeEntries {
      *,
      @readonly rateSnapshot
    };

  entity Categories         as projection on db.Categories;
  action changeEmployeeRole(employeeId: UUID, newRole: String) returns String;
  action reactivateClient(clientId: UUID)                      returns String;

}
