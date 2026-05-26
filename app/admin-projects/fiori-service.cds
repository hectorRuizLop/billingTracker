using AdminService from '../../srv/admin-service';

////////////////////////////////////////////////////////////////////////////
//
//  Projects
//
annotate AdminService.Projects with @(
  UI.HeaderInfo     : {
    TypeName      : '{i18n>Project}',
    TypeNamePlural: '{i18n>Projects}',
    Title         : {Value: name},
    Description   : {Value: clientName}
  },
  UI.LineItem       : [
    {Value: name, Label: '{i18n>ProjectName}'},
    {Value: clientName, Label: '{i18n>Client}'},
    {Value: status, Label: '{i18n>Status}'},
    {Value: budget, Label: '{i18n>Budget}'},
    {Value: startDate, Label: '{i18n>StartDate}'},
    {Value: endDate, Label: '{i18n>EndDate}'}
  ],
  UI.SelectionFields: [status, client],
  UI.Facets         : [
    {
      $Type : 'UI.CollectionFacet',
      Label : '{i18n>Details}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Target: '@UI.FieldGroup#Details'
        }
      ]
    },
    {
      $Type : 'UI.CollectionFacet',
      Label : '{i18n>Financials}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Target: '@UI.FieldGroup#Financials'
        }
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
  UI.FieldGroup #Details   : {Data: [
    {Value: name, Label: '{i18n>ProjectName}'},
    {Value: description, Label: '{i18n>Description}'},
    {Value: status, Label: '{i18n>Status}'},
    {Value: client, Label: '{i18n>Client}'}
  ]},
  UI.FieldGroup #Financials: {Data: [
    {Value: budget, Label: '{i18n>Budget}'},
    {Value: startDate, Label: '{i18n>StartDate}'},
    {Value: endDate, Label: '{i18n>EndDate}'}
  ]}
);

annotate AdminService.Projects with {
  ID            @UI.Hidden;
  assignments   @UI.Hidden;
  timeEntries   @UI.Hidden;
  client        @(
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
          }
        ]
      }
    },
    title : '{i18n>Client}'
  );
  name          @title: '{i18n>ProjectName}';
  status        @title: '{i18n>Status}';
  budget        @title: '{i18n>Budget}';
  startDate     @title: '{i18n>StartDate}';
  endDate       @title: '{i18n>EndDate}';
  clientName    @title: '{i18n>Client}';
};
