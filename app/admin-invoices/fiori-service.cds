using AdminService from '../../srv/admin-service';

////////////////////////////////////////////////////////////////////////////
//
//  Invoices
//
annotate AdminService.Invoices with @(
  UI.HeaderInfo     : {
    TypeName      : '{i18n>Invoice}',
    TypeNamePlural: '{i18n>Invoices}',
    Title         : {Value: invoiceNumber},
    Description   : {Value: clientName}
  },
  UI.LineItem       : [
    {Value: invoiceNumber, Label: '{i18n>InvoiceNumber}'},
    {Value: issueDate, Label: '{i18n>IssueDate}'},
    {Value: dueDate, Label: '{i18n>DueDate}'},
    {Value: status, Label: '{i18n>Status}'},
    {Value: total, Label: '{i18n>Total}'},
    {Value: clientName, Label: '{i18n>Client}'}
  ],
  UI.SelectionFields: [status, client],
  UI.Facets         : [
    {
      $Type : 'UI.CollectionFacet',
      Label : '{i18n>Header}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Target: '@UI.FieldGroup#Header'
        }
      ]
    },
    {
      $Type : 'UI.CollectionFacet',
      Label : '{i18n>Totals}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Target: '@UI.FieldGroup#Totals'
        }
      ]
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>Lines}',
      Target: 'lines/@UI.LineItem'
    }
  ],
  UI.FieldGroup #Header: {Data: [
    {Value: invoiceNumber, Label: '{i18n>InvoiceNumber}'},
    {Value: issueDate, Label: '{i18n>IssueDate}'},
    {Value: dueDate, Label: '{i18n>DueDate}'},
    {Value: status, Label: '{i18n>Status}'},
    {Value: client, Label: '{i18n>Client}'}
  ]},
  UI.FieldGroup #Totals: {Data: [
    {Value: subtotal, Label: '{i18n>Subtotal}'},
    {Value: taxAmount, Label: '{i18n>TaxAmount}'},
    {Value: total, Label: '{i18n>Total}'},
    {Value: taxRate, Label: '{i18n>TaxRate}'},
    {Value: currency, Label: '{i18n>Currency}'}
  ]}
);

annotate AdminService.Invoices with {
  ID            @UI.Hidden;
  lines         @UI.Hidden;
  billingPeriod @UI.Hidden;
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
  invoiceNumber @title: '{i18n>InvoiceNumber}';
  issueDate     @title: '{i18n>IssueDate}';
  dueDate       @title: '{i18n>DueDate}';
  status        @title: '{i18n>Status}';
  total         @title: '{i18n>Total}';
  clientName    @title: '{i18n>Client}';
};
