using EmployeeService from '../../srv/employee-service';

////////////////////////////////////////////////////////////////////////////
//
//  Service-level Operations
//
annotate EmployeeService with @(UI.Operations: [{
  $Type: 'UI.Operation',
  Name : 'submitMonth',
  Label: '{i18n>submitMonth}'
}]);

////////////////////////////////////////////////////////////////////////////
//
//  MyTimeEntries List Report
//
annotate EmployeeService.MyTimeEntries with @(
  UI.HeaderInfo     : {
    TypeName      : '{i18n>TimeEntry}',
    TypeNamePlural: '{i18n>TimeEntries}',
    Title         : {Value: date},
    Description   : {Value: projectName}
  },

  UI.SelectionFields: [
    date,
    project_ID,
    status
  ],

  UI.LineItem       : [
    {
      Value: date,
      Label: '{i18n>Date}'
    },
    {
      Value: projectName,
      Label: '{i18n>Project}'
    },
    {
      Value: hours,
      Label: '{i18n>Hours}'
    },
    {
      Value: status,
      Label: '{i18n>Status}'
    },
    {
      Value: description,
      Label: '{i18n>Description}'
    }
  ]
);

////////////////////////////////////////////////////////////////////////////
//
//  MyTimeEntries Object Page
//
annotate EmployeeService.MyTimeEntries with @(
  UI.Facets             : [
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>Details}',
      Target: '@UI.FieldGroup#Details'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>SystemInfo}',
      Target: '@UI.FieldGroup#System'
    }
  ],

  UI.FieldGroup #Details: {Data: [
    {
      Value: date,
      Label: '{i18n>Date}'
    },
    {
      Value: project_ID,
      Label: '{i18n>Project}'
    },
    {
      Value: hours,
      Label: '{i18n>Hours}'
    },
    {
      Value: description,
      Label: '{i18n>Description}'
    }
  ]},

  UI.FieldGroup #System : {Data: [
    {
      Value: status,
      Label: '{i18n>Status}'
    },
    {
      Value: month,
      Label: 'Mes'
    },
    {
      Value: year,
      Label: 'Año'
    },
    {
      Value: rateSnapshot,
      Label: 'Tarifa'
    }
  ]}
);

////////////////////////////////////////////////////////////////////////////
//
//  MyTimeEntries Element annotations
//
annotate EmployeeService.MyTimeEntries with {
  ID                 @UI.Hidden;
  employee_ID        @UI.Hidden;
  employeeExternalId @UI.Hidden;
  month              @readonly;
  year               @readonly;
  rateSnapshot       @readonly;
  rejectionNote      @UI.Hidden;
  project_ID         @(
    Common: {
      Text           : projectName,
      TextArrangement: #TextOnly,
      ValueList      : {
        $Type         : 'Common.ValueListType',
        Label         : '{i18n>Projects}',
        CollectionPath: 'MyProjects',
        Parameters    : [
          {
            $Type            : 'Common.ValueListParameterInOut',
            LocalDataProperty: project_ID,
            ValueListProperty: 'ID'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'name'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'clientName'
          }
        ]
      }
    },
    title : '{i18n>Project}'
  );
  date               @title: '{i18n>Date}';
  hours              @title: '{i18n>Hours}';
  description        @title: '{i18n>Description}'  @UI.MultiLineText;
  status             @title: '{i18n>Status}';
};

////////////////////////////////////////////////////////////////////////////
//
//  MyProjects ValueHelp list annotations
//
annotate EmployeeService.MyProjects with @(
  UI.HeaderInfo     : {
    TypeName      : '{i18n>Project}',
    TypeNamePlural: '{i18n>Projects}'
  },
  UI.LineItem       : [
    {
      Value: name,
      Label: '{i18n>Project}'
    },
    {
      Value: clientName,
      Label: '{i18n>clientName}'
    },
    {
      Value: status,
      Label: '{i18n>Status}'
    }
  ],
  UI.SelectionFields: [name]
);

annotate EmployeeService.MyProjects with {
  ID                @UI.Hidden;
  manager_ID        @UI.Hidden;
  managerExternalId @UI.Hidden;
  assignments       @UI.Hidden;
  name              @title: '{i18n>Project}';
  clientName        @title: '{i18n>clientName}';
  status            @title: '{i18n>Status}';
};

////////////////////////////////////////////////////////////////////////////
//
//  Employees (profile read-only)
//
annotate EmployeeService.Employees with @(
  UI.HeaderInfo: {
    TypeName      : '{i18n>Employee}',
    TypeNamePlural: '{i18n>Employee}'
  },
  UI.LineItem  : [
    {Value: firstName},
    {Value: lastName},
    {Value: email},
    {
      Value: categoryName,
      Label: '{i18n>Category}'
    }
  ]
);

annotate EmployeeService.Employees with {
  ID           @UI.Hidden;
  externalId   @UI.Hidden;
  firstName    @title: 'Nombre';
  lastName     @title: 'Apellido';
  email        @title: 'Email';
  role         @title: 'Rol';
  isActive     @title: 'Activo';
  categoryName @title: '{i18n>Category}';
};

////////////////////////////////////////////////////////////////////////////
//
//  MyProjectSummary List Report
//
annotate EmployeeService.MyProjectSummary with @(
  UI.HeaderInfo: {
    TypeName      : 'Resumen por Proyecto',
    TypeNamePlural: 'Resumen por Proyecto'
  },
  UI.LineItem  : [
    {
      Value: projectName,
      Label: '{i18n>Project}'
    },
    {
      Value: totalHours,
      Label: '{i18n>Hours}'
    },
    {
      Value: entryCount,
      Label: 'Nº Imputaciones'
    }
  ]
);

annotate EmployeeService.MyProjectSummary with {
  ID          @UI.Hidden;
  project_ID  @UI.Hidden;
  projectName @title: '{i18n>Project}';
  totalHours  @title: '{i18n>Hours}';
  entryCount  @title: 'Nº Imputaciones';
};

////////////////////////////////////////////////////////////////////////////
//
//  MyMonthlySummary List Report
//
annotate EmployeeService.MyMonthlySummary with @(
  UI.HeaderInfo: {
    TypeName      : 'Resumen Mensual',
    TypeNamePlural: 'Resumen Mensual'
  },
  UI.LineItem  : [
    {
      Value: year,
      Label: 'Año'
    },
    {
      Value: month,
      Label: 'Mes'
    },
    {
      Value: totalHours,
      Label: '{i18n>Hours}'
    },
    {
      Value: entryCount,
      Label: 'Nº Imputaciones'
    }
  ]
);

annotate EmployeeService.MyMonthlySummary with {
  ID         @UI.Hidden;
  year       @title: 'Año';
  month      @title: 'Mes';
  totalHours @title: '{i18n>Hours}';
  entryCount @title: 'Nº Imputaciones';
};
