using ManagerService from '../../srv/manager-service';

////////////////////////////////////////////////////////////////////////////
//
//  Projects List Report
//
annotate ManagerService.Projects with @(
  UI.HeaderInfo     : {
    TypeName      : '{i18n>Project}',
    TypeNamePlural: '{i18n>Projects}',
    TypeImageUrl  : 'sap-icon://building',
    Title         : {Value: name},
    Description   : {Value: client.name}
  },

  UI.SelectionFields: [
    status,
    client
  ],

  UI.LineItem       : [
    {
      Value: name,
      Label: '{i18n>ProjectName}'
    },
    {
      Value                : client.name,
      Label                : '{i18n>Client}',
      ![@HTML5.CssDefaults]: {width: '12rem'}
    },
    {
      Value                : status,
      Label                : '{i18n>Status}',
      Criticality          : statusCriticality,
      ![@HTML5.CssDefaults]: {width: '6rem'}
    },
    {
      Value                : budget,
      Label                : '{i18n>Budget}',
      ![@HTML5.CssDefaults]: {width: '8rem'}
    },
    {
      Value                : totalHours,
      Label                : '{i18n>ApprovedHours}',
      ![@HTML5.CssDefaults]: {width: '8rem'}
    },
    {
      Value                : totalCost,
      Label                : '{i18n>ApprovedCost}',
      ![@HTML5.CssDefaults]: {width: '8rem'}
    },
    {
      Value                : budgetRemaining,
      Label                : '{i18n>BudgetRemaining}',
      Criticality          : budgetCriticality,
      ![@HTML5.CssDefaults]: {width: '9rem'}
    },
    {
      Value        : clientName,
      ![@UI.Hidden]: true
    }
  ]
);


////////////////////////////////////////////////////////////////////////////
//
//  Projects Object Page
//
annotate ManagerService.Projects with @(UI: {
  HeaderFacets                   : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#BudgetUsage'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#HoursUsage'
    }
  ],

  Facets                         : [
    {
      $Type : 'UI.CollectionFacet',
      Label : '{i18n>GeneralInfo}',
      ID    : 'GeneralInfo',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Label : '{i18n>ProjectDetails}',
          Target: '@UI.FieldGroup#General'
        },
        {
          $Type : 'UI.ReferenceFacet',
          Label : '{i18n>Dates}',
          Target: '@UI.FieldGroup#Dates'
        }
      ]
    },
    {
      $Type : 'UI.CollectionFacet',
      Label : '{i18n>FinancialOverview}',
      ID    : 'Financials',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Label : '{i18n>ApprovedFinancials}',
          Target: '@UI.FieldGroup#ApprovedFinancials'
        },
        {
          $Type : 'UI.ReferenceFacet',
          Label : '{i18n>ProjectedFinancials}',
          Target: '@UI.FieldGroup#ProjectedFinancials'
        },
        {
          $Type : 'UI.ReferenceFacet',
          Label : '{i18n>CategoryBreakdown}',
          Target: '@UI.FieldGroup#CategoryBreakdown'
        },

      ]
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>Assignments}',
      Target: 'assignments/@UI.LineItem'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>TimeEntries}',
      Target: 'timeEntries/@UI.LineItem'
    }
  ],

  DataPoint #BudgetUsage         : {
    Value        : totalCost,
    Title        : '{i18n>ApprovedCost}',
    TargetValue  : budget,
    Visualization: #Progress,
    Criticality  : budgetCriticality
  },

  DataPoint #HoursUsage          : {
    Value        : totalHours,
    Title        : '{i18n>ApprovedHours}',
    TargetValue  : projectedTotalHours,
    Visualization: #Progress,
    Criticality  : statusCriticality
  },

  FieldGroup #General            : {Data: [
    {
      Value: name,
      Label: '{i18n>ProjectName}'
    },
    {
      Value: client.name,
      Label: '{i18n>Client}'
    },
    {
      Value      : status,
      Label      : '{i18n>Status}',
      Criticality: statusCriticality
    },
    {
      Value: budget,
      Label: '{i18n>Budget}'
    }
  ]},

  FieldGroup #Dates              : {Data: [
    {
      Value: startDate,
      Label: '{i18n>StartDate}'
    },
    {
      Value: endDate,
      Label: '{i18n>EndDate}'
    }
  ]},

  FieldGroup #ApprovedFinancials : {Data: [
    {
      Value: totalHours,
      Label: '{i18n>ApprovedHours}'
    },
    {
      Value: totalCost,
      Label: '{i18n>ApprovedCost}'
    },
    {
      Value      : budgetRemaining,
      Label      : '{i18n>BudgetRemaining}',
      Criticality: budgetCriticality
    },
    {
      Value: avgCostPerHour,
      Label: '{i18n>AvgCostPerHour}'
    }
  ]},

  FieldGroup #ProjectedFinancials: {Data: [
    {
      Value: projectedTotalHours,
      Label: '{i18n>ProjectedHours}'
    },
    {
      Value: projectedTotalCost,
      Label: '{i18n>ProjectedCost}'
    },
    {
      Value      : projectedBudgetRemaining,
      Label      : '{i18n>ProjectedBudgetRemaining}',
      Criticality: projectedBudgetCriticality
    },
    {
      Value: submittedHours,
      Label: '{i18n>PendingApprovalHours}'
    },
    {
      Value: submittedCost,
      Label: '{i18n>PendingApprovalCost}'
    }
  ]},

  FieldGroup #CategoryBreakdown  : {Data: [
    {
      Value: juniorHours,
      Label: '{i18n>JuniorHours}'
    },
    {
      Value: juniorCost,
      Label: '{i18n>JuniorCost}'
    },
    {
      Value: midLevelHours,
      Label: '{i18n>MidLevelHours}'
    },
    {
      Value: midLevelCost,
      Label: '{i18n>MidLevelCost}'
    },
    {
      Value: seniorHours,
      Label: '{i18n>SeniorHours}'
    },
    {
      Value: seniorCost,
      Label: '{i18n>SeniorCost}'
    },
    {
      Value: leadHours,
      Label: '{i18n>LeadHours}'
    },
    {
      Value: leadCost,
      Label: '{i18n>LeadCost}'
    }
  ]}
});

////////////////////////////////////////////////////////////////////////////
//
//  Projects — virtual criticality fields
//
annotate ManagerService.Projects with {
  // Status criticality: Open=2 (info/blue), Closed=1 (neutral/grey)
  statusCriticality          @UI.Hidden;
  budgetCriticality          @UI.Hidden;
  projectedBudgetCriticality @UI.Hidden;
};

////////////////////////////////////////////////////////////////////////////
//
//  Projects — Element annotations
//
annotate ManagerService.Projects with {
  ID                       @UI.Hidden;
  closedAt                 @UI.Hidden;
  closedBy                 @UI.Hidden;

  // All virtual financial fields are readonly
  totalHours               @readonly;
  totalCost                @readonly @Measures.Scale: 2;
  budgetRemaining          @readonly @Measures.Scale: 2;
  avgCostPerHour           @readonly @Measures.Scale: 2;
  projectedTotalHours      @readonly;
  projectedTotalCost       @readonly @Measures.Scale: 2;
  projectedBudgetRemaining @readonly @Measures.Scale: 2;
  submittedHours           @readonly;
  submittedCost            @readonly @Measures.Scale: 2;
  juniorHours              @readonly;
  juniorCost               @readonly @Measures.Scale: 2;
  midLevelHours            @readonly;
  midLevelCost             @readonly @Measures.Scale: 2;
  seniorHours              @readonly;
  seniorCost               @readonly @Measures.Scale: 2;
  leadHours                @readonly;
  leadCost                 @readonly @Measures.Scale: 2;

  client                     @(
    Common: {
      Text           : clientName,
      TextArrangement: #TextOnly,
      ValueList      : {
        $Type         : 'Common.ValueListType',
        Label         : '{i18n>Clients}',
        CollectionPath: 'Clients',
        Parameters    : [
          {
            $Type            : 'Common.ValueListParameterInOut',
            LocalDataProperty: client_ID,
            ValueListProperty: 'ID'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'name'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'email'
          }
        ]
      }
    },
    title : '{i18n>Client}'
  );

  name                     @title: '{i18n>ProjectName}';
  status                   @title: '{i18n>Status}';
  budget                   @title: '{i18n>Budget}';
  startDate                @title: '{i18n>StartDate}';
  endDate                  @title: '{i18n>EndDate}';
};

////////////////////////////////////////////////////////////////////////////
//
//  TimeEntries List Report
//
annotate ManagerService.TimeEntries with @(
  UI.HeaderInfo                  : {
    TypeName      : '{i18n>TimeEntry}',
    TypeNamePlural: '{i18n>TimeEntries}',
    Title         : {Value: date},
    Description   : {Value: projectName}
  },

  UI.Highlight                   : statusCriticality,

  UI.SelectionFields             : [
    project,
    status,
    date,
    isOvertime
  ],

  UI.LineItem                    : [
    {
      Value                : date,
      Label                : '{i18n>Date}',
      ![@HTML5.CssDefaults]: {width: '8rem'}
    },
    {
      Value                    : status,
      Label                    : '{i18n>Status}',
      Criticality              : statusCriticality,
      CriticalityRepresentation: #WithIcon,
      ![@HTML5.CssDefaults]    : {width: '10rem'}
    },
    {
      Value                : employeeName,
      Label                : '{i18n>Employee}',
      ![@HTML5.CssDefaults]: {width: '12rem'}
    },
    {
      Value                : projectName,
      Label                : '{i18n>Project}',
      ![@HTML5.CssDefaults]: {width: '12rem'}
    },
    {
      Value                : categoryName,
      Label                : '{i18n>Category}',
      ![@HTML5.CssDefaults]: {width: '8rem'}
    },
    {
      Value                : hours,
      Label                : '{i18n>Hours}',
      ![@HTML5.CssDefaults]: {width: '5rem'}
    },
    {
      Value                : cost,
      Label                : '{i18n>Cost}',
      ![@HTML5.CssDefaults]: {width: '7rem'}
    },
    {
      Value                : reviewerName,
      Label                : '{i18n>ReviewedBy}',
      ![@HTML5.CssDefaults]: {width: '12rem'}
    },
    {
      Value                : isOvertime,
      Label                : '{i18n>Overtime}',
      ![@HTML5.CssDefaults]: {width: '6rem'}
    },
    {
      Value                : overtimeHours,
      Label                : '{i18n>OvertimeHours}',
      ![@HTML5.CssDefaults]: {width: '6rem'}
    },
    // Inline actions for quick row-level approval/rejection
    {
      $Type            : 'UI.DataFieldForAction',
      Action           : 'ManagerService.approveTimeEntry',
      Label            : '{i18n>Approve}',
      Inline           : true,
      Determining      : true,
      ![@UI.Importance]: #High
    },
    {
      $Type            : 'UI.DataFieldForAction',
      Action           : 'ManagerService.rejectTimeEntry',
      Label            : '{i18n>Reject}',
      Inline           : true,
      Determining      : true,
      ![@UI.Importance]: #High
    },
    // Toolbar actions for mass approval/rejection
    {
      $Type            : 'UI.DataFieldForAction',
      Action           : 'ManagerService.approveTimeEntry',
      Label            : '{i18n>Approve}',
      Inline           : false,
      Determining      : true,
      ![@UI.Importance]: #High
    },
    {
      $Type            : 'UI.DataFieldForAction',
      Action           : 'ManagerService.rejectTimeEntry',
      Label            : '{i18n>Reject}',
      Inline           : false,
      Determining      : true,
      ![@UI.Importance]: #High
    }
  ],

  UI.SelectionPresentationVariant: {
    Text               : '{i18n>PendingApproval}',
    SelectionVariant   : {
      $Type        : 'UI.SelectionVariantType',
      SelectOptions: [{
        $Type       : 'UI.SelectOptionType',
        PropertyName: status,
        Ranges      : [{
          $Type : 'UI.SelectionRangeType',
          Sign  : #I,
          Option: #EQ,
          Low   : 'S'
        }]
      }]
    },
    PresentationVariant: {
      SortOrder     : [{
        Property  : date,
        Descending: true
      }],
      Visualizations: ['@UI.LineItem']
    }
  }
);

////////////////////////////////////////////////////////////////////////////
//
//  TimeEntries Object Page
//
annotate ManagerService.TimeEntries with @(
  UI.HeaderFacets            : [{
    $Type : 'UI.ReferenceFacet',
    Target: '@UI.DataPoint#Cost'
  }],

  UI.Facets                  : [
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>EntryDetails}',
      Target: '@UI.FieldGroup#EntryDetails'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>ReviewInfo}',
      Target: '@UI.FieldGroup#ReviewInfo'
    }
  ],

  UI.DataPoint #Cost         : {
    Value      : cost,
    Title      : '{i18n>Cost}',
    Criticality: statusCriticality
  },

  UI.FieldGroup #EntryDetails: {Data: [
    {
      Value: date,
      Label: '{i18n>Date}'
    },
    {
      Value: employeeName,
      Label: '{i18n>Employee}'
    },
    {
      Value: projectName,
      Label: '{i18n>Project}'
    },
    {
      Value: categoryName,
      Label: '{i18n>Category}'
    },
    {
      Value: hours,
      Label: '{i18n>Hours}'
    },
    {
      Value: description,
      Label: '{i18n>Description}'
    },
    {
      Value: rateSnapshot,
      Label: '{i18n>Rate}'
    },
    {
      Value: cost,
      Label: '{i18n>Cost}'
    },
    {
      Value: isOvertime,
      Label: '{i18n>Overtime}'
    },
    {
      Value: overtimeHours,
      Label: '{i18n>OvertimeHours}'
    },
    {
      Value: overtimeJustification,
      Label: '{i18n>OvertimeJustification}'
    }
  ]},

  UI.FieldGroup #ReviewInfo  : {Data: [
    {
      Value      : status,
      Label      : '{i18n>Status}',
      Criticality: statusCriticality
    },
    {
      Value: isOvertime,
      Label: '{i18n>Overtime}'
    },
    {
      Value: overtimeHours,
      Label: '{i18n>OvertimeHours}'
    },
    {
      Value: overtimeJustification,
      Label: '{i18n>OvertimeJustification}'
    },
    {
      Value: rejectionNote,
      Label: '{i18n>RejectionNote}'
    },
    {
      Value: reviewedAt,
      Label: '{i18n>ReviewedAt}'
    },
    {
      Value: reviewerName,
      Label: '{i18n>ReviewedBy}'
    }
  ]}
);

annotate ManagerService.TimeEntries with @(UI.Identification: [
  {
    $Type            : 'UI.DataFieldForAction',
    Action           : 'ManagerService.approveTimeEntry',
    Label            : '{i18n>Approve}',
    Determining      : true,
    ![@UI.Importance]: #High
  },
  {
    $Type            : 'UI.DataFieldForAction',
    Action           : 'ManagerService.rejectTimeEntry',
    Label            : '{i18n>Reject}',
    Determining      : true,
    ![@UI.Importance]: #High
  }
]);

annotate ManagerService.TimeEntries actions {
  // Advanced logic: SideEffects trigger a UI refresh of the listed properties
  // immediately after the action completes, ensuring the status and reviewer name
  // reflect the new backend state without requiring a manual page reload.
  approveTimeEntry @(Common.SideEffects: {TargetProperties: [
    'in/status',
    'in/billingStatus',
    'in/reviewedAt',
    'in/reviewerName',
    'in/statusCriticality'
  ]});

  rejectTimeEntry  @(Common.SideEffects: {TargetProperties: [
    'in/status',
    'in/rejectionNote',
    'in/reviewedAt',
    'in/reviewerName',
    'in/statusCriticality'
  ]});
};

////////////////////////////////////////////////////////////////////////////
//
//  TimeEntries — Element annotations
//
annotate ManagerService.TimeEntries with {
  ID                @UI.Hidden;
  billingStatus     @UI.Hidden;
  month             @UI.Hidden;
  year              @UI.Hidden;
  statusCriticality @UI.Hidden;
  reviewedBy        @UI.Hidden;

  project           @(
    Common: {
      Text           : projectName,
      TextArrangement: #TextOnly,
      ValueList      : {
        $Type         : 'Common.ValueListType',
        Label         : '{i18n>Projects}',
        CollectionPath: 'Projects',
        Parameters    : [
          {
            $Type            : 'Common.ValueListParameterInOut',
            LocalDataProperty: project_ID,
            ValueListProperty: 'ID'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'name'
          }
        ]
      }
    },
    title : '{i18n>Project}'
  );

  employee          @Common.Text: employeeName;
  employee          @Common.TextArrangement: #TextOnly;

  date              @title: '{i18n>Date}';
  hours             @title: '{i18n>Hours}';
  description       @title: '{i18n>Description}'    @UI.MultiLineText;
  status            @(title: '{i18n>Status}', Common.ValueListWithFixedValues, Common.Text: statusText);
  employeeName      @title: '{i18n>Employee}';
  projectName       @title: '{i18n>Project}';
  categoryName      @title: '{i18n>Category}';
  cost              @title: '{i18n>Cost}';
  rateSnapshot      @title: '{i18n>Rate}';
  rejectionNote         @title: '{i18n>RejectionNote}'  @UI.MultiLineText;
  reviewedAt            @title: '{i18n>ReviewedAt}';
  isOvertime            @title: '{i18n>Overtime}';
  overtimeHours         @title: '{i18n>OvertimeHours}';
  overtimeJustification @title: '{i18n>OvertimeJustification}' @UI.MultiLineText;
  reviewerName      @title: '{i18n>ReviewedBy}';
};

////////////////////////////////////////////////////////////////////////////
//
//  ProjectAssignments — inline table inside Project ObjectPage
//
annotate ManagerService.ProjectAssignments with @(
  UI.HeaderInfo         : {
    TypeName      : '{i18n>Assignment}',
    TypeNamePlural: '{i18n>Assignments}'
  },
  UI.LineItem           : [
    {
      Value                : employeeName,
      Label                : '{i18n>Employee}',
      ![@HTML5.CssDefaults]: {width: '14rem'}
    },
    {
      Value                : categoryName,
      Label                : '{i18n>Category}',
      ![@HTML5.CssDefaults]: {width: '8rem'}
    },
    {
      Value                : assignedAt,
      Label                : '{i18n>AssignedAt}',
      ![@HTML5.CssDefaults]: {width: '8rem'}
    },
    {
      Value                : isActive,
      Label                : '{i18n>Active}',
      ![@HTML5.CssDefaults]: {width: '5rem'}
    },
    {
      Value                : customRate,
      Label                : '{i18n>CustomRate}',
      ![@HTML5.CssDefaults]: {width: '8rem'}
    }
  ],
  UI.SelectionFields    : [
    employee,
    categoryName,
    isActive
  ],
  UI.PresentationVariant: {
    SelectOptions : [{
      $Type       : 'UI.SelectOptionType',
      PropertyName: isActive,
      Ranges      : [{
        $Type : 'UI.SelectionRangeType',
        Sign  : #I,
        Option: #EQ,
        Low   : true
      }]
    }],
    Visualizations: ['@UI.LineItem']
  }
);

annotate ManagerService.ProjectAssignments with {
  ID           @UI.Hidden;
  removedAt    @UI.Hidden;
  removedBy    @UI.Hidden;
  validFrom    @UI.Hidden;
  validTo      @UI.Hidden;

  employee     @(
    Common: {
      Text           : employeeName,
      TextArrangement: #TextFirst,
      ValueList      : {
        $Type         : 'Common.ValueListType',
        Label         : '{i18n>Employees}',
        CollectionPath: 'Employees',
        Parameters    : [
          {
            $Type            : 'Common.ValueListParameterInOut',
            LocalDataProperty: employee_ID,
            ValueListProperty: 'ID'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'firstName'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'lastName'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'email'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'categoryName'
          }
        ]
      }
    },
    title : '{i18n>Employee}'
  );

  assignedAt   @title: '{i18n>AssignedAt}';
  isActive     @title: '{i18n>Active}';
  customRate   @title: '{i18n>CustomRate}';
  employeeName @title: '{i18n>Employee}';
  categoryName @title: '{i18n>Category}';
};

////////////////////////////////////////////////////////////////////////////
//
//  Clients — ValueHelp list annotations
//
annotate ManagerService.Clients with @(
  UI.HeaderInfo: {
    TypeName      : '{i18n>Client}',
    TypeNamePlural: '{i18n>Clients}'
  },
  UI.LineItem  : [
    {
      Value: name,
      Label: '{i18n>ClientName}'
    },
    {
      Value: email,
      Label: '{i18n>Email}'
    }
  ]
);

annotate ManagerService.Clients with {
  ID    @UI.Hidden;
  name  @title: '{i18n>ClientName}';
  email @title: '{i18n>Email}';
};

////////////////////////////////////////////////////////////////////////////
//
//  Employees — ValueHelp list annotations + Contact for QuickView
//
annotate ManagerService.Employees with @(
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
  ],
// Communication.Contact removed due to sap.fe macro bug in local sandbox
);

annotate ManagerService.Employees with {
  ID           @UI.Hidden;
  externalId   @UI.Hidden;
  firstName    @title: '{i18n>FirstName}';
  lastName     @title: '{i18n>LastName}';
  email        @title: '{i18n>Email}';
  categoryName @title: '{i18n>Category}';
  isActive     @title: '{i18n>Active}';
  fullName     @title: '{i18n>Employee}';
};

////////////////////////////////////////////////////////////////////////////
//
//  BillingPeriods (read-only reference)
//
annotate ManagerService.BillingPeriods with {
  ID @UI.Hidden;
};


