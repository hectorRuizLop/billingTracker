using {my.billing as db} from '../../db/schema';

service EmployeeService @(path: '/api/employee')@(requires: [
  'Employee',
  'Manager',
  'Admin'
]) {

  @restrict: [
    { grant: 'READ', to: 'Employee',           where: 'ID = $user' },
    { grant: 'READ', to: ['Manager', 'Admin'] }
  ]
  entity Employees as projection on db.Employees {
    key ID,
        firstName,
        lastName,
        email,
        role,
        isActive,
        category.name as categoryName : String
  };

  // Employees see only projects they are assigned to; Managers see projects they manage
  @readonly
  @restrict: [
    { grant: 'READ', to: 'Employee',           where: 'exists assignments[employee_ID = $user]' },
    { grant: 'READ', to: ['Manager', 'Admin'], where: 'manager_ID = $user' }
  ]
  entity MyProjects as projection on db.Projects {
    key ID,
        name,
        status,
        manager.ID        as manager_ID  : UUID,
        client.name       as clientName  : String,
        manager.firstName as managerName : String,
        assignments : redirected to MyAssignments on assignments.projectId = $self.ID
  };

  @readonly
  @restrict: [{ grant: 'READ', to: 'Employee', where: 'employee_ID = $user' }]
  entity MyAssignments as projection on db.ProjectAssignments {
    key ID,
        employee.ID  as employee_ID : UUID,
        project.name as projectName : String,
        project.ID   as projectId   : UUID,
        assignedAt,
        isActive
  };

  // Employees can read and create only their own time entries
  @restrict: [{ grant: ['READ', 'CREATE'], to: 'Employee', where: 'employee_ID = $user' }]
  entity MyTimeEntries as projection on db.TimeEntries {
    key ID,
        date,
        hours,
        description,
        status,
        rejectionNote,
        employee.ID  as employee_ID : UUID,
        project.ID   as project_ID  : UUID,
        project.name as projectName : String,
        month,
        year
  };
}
