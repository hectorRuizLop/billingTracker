using {my.billing as db} from '../db/schema';

service AdminService @(path: '/api/admin')@(requires: 'Admin') {

    entity Employees          as projection on db.Employees;
    entity Clients            as projection on db.Clients;
    entity Projects           as projection on db.Projects;
    entity ProjectAssignments as projection on db.ProjectAssignments;
    entity TimeEntries        as projection on db.TimeEntries;
    entity Categories         as projection on db.Categories;
    entity AuditLog           as projection on db.AuditLog;
    entity Notifications      as projection on db.Notifications;

    // Create client
    annotate Clients with @(restrict: [{
        grant: '*',
        to   : 'Admin'
    }]);

    action changeEmployeeRole(employeeId: UUID, newRole: String) returns String;

    action reactivateClient(clientId: UUID)                      returns String;

}
