namespace my.billing;
using { cuid, managed } from '@sap/cds/common';

type CategoryCode : String(1) enum {
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

type ProjectStatus : String(1) enum {
  Open   = 'O';      
  Closed = 'C';      
}

type UserRole : String(1) enum {
  Employee = 'E';    
  Manager  = 'M';    
  Admin    = 'A';    
}

entity Categories : cuid {
  code        : CategoryCode    @mandatory;
  name        : String(50)      @mandatory;      
  rate        : Decimal(10,2)   @mandatory;       
  description : String(200);
}

entity Employees : cuid, managed {
  firstName   : String(50)      @mandatory;
  lastName    : String(50)      @mandatory;
  email       : String(100)     @mandatory;       
  phone       : String(20);
  role        : UserRole        default 'E';      
  isActive    : Boolean         default true;     


  category    : Association to Categories;
  assignments : Association to many ProjectAssignments on assignments.employee = $self;

  timeEntries : Association to many TimeEntries on timeEntries.employee = $self;

  managedProjects : Association to many Projects on managedProjects.manager = $self;
}


entity Clients : cuid, managed {
  name         : String(100)    @mandatory;       
  email        : String(100)    @mandatory;       
  phone        : String(20);
  address      : String(300);
  taxId        : String(20);                     
  contactName  : String(100);                     
  notes        : String(500);
  isDeleted    : Boolean        default false;
  deletedAt    : Timestamp;
  deletedBy    : String;

  projects     : Association to many Projects on projects.client = $self;
}

entity Projects : cuid, managed {
  name         : String(150)    @mandatory;
  description  : String(500);
  status       : ProjectStatus  default 'O';      
  budget       : Decimal(15,2)  @mandatory;      
  startDate    : Date;
  endDate      : Date;                           
  closedAt     : Timestamp;                       
  closedBy     : String;                          

  client       : Association to Clients @mandatory;
  manager      : Association to Employees @mandatory;

  assignments  : Composition of many ProjectAssignments on assignments.project = $self;
  timeEntries  : Composition of many TimeEntries on timeEntries.project = $self;
}

entity ProjectAssignments : cuid, managed {
  project      : Association to Projects           @mandatory;
  employee     : Association to Employees          @mandatory;
  assignedAt   : Date          default $now;
  isActive     : Boolean       default true;    
  customRate   : Decimal(10,2); // Allows a manager assign a worker in a project with different tarif                  

}

entity TimeEntries : cuid, managed {
  date          : Date          @mandatory;        
  hours         : Decimal(4,2)  @mandatory;        
  description   : String(500);                     

  status        : TimeEntryStatus default 'D';    
  reviewedAt    : Timestamp;                      
  reviewedBy    : String;                          
  rejectionNote : String(500);                    

  rateSnapshot  : Decimal(10,2);

  employee      : Association to Employees         @mandatory;
  project       : Association to Projects          @mandatory;

  month         : Integer;                         
  year          : Integer;                         
}



entity AuditLog : cuid {
  timestamp     : Timestamp     @cds.on.insert: $now;
  user          : String(100);                    
  action        : String(20); // CREATE, UPDATE, DELETE
  entity_name   : String(100);                     
  entityId      : String(36);                      
  field         : String(50);                      
  oldValue      : String(500);
  newValue      : String(500);
  description   : String(500);
}

entity Notifications : cuid {
  sentAt         : Timestamp    @cds.on.insert: $now;
  type           : String(50);                     
  recipient      : String(100);                  
  subject        : String(200);
  body           : LargeString;                   
  status         : String(1)   default 'P'; // P=Pending, S=Sent, F=Failed
  errorMessage   : String(500);                    
  retryCount     : Integer     default 0;         

  relatedProject  : Association to Projects;
  relatedEmployee : Association to Employees;
}