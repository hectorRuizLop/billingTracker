using EmployeeService from '../../srv/employee-service';

////////////////////////////////////////////////////////////////////////////
//
//  MyTimeEntries List Report + Object Page
//
annotate EmployeeService.MyTimeEntries with @(
  UI.HeaderInfo                                   : {
    TypeName      : '{i18n>TimeEntry}',
    TypeNamePlural: '{i18n>TimeEntries}',
    Title         : {Value: date},
    Description   : {Value: projectName}
  },

  UI.SelectionFields                              : [
    date,
    project_ID,
    status
  ],

  UI.LineItem                                     : [
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
      Action           : 'submitMonth',
      Label            : '{i18n>submitMonth}',
      Inline           : false,
      Determining      : true,
      ![@UI.Importance]: #High
    }
  ],

  UI.Highlight                                    : statusCriticality,

  UI.SelectionPresentationVariant                 : {
    Text               : '{i18n>MyTimeEntries}',
    SelectionVariant   : {
      $Type: 'UI.SelectionVariantType'
    },
    PresentationVariant: {
      $Type         : 'UI.PresentationVariantType',
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

  UI.SelectionPresentationVariant #RejectedEntries: {
    Text               : '{i18n>Rejected}',
    SelectionVariant   : {
      $Type        : 'UI.SelectionVariantType',
      SelectOptions: [{
        $Type       : 'UI.SelectOptionType',
        PropertyName: status,
        Ranges      : [{
          $Type : 'UI.SelectionRangeType',
          Sign  : #I,
          Option: #EQ,
          Low   : 'R'
        }]
      }]
    },
    PresentationVariant: {
      $Type         : 'UI.PresentationVariantType',
      Visualizations: ['@UI.LineItem']
    }
  },

  UI.DataPoint #Hours                             : {
    Value      : hours,
    Title      : '{i18n>Hours}',
    Criticality: statusCriticality
  },

  UI.Chart #HoursByProject                        : {
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
  },

  UI.HeaderFacets            : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#Hours'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#Status'
    }
  ],

  UI.DataPoint #Status       : {
    Value      : status,
    Title      : '{i18n>Status}',
    Criticality: statusCriticality
  },

  UI.Facets                  : [
    {
      $Type : 'UI.CollectionFacet',
      ID    : 'Details',
      Label : '{i18n>Details}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Target: '@UI.FieldGroup#DetailsLeft'
        },
        {
          $Type : 'UI.ReferenceFacet',
          Target: '@UI.FieldGroup#DetailsRight'
        }
      ]
    }
  ],

  UI.FieldGroup #DetailsLeft : {Data: [
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
    }
  ]},

  UI.FieldGroup #DetailsRight: {Data: [
    {
      Value: description,
      Label: '{i18n>Description}'
    },
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
      Value: overtimeHours,
      Label: '{i18n>OvertimeHours}'
    },
    {
      Value: overtimeJustification,
      Label: '{i18n>OvertimeJustification}',
      @UI.MultiLineText
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
  month              @UI.Hidden;
  year               @UI.Hidden;
  rateSnapshot       @UI.Hidden;
  statusCriticality  @UI.Hidden;
  statusText         @UI.Hidden;
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
  status             @(
    title: '{i18n>Status}',
    Common: {
      Text           : statusText,
      TextArrangement: #TextOnly,
      ValueListWithFixedValues
    }
  );
  isOvertime         @title: '{i18n>Overtime}';
  overtimeHours      @title: '{i18n>OvertimeHours}';
  overtimeJustification @title: '{i18n>OvertimeJustification}' @UI.MultiLineText;
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
  UI.HeaderInfo                           : {
    TypeName      : '{i18n>MyProjectSummary}',
    TypeNamePlural: '{i18n>MyProjectSummary}'
  },
  UI.LineItem                             : [
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
  ],

  UI.PresentationVariant #ProjectSummaryPV: {
    $Type         : 'UI.PresentationVariantType',
    Visualizations: ['@UI.Chart#ProjectHoursDonut']
  },

  UI.Chart #ProjectHoursDonut             : {
    $Type              : 'UI.ChartDefinitionType',
    ChartType          : #Donut,
    Title              : '{i18n>Hours}',
    Description        : '{i18n>Project}',
    Measures           : [totalHours],
    MeasureAttributes  : [{
      $Type  : 'UI.ChartMeasureAttributeType',
      Measure: totalHours,
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
  UI.HeaderInfo                           : {
    TypeName      : '{i18n>MyMonthlySummary}',
    TypeNamePlural: '{i18n>MyMonthlySummary}'
  },
  UI.LineItem                             : [
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

  UI.SelectionPresentationVariant         : {
    Text               : '{i18n>MyMonthlySummary}',
    SelectionVariant   : {
      $Type: 'UI.SelectionVariantType'
    },
    PresentationVariant: {
      $Type         : 'UI.PresentationVariantType',
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

  UI.PresentationVariant #MonthlySummaryPV: {
    $Type         : 'UI.PresentationVariantType',
    Visualizations: ['@UI.Chart#MonthlyHoursColumn']
  },

  UI.Chart #HoursByMonth                  : {
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
  },

  UI.Chart #MonthlyHoursColumn            : {
    $Type              : 'UI.ChartDefinitionType',
    ChartType          : #Column,
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

////////////////////////////////////////////////////////////////////////////
//
//  MyNotifications List Report
//
annotate EmployeeService.MyNotifications with @(
  UI.HeaderInfo     : {
    TypeName      : '{i18n>Notification}',
    TypeNamePlural: '{i18n>Notifications}'
  },
  UI.LineItem       : [
    {
      Value: subject,
      Label: '{i18n>Subject}'
    },
    {
      Value: message,
      Label: '{i18n>Message}'
    },
    {
      Value: sentAt,
      Label: '{i18n>SentAt}'
    },
    {
      Value: isRead,
      Label: '{i18n>Read}'
    },
    {
      $Type            : 'UI.DataFieldForAction',
      Action           : 'markNotificationRead',
      Label            : '{i18n>MarkAsRead}',
      Inline           : false,
      Determining      : true
    }
  ]
);

annotate EmployeeService.MyNotifications with {
  ID                   @UI.Hidden;
  recipient_ID         @UI.Hidden;
  recipientExternalId  @UI.Hidden;
  externalNotificationId @UI.Hidden;
  type                 @title: '{i18n>Type}';
  subject              @title: '{i18n>Subject}';
  message              @title: '{i18n>Message}' @UI.MultiLineText;
  sentAt               @title: '{i18n>SentAt}';
  status               @title: '{i18n>Status}';
  isRead               @title: '{i18n>Read}';
  channel              @title: '{i18n>Channel}';
};
