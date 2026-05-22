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
      virtual totalHours                 : Decimal(15, 2),
      virtual totalCost                  : Decimal(19, 2), // Display with 2 decimals
      virtual budgetRemaining            : Decimal(19, 2),
      virtual avgCostPerHour             : Decimal(19, 2),
      virtual projectedTotalHours        : Decimal(15, 2),
      virtual projectedTotalCost         : Decimal(19, 2),
      virtual projectedBudgetRemaining   : Decimal(19, 2),
      virtual submittedHours             : Decimal(15, 2),
      virtual submittedCost              : Decimal(19, 2),
      virtual juniorHours                : Decimal(15, 2),
      virtual juniorCost                 : Decimal(19, 2),
      virtual midLevelHours              : Decimal(15, 2),
      virtual midLevelCost               : Decimal(19, 2),
      virtual seniorHours                : Decimal(15, 2),
      virtual seniorCost                 : Decimal(19, 2),
      virtual leadHours                  : Decimal(15, 2),
      virtual leadCost                   : Decimal(19, 2),
      virtual statusCriticality          : Integer,
      virtual budgetCriticality          : Integer,
      virtual projectedBudgetCriticality : Integer,
      categoryStats : Association to many CategoryStats on categoryStats.project_ID = ID
    };

  @restrict: [{
    grant: [
      'READ',
      'approveTimeEntry',
      'rejectTimeEntry'
    ],
    where: 'project.manager.externalId = $user'
  }]
  @Aggregation.ApplySupported: {
    Transformations: ['aggregate', 'groupby'],
    Rollup: #None
  }
  @cds.redirection.target
  entity TimeEntries        as
    projection on db.TimeEntries {
      *,
      @readonly year                              : String,
      @readonly rateSnapshot                      : Decimal(15, 2),
      (
        employee.firstName || ' ' || employee.lastName
      )                      as employeeName      : String,
      @Analytics.Dimension: true
      employee.category.name as categoryName,
      project.name           as projectName,
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
      end                    as cost              : Decimal(19, 2), // Display with 2 decimals
      @Analytics.Measure: true
      @Aggregation.default: #SUM
      hours,
      virtual null           as statusCriticality : Integer,

      // virtual field used to resolve the manager's human readable name
      // instead of displaying the raw UUID stored in reviewedBy
      virtual null           as reviewerName      : String,
      case status
        when 'D' then 'Draft'
        when 'S' then 'Submitted'
        when 'A' then 'Approved'
        when 'R' then 'Rejected'
      end                    as statusText          : String
    }
    actions {
      // Only enable the action button when the time entry is Submitted ('S')
      @Core.OperationAvailable: {$edmJson: {$Eq: [
        {$Path: 'in/status'},
        'S'
      ]}}
      action approveTimeEntry()                     returns String;

      // Only enable the action button when the time entry is Submitted ('S')
      @Core.OperationAvailable: {$edmJson: {$Eq: [
        {$Path: 'in/status'},
        'S'
      ]}}
      action rejectTimeEntry(rejectionNote: String) returns String;
    };

  @restrict: [{
    grant: '*',
    where: 'project.manager.externalId = $user'
  }]
  entity ProjectAssignments as
    projection on db.ProjectAssignments {
      *,
      employee                               : redirected to Employees,
      (
        employee.firstName || ' ' || employee.lastName
      )                      as employeeName : String,
      employee.category.name as categoryName : String,
      // isActiveCriticality removed — handled via UI formatting
    };

  // Managers can read billing periods for projects they manage
  @restrict: [{
    grant: 'READ',
    where: 'project.manager.externalId = $user'
  }]
  entity BillingPeriods     as projection on db.BillingPeriods;

  // Pre-aggregated category hours per project — avoids SQLite $apply limitation
  @readonly
  entity CategoryStats      as projection on db.ProjectCategoryStats;

  // Read-only projections for Fiori ValueHelps
  @readonly
  entity Clients            as
    projection on db.Clients {
      key ID,
          name,
          email
    }
    where
      isDeleted = false;

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
    where
      isActive = true;

  action approveTimeEntries(timeEntryIds : array of UUID) returns String;
  action rejectTimeEntries(timeEntryIds : array of UUID, rejectionNote : String) returns String;

}
