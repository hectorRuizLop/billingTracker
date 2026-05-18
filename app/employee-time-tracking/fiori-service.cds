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
  UI.HeaderInfo                  : {
    TypeName      : '{i18n>TimeEntry}',
    TypeNamePlural: '{i18n>TimeEntries}',
    Title         : {Value: date},
    Description   : {Value: projectName}
  },

  UI.SelectionFields             : [
    date,
    project_ID,
    status
  ],

  UI.LineItem                    : [
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
      Value                    : status,
      Label                    : '{i18n>Status}',
      Criticality              : statusCriticality,
      CriticalityRepresentation: #WithIcon,
      ![@HTML5.CssDefaults]    : {width: '10rem'}
    },
    {
      Value: description,
      Label: '{i18n>Description}'
    },
    {
      $Type            : 'UI.DataFieldForAction',
      Action           : 'EmployeeService.submitMonth',
      Label            : '{i18n>submitMonth}',
      Inline           : false,
      Determining      : true,
      ![@UI.Importance]: #High
    }
  ],

  UI.Highlight                   : statusCriticality,

  UI.SelectionPresentationVariant: {
    Text               : '{i18n>MyTimeEntries}',
    SelectionVariant   : {
      $Type        : 'UI.SelectionVariantType',
      SelectOptions: []
    },
    PresentationVariant: {
      SortOrder     : [{
        Property  : date,
        Descending: true
      }],
      GroupBy       : [status],
      Visualizations: [
        '@UI.LineItem',
        '@UI.Chart#HoursByProject'
      ]
    }
  },

  UI.DataPoint #Hours            : {
    Value      : hours,
    Title      : '{i18n>Hours}',
    Criticality: statusCriticality
  },

  UI.Chart #HoursByProject       : {
    $Type              : 'UI.ChartDefinitionType',
    ChartType          : #Bar,
    Title              : '{i18n>Hours}',
    Description        : '{i18n>Project}',
    Measures           : [hours],
    MeasureAttributes  : [{
      $Type  : 'UI.ChartMeasureAttributeType',
      Measure: hours,
      Role   : #Axis1
    }],
    Dimensions         : [projectName],
    DimensionAttributes: [{
      $Type    : 'UI.ChartDimensionAttributeType',
      Dimension: projectName,
      Role     : #Category
    }]
  }
);

////////////////////////////////////////////////////////////////////////////
//
//  MyTimeEntries Object Page
//
annotate EmployeeService.MyTimeEntries with @(
  UI.HeaderFacets       : [{
    $Type : 'UI.ReferenceFacet',
    Target: '@UI.DataPoint#Hours'
  }],

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
      Value      : status,
      Label      : '{i18n>Status}',
      Criticality: statusCriticality
    },
    {
      Value: rejectionNote,
      Label: '{i18n>RejectionNote}'
    },
    {
      Value: month,
      Label: '{i18n>month}'
    },
    {
      Value: year,
      Label: '{i18n>year}'
    },
    {
      Value: rateSnapshot,
      Label: '{i18n>rateSnapshot}'
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
  statusCriticality  @UI.Hidden;
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
    TypeNamePlural: '{i18n>Employees}'
  },
  UI.LineItem  : [
    {
      Value: firstName,
      Label: '{i18n>FirstName}'
    },
    {
      Value: lastName,
      Label: '{i18n>LastName}'
    },
    {
      Value: email,
      Label: '{i18n>Email}'
    },
    {
      Value: categoryName,
      Label: '{i18n>Category}'
    }
  ]
);

annotate EmployeeService.Employees with {
  ID           @UI.Hidden;
  externalId   @UI.Hidden;
  firstName    @title: '{i18n>FirstName}';
  lastName     @title: '{i18n>LastName}';
  email        @title: '{i18n>Email}';
  role         @title: '{i18n>Role}';
  isActive     @title: '{i18n>Active}';
  categoryName @title: '{i18n>Category}';
};

////////////////////////////////////////////////////////////////////////////
//
//  MyProjectSummary List Report
//
annotate EmployeeService.MyProjectSummary with @(
  UI.HeaderInfo: {
    TypeName      : '{i18n>MyProjectSummary}',
    TypeNamePlural: '{i18n>MyProjectSummary}'
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
      Label: '{i18n>entryCount}'
    }
  ]
);

annotate EmployeeService.MyProjectSummary with {
  ID          @UI.Hidden;
  project_ID  @UI.Hidden;
  projectName @title: '{i18n>Project}';
  totalHours  @title: '{i18n>Hours}';
  entryCount  @title: '{i18n>entryCount}';
};

////////////////////////////////////////////////////////////////////////////
//
//  MyMonthlySummary List Report
//
annotate EmployeeService.MyMonthlySummary with @(
  UI.HeaderInfo                  : {
    TypeName      : '{i18n>MyMonthlySummary}',
    TypeNamePlural: '{i18n>MyMonthlySummary}'
  },
  UI.LineItem                    : [
    {
      Value: year,
      Label: '{i18n>year}'
    },
    {
      Value: month,
      Label: '{i18n>month}'
    },
    {
      Value: totalHours,
      Label: '{i18n>Hours}'
    },
    {
      Value: entryCount,
      Label: '{i18n>entryCount}'
    }
  ],

  UI.SelectionPresentationVariant: {
    Text               : '{i18n>MyMonthlySummary}',
    SelectionVariant   : {
      $Type        : 'UI.SelectionVariantType',
      SelectOptions: []
    },
    PresentationVariant: {
      SortOrder     : [
        {
          Property  : year,
          Descending: true
        },
        {
          Property  : month,
          Descending: true
        }
      ],
      Visualizations: [
        '@UI.LineItem',
        '@UI.Chart#HoursByMonth'
      ]
    }
  },

  UI.Chart #HoursByMonth         : {
    $Type              : 'UI.ChartDefinitionType',
    ChartType          : #Line,
    Title              : '{i18n>Hours}',
    Description        : '{i18n>MyMonthlySummary}',
    Measures           : [totalHours],
    MeasureAttributes  : [{
      $Type  : 'UI.ChartMeasureAttributeType',
      Measure: totalHours,
      Role   : #Axis1
    }],
    Dimensions         : [
      year,
      month
    ],
    DimensionAttributes: [
      {
        $Type    : 'UI.ChartDimensionAttributeType',
        Dimension: year,
        Role     : #Category
      },
      {
        $Type    : 'UI.ChartDimensionAttributeType',
        Dimension: month,
        Role     : #Category
      }
    ]
  }
);

annotate EmployeeService.MyMonthlySummary with {
  ID         @UI.Hidden;
  year       @title: '{i18n>year}';
  month      @title: '{i18n>month}';
  totalHours @title: '{i18n>Hours}';
  entryCount @title: '{i18n>entryCount}';
};
