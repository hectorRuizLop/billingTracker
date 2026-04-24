using {my.billing as db} from '../db/schema';

service ManagerService @(path: '/api/manager')@(requires: 'Manager') {

  @restrict: [{
    grant: '*',
    where: 'manager.externalId = $user'
  }]
  entity Projects           as
    projection on db.Projects {
      *,
      virtual totalHours      : Decimal(15, 2),
      virtual totalCost       : Decimal(15, 2),
      virtual budgetRemaining : Decimal(15, 2),
      virtual avgCostPerHour  : Decimal(15, 2)
    };

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
      @readonly rateSnapshot,
      case
        status
        when 'R'
             then 0
        else (
               hours * rateSnapshot
             )
      end                    as cost         : Decimal(15, 2)
    };

  @restrict: [{
    grant: '*',
    where: 'project.manager.externalId = $user'
  }]
  entity ProjectAssignments as projection on db.ProjectAssignments;

  action approveTimeEntry(timeEntryId: UUID)                       returns String;
  action rejectTimeEntry(timeEntryId: UUID, rejectionNote: String) returns String;

}
