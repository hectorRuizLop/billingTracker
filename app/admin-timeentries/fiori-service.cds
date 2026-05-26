using AdminService from '../../srv/admin-service';

////////////////////////////////////////////////////////////////////////////
//
//  TimeEntries
//
annotate AdminService.TimeEntries with @(
  UI.HeaderInfo     : {
    TypeName      : '{i18n>TimeEntry}',
    TypeNamePlural: '{i18n>TimeEntries}',
    Title         : {Value: date},
    Description   : {Value: projectName}
  },
  UI.LineItem       : [
    {Value: date, Label: '{i18n>Date}'},
    {Value: projectName, Label: '{i18n>Project}'},
    {Value: employeeName, Label: '{i18n>Employee}'},
    {Value: hours, Label: '{i18n>Hours}'},
    {Value: status, Label: '{i18n>Status}'},
    {Value: cost, Label: '{i18n>Cost}'}
  ],
  UI.SelectionFields: [status, date],
  UI.Facets         : [
    {
      $Type : 'UI.CollectionFacet',
      Label : '{i18n>EntryDetails}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Target: '@UI.FieldGroup#EntryDetails'
        }
      ]
    },
    {
      $Type : 'UI.CollectionFacet',
      Label : '{i18n>ReviewInfo}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Target: '@UI.FieldGroup#ReviewInfo'
        }
      ]
    }
  ],
  UI.FieldGroup #EntryDetails: {Data: [
    {Value: date, Label: '{i18n>Date}'},
    {Value: employeeName, Label: '{i18n>Employee}'},
    {Value: projectName, Label: '{i18n>Project}'},
    {Value: hours, Label: '{i18n>Hours}'},
    {Value: description, Label: '{i18n>Description}'},
    {Value: cost, Label: '{i18n>Cost}'}
  ]},
  UI.FieldGroup #ReviewInfo  : {Data: [
    {Value: status, Label: '{i18n>Status}'},
    {Value: reviewedAt, Label: '{i18n>ReviewedAt}'},
    {Value: reviewedBy, Label: '{i18n>ReviewedBy}'},
    {Value: rejectionNote, Label: '{i18n>RejectionNote}'}
  ]}
);

annotate AdminService.TimeEntries with {
  ID           @UI.Hidden;
  month        @UI.Hidden;
  year         @UI.Hidden;
  rateSnapshot @UI.Hidden;
  billingStatus @UI.Hidden;
  date         @title: '{i18n>Date}';
  hours        @title: '{i18n>Hours}';
  description  @title: '{i18n>Description}'  @UI.MultiLineText;
  status       @title: '{i18n>Status}';
  cost         @title: '{i18n>Cost}';
  employeeName @title: '{i18n>Employee}';
  projectName  @title: '{i18n>Project}';
};
