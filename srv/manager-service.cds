using {my.billing as db} from '../db/schema';

service ManagerService @(path: '/api/manager')@(requires: 'Manager') {

  @restrict: [{
    grant: '*',
    where: 'manager_ID = $user'
  }]
  entity Projects           as projection on db.Projects;

  @restrict: [{
    grant: 'READ',
    where: 'project.manager_ID = $user'
  }]
  entity TimeEntries        as
    projection on db.TimeEntries {
      *,
      (
        employee.FirstName || ' ' || employee.LastName
      )                      as EmployeeName : String,
      employee.category.Name as CategoryName,
      project.Name           as ProjectName,
      Hours * RateSnapshot   as Cost         : Decimal(15, 2)
    };

  @restrict: [{
    grant: '*',
    where: 'project.manager_ID = $user'
  }]
  entity ProjectAssignments as projection on db.ProjectAssignments;

}
