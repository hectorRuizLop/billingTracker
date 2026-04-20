using {my.billing as db} from '../db/schema';

service EmployeeService @(path: '/api/employee')@(requires: [
  'Employee',
  'Manager',
  'Admin'
]) {

  @restrict: [
    {
      grant: 'READ',
      to   : 'Employee',
      where: 'externalId = $user'
    },
    {
      grant: 'READ',
      to   : [
        'Manager',
        'Admin'
      ]
    }
  ]
  entity Employees     as
    projection on db.Employees {
      key ID,
          externalId,
          firstName,
          lastName,
          email,
          role,
          isActive,
          category.name as categoryName : String
    };

  @readonly
  @restrict: [{
    grant: 'READ',
    to   : 'Employee',
    where: 'employeeExternalId = $user'
  }]
  entity MyAssignments as
    projection on db.ProjectAssignments {
      key ID,
          employee.ID         as employee_ID        : UUID,
          employee.externalId as employeeExternalId : String,
          project.name        as projectName        : String,
          project.ID          as projectId          : UUID,
          assignedAt,
          isActive
    };

  // Employees see only projects they are assigned to; Managers see projects they manage
  @readonly
  @restrict: [
    {
      grant: 'READ',
      to   : 'Employee',
      where: 'exists assignments[employeeExternalId = $user]'
    },
    {
      grant: 'READ',
      to   : [
        'Manager',
        'Admin'
      ],
      where: 'managerExternalId = $user'
    }
  ]
  entity MyProjects    as
    projection on db.Projects {
      key ID,
          name,
          status,
          manager.ID         as manager_ID        : UUID,
          manager.externalId as managerExternalId : String,
          client.name        as clientName        : String,
          manager.firstName  as managerName       : String,
          assignments                             : redirected to MyAssignments
                                                      on assignments.projectId = $self.ID
    };

  // Employees can read and create only their own time entries
  @restrict: [{
    grant: [
      'READ',
      'CREATE',
      'UPDATE'
    ],
    to   : 'Employee',
    where: 'employeeExternalId = $user'
  }]
  entity MyTimeEntries as
    projection on db.TimeEntries {
      key ID,
          date,
          hours,
          description,
          status,
          rejectionNote,
          employee.ID         as employee_ID        : UUID,
          employee.externalId as employeeExternalId : String,
          project.ID          as project_ID         : UUID,
          project.name        as projectName        : String,
          month,
          year,
          @readonly rateSnapshot
    };
}
