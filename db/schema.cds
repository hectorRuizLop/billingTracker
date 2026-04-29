namespace my.billing;

using {
  cuid,
  managed
} from '@sap/cds/common';

type CategoryCode        : String(1) enum {
  Junior = 'J';
  MidLevel = 'M';
  Senior = 'S';
  Lead = 'L';
}

type BillingStatus       : String(1) enum {
  Unbilled = 'U';
  Billed = 'B';
  Invoiced = 'I';
}

type TimeEntryStatus     : String(1) enum {
  Draft = 'D';
  Submitted = 'S';
  Approved = 'A';
  Rejected = 'R';
}

type ProjectStatus       : String(1) enum {
  Open = 'O';
  Closed = 'C';
}

type UserRole            : String(1) enum {
  Employee = 'E';
  Manager = 'M';
  Admin = 'A';
}

@AuditLog.Operation: {
  Insert,
  Update,
  Delete
}
entity Categories : cuid, managed {
  code        : CategoryCode   @mandatory;
  name        : String(50)     @mandatory;
  rate        : Decimal(14, 4) @mandatory;
  description : String(200);
  //Slowly changing dimensions
  validFrom   : Date default '1900-01-01';
  validTo     : Date default '9999-12-31';
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
  removedAt  : Timestamp;
  removedBy  : String;
  customRate : Decimal(14, 4); // Allows a manager to assign a worker with a different rate
  validFrom  : Date default '1900-01-01';
  validTo    : Date default '9999-12-31';
}

entity TimeEntries : cuid, managed {
  date          : Date                     @mandatory;
  hours         : Decimal(4, 2)            @mandatory;
  description   : String(500);

  status        : TimeEntryStatus default 'D';
  reviewedAt    : Timestamp;
  reviewedBy    : String;
  rejectionNote : String(500);

  rateSnapshot  : Decimal(14, 4);
  billingStatus : BillingStatus default 'U';

  employee      : Association to Employees @mandatory;
  project       : Association to Projects  @mandatory;

  month         : Integer;
  year          : Integer;
}

type BillingPeriodStatus : String(1) enum {
  Open = 'O';
  Closed = 'C';
  Invoiced = 'I';
}

entity BillingPeriods : cuid, managed {
  project    : Association to Projects @mandatory;
  month      : Integer                 @mandatory;
  year       : Integer                 @mandatory;
  status     : BillingPeriodStatus default 'O';
  closedAt   : Timestamp;
  closedBy   : String;
  totalCost  : Decimal(19, 4); // Aggregate of rate*hours needs 4 decimals
  totalHours : Decimal(10, 2);
}

type InvoiceStatus       : String(1) enum {
  Draft = 'D';
  Sent = 'S';
  Paid = 'P';
  Cancelled = 'C';
}

entity Invoices : cuid, managed {
  invoiceNumber : String(50)             @mandatory;
  issueDate     : Date                   @mandatory;
  dueDate       : Date;
  status        : InvoiceStatus default 'D';
  currency      : String(3) default 'EUR';
  taxRate       : Decimal(5, 2);
  subtotal      : Decimal(19, 4);
  taxAmount     : Decimal(19, 4);
  total         : Decimal(19, 4);
  notes         : String(500);
  client        : Association to Clients @mandatory;
  billingPeriod : Association to BillingPeriods;
  lines         : Composition of many InvoiceLines
                    on lines.invoice = $self;
}

entity InvoiceLines : cuid {
  invoice      : Association to Invoices    @mandatory;
  timeEntry    : Association to TimeEntries @mandatory;
  description  : String(500);
  hours        : Decimal(4, 2);
  rateSnapshot : Decimal(14, 4);
  amount       : Decimal(19, 4);
}

entity Notifications : cuid, managed {
  recipient : Association to Employees @mandatory;
  type      : String(50) default 'DraftReminder';
  subject   : String(200);
  message   : String(1000);
  sentAt    : Timestamp;
  status    : String(1) default 'P'; // P=Pending, S=Sent, F=Failed
  isRead    : Boolean default false;
}
