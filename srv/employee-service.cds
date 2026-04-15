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
      where: 'ID = $user'
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
          FirstName,
          LastName,
          Email,
          Role,
          IsActive,
          category.Name as CategoryName : String
    };

  // Employees see only projects they are assigned to; Managers see projects they manage
  @readonly
  @restrict: [
    {
      grant: 'READ',
      to   : 'Employee',
      where: 'exists assignments[employee_ID = $user]'
    },
    {
      grant: 'READ',
      to   : [
        'Manager',
        'Admin'
      ],
      where: 'manager_ID = $user'
    }
  ]
  entity MyProjects    as
    projection on db.Projects {
      key ID,
          Name,
          Status,
          manager.ID        as manager_ID  : UUID,
          client.Name       as ClientName  : String,
          manager.FirstName as ManagerName : String,
          assignments                      : redirected to MyAssignments
                                               on assignments.ProjectId = $self.ID
    };

  @readonly
  @restrict: [{
    grant: 'READ',
    to   : 'Employee',
    where: 'employee_ID = $user'
  }]
  entity MyAssignments as
    projection on db.ProjectAssignments {
      key ID,
          employee.ID   as employee_ID : UUID,
          project.Name  as ProjectName : String,
          project.ID    as ProjectId   : UUID,
          AssignedAt,
          IsActive
    };

  // Employees can read and create only their own time entries
  @restrict: [{
    grant: [
      'READ',
      'CREATE'
    ],
    to   : 'Employee',
    where: 'employee_ID = $user'
  }]
  entity MyTimeEntries as
    projection on db.TimeEntries {
      key ID,
          Date,
          Hours,
          Description,
          Status,
          RejectionNote,
          employee.ID  as employee_ID : UUID,
          project.ID   as project_ID  : UUID,
          project.Name as ProjectName : String,
          Month,
          Year
    };
}
