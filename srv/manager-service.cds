using {my.billing as db} from '../db/schema';

service ManagerService @(path: '/api/manager')@(requires: 'Manager') {

  @restrict: [{
    grant: '*',
    where: 'manager.externalId = $user'
  }]
  entity Projects           as
    projection on db.Projects {
      *,
      client.name as clientName,
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
      virtual leadCost                 : Decimal(19, 4),
      virtual statusCriticality            : Integer,
      virtual budgetCriticality            : Integer,
      virtual projectedBudgetCriticality   : Integer
    };

  @restrict: [{
    grant: [
      'READ',
      'approveTimeEntry',
      'rejectTimeEntry'
    ],
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
      end                    as cost             : Decimal(19, 4), // Keep 4 decimals
      virtual null               as statusCriticality : Integer,
      
      // virtual field used to resolve the manager's human readable name 
      // instead of displaying the raw UUID stored in reviewedBy
      virtual null               as reviewerName : String
    } actions {
      // Only enable the action button when the time entry is Submitted ('S')
      @Core.OperationAvailable: { $edmJson: { $Eq: [{ $Path: 'in/status' }, 'S'] } }
      action approveTimeEntry() returns String;

      // Only enable the action button when the time entry is Submitted ('S')
      @Core.OperationAvailable: { $edmJson: { $Eq: [{ $Path: 'in/status' }, 'S'] } }
      action rejectTimeEntry(rejectionNote: String) returns String;
    };

  @restrict: [{
    grant: '*',
    where: 'project.manager.externalId = $user'
  }]
  entity ProjectAssignments as projection on db.ProjectAssignments {
    *,
    employee : redirected to Employees,
    (
      employee.firstName || ' ' || employee.lastName
    )                      as employeeName : String,
    employee.category.name as categoryName : String
  };

  // Managers can read billing periods for projects they manage
  @restrict: [{
    grant: 'READ',
    where: 'project.manager.externalId = $user'
  }]
  entity BillingPeriods     as projection on db.BillingPeriods;

  // Read-only projections for Fiori ValueHelps
  @readonly
  entity Clients            as
    projection on db.Clients {
      key ID,
          name,
          email
    }
    where isDeleted = false;

  @readonly
  entity Employees          as
    projection on db.Employees {
      key ID,
          externalId,
          firstName,
          lastName,
          (
            firstName || ' ' || lastName
          )             as fullName     : String,
          email,
          category.name as categoryName : String,
          isActive
    }
    where isActive = true;

}
