using {my.billing as db} from '../db/schema';

service ManagerService @(path: '/api/manager')@(requires: 'Manager') {

  @restrict: [{
    grant: '*',
    where: 'manager.externalId = $user'
  }]
  entity Projects           as projection on db.Projects;

  @restrict: [{
    grant: 'READ',
    where: 'project.manager.externalId = $user'
  }]
  entity TimeEntries        as
    projection on db.TimeEntries {
      *,
      (
        employee.firstName || ' ' || employee.lastName
      )                      as employeeName : String,
      employee.category.name as categoryName,
      project.name           as projectName,
      hours * rateSnapshot   as cost         : Decimal(15, 2)
    };

  @restrict: [{
    grant: '*',
    where: 'project.manager.externalId = $user'
  }]
  entity ProjectAssignments as projection on db.ProjectAssignments;

}
