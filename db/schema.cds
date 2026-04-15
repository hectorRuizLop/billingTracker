namespace my.billing;

using {
  cuid,
  managed
} from '@sap/cds/common';

type CategoryCode    : String(1) enum {
  Junior   = 'J';
  MidLevel = 'M';
  Senior   = 'S';
  Lead     = 'L';
}

type TimeEntryStatus : String(1) enum {
  Draft     = 'D';
  Submitted = 'S';
  Approved  = 'A';
  Rejected  = 'R';
}

type ProjectStatus   : String(1) enum {
  Open   = 'O';
  Closed = 'C';
}

type UserRole        : String(1) enum {
  Employee = 'E';
  Manager  = 'M';
  Admin    = 'A';
}

entity Categories : cuid {
  Code        : CategoryCode   @mandatory;
  Name        : String(50)     @mandatory;
  Rate        : Decimal(10, 2) @mandatory;
  Description : String(200);
}

entity Employees : cuid, managed {
  FirstName       : String(50)  @mandatory;
  LastName        : String(50)  @mandatory;
  Email           : String(100) @mandatory;
  Phone           : String(20);
  Role            : UserRole default 'E';
  IsActive        : Boolean default true;

  category        : Association to Categories;
  assignments     : Association to many ProjectAssignments
                      on assignments.employee = $self;
  timeEntries     : Association to many TimeEntries
                      on timeEntries.employee = $self;
  managedProjects : Association to many Projects
                      on managedProjects.manager = $self;
}

entity Clients : cuid, managed {
  Name        : String(100) @mandatory;
  Email       : String(100) @mandatory;
  Phone       : String(20);
  Address     : String(300);
  TaxId       : String(20);
  ContactName : String(100);
  Notes       : String(500);
  IsDeleted   : Boolean default false;
  DeletedAt   : Timestamp;
  DeletedBy   : String;

  projects    : Association to many Projects
                  on projects.client = $self;
}

entity Projects : cuid, managed {
  Name        : String(150)              @mandatory;
  Description : String(500);
  Status      : ProjectStatus default 'O';
  Budget      : Decimal(15, 2)           @mandatory;
  StartDate   : Date;
  EndDate     : Date;
  ClosedAt    : Timestamp;
  ClosedBy    : String;

  client      : Association to Clients   @mandatory;
  manager     : Association to Employees @mandatory;

  assignments : Composition of many ProjectAssignments
                  on assignments.project = $self;
  timeEntries : Composition of many TimeEntries
                  on timeEntries.project = $self;
}

entity ProjectAssignments : cuid, managed {
  project    : Association to Projects  @mandatory;
  employee   : Association to Employees @mandatory;
  AssignedAt : Date default $now;
  IsActive   : Boolean default true;
  CustomRate : Decimal(10, 2); // Allows a manager to assign a worker with a different rate
}

entity TimeEntries : cuid, managed {
  Date          : Date                     @mandatory;
  Hours         : Decimal(4, 2)            @mandatory;
  Description   : String(500);

  Status        : TimeEntryStatus default 'D';
  ReviewedAt    : Timestamp;
  ReviewedBy    : String;
  RejectionNote : String(500);

  RateSnapshot  : Decimal(10, 2);

  employee      : Association to Employees @mandatory;
  project       : Association to Projects  @mandatory;

  Month         : Integer;
  Year          : Integer;
}

entity AuditLogs : cuid {
  Timestamp  : Timestamp @cds.on.insert: $now;
  User       : String(100);
  Action     : String(20); // CREATE, UPDATE, DELETE
  EntityName : String(100);
  EntityId   : String(36);
  Field      : String(50);
  OldValue   : String(500);
  NewValue   : String(500);
  Description: String(500);
}

entity Notifications : cuid {
  SentAt          : Timestamp @cds.on.insert: $now;
  Type            : String(50);
  Recipient       : String(100);
  Subject         : String(200);
  Body            : LargeString;
  Status          : String(1) default 'P'; // P=Pending, S=Sent, F=Failed
  ErrorMessage    : String(500);
  RetryCount      : Integer default 0;

  relatedProject  : Association to Projects;
  relatedEmployee : Association to Employees;
}
