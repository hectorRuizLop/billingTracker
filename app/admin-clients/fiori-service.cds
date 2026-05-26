using AdminService from '../../srv/admin-service';

////////////////////////////////////////////////////////////////////////////
//
//  Clients
//
annotate AdminService.Clients with @(
  UI.HeaderInfo     : {
    TypeName      : '{i18n>Client}',
    TypeNamePlural: '{i18n>Clients}',
    Title         : {Value: name},
    Description   : {Value: email}
  },
  UI.LineItem       : [
    {Value: name, Label: '{i18n>ClientName}'},
    {Value: email, Label: '{i18n>Email}'},
    {Value: phone, Label: '{i18n>Phone}'},
    {Value: taxId, Label: '{i18n>TaxId}'},
    {Value: isDeleted, Label: '{i18n>Deleted}'}
  ],
  UI.SelectionFields: [name],
  UI.Facets         : [
    {
      $Type : 'UI.CollectionFacet',
      Label : '{i18n>ContactInfo}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Target: '@UI.FieldGroup#Contact'
        }
      ]
    },
    {
      $Type : 'UI.CollectionFacet',
      Label : '{i18n>Address}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Target: '@UI.FieldGroup#Address'
        }
      ]
    }
  ],
  UI.FieldGroup #Contact: {Data: [
    {Value: name, Label: '{i18n>ClientName}'},
    {Value: email, Label: '{i18n>Email}'},
    {Value: phone, Label: '{i18n>Phone}'},
    {Value: contactName, Label: '{i18n>ContactName}'}
  ]},
  UI.FieldGroup #Address: {Data: [
    {Value: address, Label: '{i18n>Address}'},
    {Value: taxId, Label: '{i18n>TaxId}'},
    {Value: notes, Label: '{i18n>Notes}'}
  ]}
);

annotate AdminService.Clients with {
  ID       @UI.Hidden;
  projects @UI.Hidden;
  name     @title: '{i18n>ClientName}';
  email    @title: '{i18n>Email}';
  phone    @title: '{i18n>Phone}';
  taxId    @title: '{i18n>TaxId}';
  isDeleted @title: '{i18n>Deleted}';
};
