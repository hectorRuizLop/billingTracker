namespace my.billing;

using {
  cuid,
  managed
} from '@sap/cds/common';

type CategoryCode    : String(1) enum {
  Junior = 'J';
  MidLevel = 'M';
  Senior = 'S';
  Lead = 'L';
}

type TimeEntryStatus : String(1) enum {
  Draft = 'D';
  Submitted = 'S';
  Approved = 'A';
  Rejected = 'R';
}

type ProjectStatus   : String(1) enum {
  Open = 'O';
  Closed = 'C';
}

type UserRole        : String(1) enum {
  Employee = 'E';
  Manager = 'M';
  Admin = 'A';
}

entity Categories : cuid {
  code        : CategoryCode   @mandatory;
  name        : String(50)     @mandatory;
  rate        : Decimal(10, 2) @mandatory;
  description : String(200);
}

@PersonalData.EntitySemantics: 'DataSubject'
entity Employees : cuid, managed {
      @PersonalData.FieldSemantics: 'DataSubjectID'
  key ID              : UUID;

      @PersonalData.IsPotentiallyPersonal
      firstName       : String(50)  @mandatory;

      @PersonalData.IsPotentiallyPersonal
      lastName        : String(50)  @mandatory;

      @PersonalData.IsPotentiallyPersonal
      email           : String(100) @mandatory;

      @PersonalData.IsPotentiallyPersonal
      phone           : String(20);
      role            : UserRole default 'E';
      isActive        : Boolean default true;
      externalId      : String(255);

      category        : Association to Categories;
      assignments     : Association to many ProjectAssignments
                          on assignments.employee = $self;
      timeEntries     : Association to many TimeEntries
                          on timeEntries.employee = $self;
      managedProjects : Association to many Projects
                          on managedProjects.manager = $self;
}

@PersonalData.EntitySemantics: 'DataSubject'
entity Clients : cuid, managed {
      @PersonalData.FieldSemantics: 'DataSubjectID'
  key ID          : UUID;

      @PersonalData.IsPotentiallyPersonal
      name        : String(100) @mandatory;

      @PersonalData.IsPotentiallyPersonal
      email       : String(100) @mandatory;

      @PersonalData.IsPotentiallyPersonal
      phone       : String(20);
      address     : String(300);
      taxId       : String(20);

      @PersonalData.IsPotentiallyPersonal
      contactName : String(100);
      notes       : String(500);
      isDeleted   : Boolean default false;
      deletedAt   : Timestamp;
      deletedBy   : String;

      projects    : Association to many Projects
                      on projects.client = $self;
}

entity Projects : cuid, managed {
  name        : String(150)              @mandatory;
  description : String(500);
  status      : ProjectStatus default 'O';
  budget      : Decimal(15, 2)           @mandatory;
  startDate   : Date;
  endDate     : Date;
  closedAt    : Timestamp;
  closedBy    : String;

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
  assignedAt : Date default $now;
  isActive   : Boolean default true;
  customRate : Decimal(10, 2); // Allows a manager to assign a worker with a different rate
}

entity TimeEntries : cuid, managed {
  date          : Date                     @mandatory;
  hours         : Decimal(4, 2)            @mandatory;
  description   : String(500);

  status        : TimeEntryStatus default 'D';
  reviewedAt    : Timestamp;
  reviewedBy    : String;
  rejectionNote : String(500);

  rateSnapshot  : Decimal(10, 2);

  employee      : Association to Employees @mandatory;
  project       : Association to Projects  @mandatory;

  month         : Integer;
  year          : Integer;
}
