using AdminService from '../../srv/admin-service';

////////////////////////////////////////////////////////////////////////////
//
//  Employees
//
annotate AdminService.Employees with @(
  UI.HeaderInfo     : {
    TypeName      : '{i18n>Employee}',
    TypeNamePlural: '{i18n>Employees}',
    Title         : {Value: fullName},
    Description   : {Value: email}
  },
  UI.LineItem       : [
    {Value: fullName, Label: '{i18n>Employee}'},
    {Value: email, Label: '{i18n>Email}'},
    {Value: roleText, Label: '{i18n>Role}'},
    {Value: isActive, Label: '{i18n>Active}'},
    {Value: categoryName, Label: '{i18n>Category}'}
  ],
  UI.SelectionFields: [role, isActive, categoryName],
  UI.Facets         : [
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>PersonalInfo}',
      Target: '@UI.FieldGroup#Personal'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>WorkInfo}',
      Target: '@UI.FieldGroup#Work'
    }
  ],
  UI.FieldGroup #Personal: {
    Label: '{i18n>PersonalInfo}',
    Data: [
      {Value: firstName, Label: '{i18n>FirstName}'},
      {Value: lastName, Label: '{i18n>LastName}'},
      {Value: email, Label: '{i18n>Email}'},
      {Value: phone, Label: '{i18n>Phone}'}
    ]
  },
  UI.FieldGroup #Work    : {
    Label: '{i18n>WorkInfo}',
    Data: [
      {Value: role, Label: '{i18n>Role}'},
      {Value: isActive, Label: '{i18n>Active}'},
      {Value: categoryName, Label: '{i18n>Category}'},
      {Value: externalId, Label: '{i18n>ExternalId}'}
    ]
  }
);

annotate AdminService.Employees with {
  ID           @UI.Hidden;
  assignments  @UI.Hidden;
  timeEntries  @UI.Hidden;
  managedProjects @UI.Hidden;
  firstName    @title: '{i18n>FirstName}';
  lastName     @title: '{i18n>LastName}';
  email        @title: '{i18n>Email}';
  phone        @title: '{i18n>Phone}';
  role         @title: '{i18n>Role}';
  roleText     @title: '{i18n>Role}';
  isActive     @title: '{i18n>Active}';
  categoryName @title: '{i18n>Category}';
  fullName     @title: '{i18n>Employee}';
  category     @Common.Text: categoryName;
  category     @Common.TextArrangement: #TextOnly;
};
