using { my.billing as db } from '../db/schema';

service EmployeeService @(path: '/api/employee')
  @(requires: ['Employee', 'Manager', 'Admin']) {

  @readonly
  entity MyProjects as projection on db.Projects {
    key ID,
    name,
    status,
    client.name    as clientName  : String,
    manager.firstName as managerName : String
  };

  @readonly
  entity MyAssignments as projection on db.ProjectAssignments {
    key ID,
    project.name as projectName : String,
    project.ID   as projectId   : UUID,
    assignedAt,
    isActive
  };
}
