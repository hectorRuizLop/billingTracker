using {my.billing as db} from '../db/schema';

service ManagerService @(path: '/api/manager')@(requires: 'Manager') {

  @restrict: [{
    grant: '*',
    where: 'manager.externalId = $user'
  }]
  entity Projects           as
    projection on db.Projects {
      *,
      virtual totalHours               : Decimal(15, 2),
      virtual totalCost                : Decimal(19, 4), // Preserve decimals in aggregates
      virtual budgetRemaining          : Decimal(19, 4), // Avoid rounding cascade
      virtual avgCostPerHour           : Decimal(19, 4), // Intermediate calc accuracy
      virtual projectedTotalHours      : Decimal(15, 2),
      virtual projectedTotalCost       : Decimal(19, 4),
      virtual projectedBudgetRemaining : Decimal(19, 4),
      virtual submittedHours           : Decimal(15, 2),
      virtual submittedCost            : Decimal(19, 4),
      virtual juniorHours              : Decimal(15, 2),
      virtual juniorCost               : Decimal(19, 4),
      virtual midLevelHours            : Decimal(15, 2),
      virtual midLevelCost             : Decimal(19, 4),
      virtual seniorHours              : Decimal(15, 2),
      virtual seniorCost               : Decimal(19, 4),
      virtual leadHours                : Decimal(15, 2),
      virtual leadCost                 : Decimal(19, 4)
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
      @readonly status,
      @readonly billingStatus,
      @readonly reviewedAt,
      @readonly reviewedBy,
      @readonly rejectionNote,
      case
        status
        when 'R'
             then 0
        else (
               hours * rateSnapshot
             )
      end                    as cost         : Decimal(19, 4) // Keep 4 decimals
    };

  @restrict: [{
    grant: '*',
    where: 'project.manager.externalId = $user'
  }]
  entity ProjectAssignments as projection on db.ProjectAssignments;

  // Managers can read billing periods for projects they manage
  @restrict: [{
    grant: 'READ',
    where: 'project.manager.externalId = $user'
  }]
  entity BillingPeriods     as projection on db.BillingPeriods;

  action approveTimeEntry(timeEntryId: UUID)                       returns String;
  action rejectTimeEntry(timeEntryId: UUID, rejectionNote: String) returns String;

}
