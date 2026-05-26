sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageBox) {
  "use strict";

  return Controller.extend("nubexx.billing.admin.invoices.controller.InvoiceList", {

    onInit: function () {
      this.getOwnerComponent().getRouter().getRoute("InvoiceList").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.getView().byId("invoiceTable").getBinding("items").refresh();
    },

    onSelectionChange: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      var sKey = oItem.getBindingContext().getProperty("ID");
      this.getOwnerComponent().getRouter().navTo("InvoiceDetail", {
        key: sKey
      });
    },

    onPress: function (oEvent) {
      var sKey = oEvent.getSource().getBindingContext().getProperty("ID");
      this.getOwnerComponent().getRouter().navTo("InvoiceDetail", {
        key: sKey
      });
    },

    onSearch: function (oEvent) {
      var sQuery = oEvent.getParameter("query");
      var aFilters = [];
      if (sQuery) {
        aFilters.push(new Filter("invoiceNumber", FilterOperator.Contains, sQuery));
      }
      this.getView().byId("invoiceTable").getBinding("items").filter(aFilters);
    },

    onCreate: function () {
      MessageBox.information("Create not yet implemented in custom view.");
    },

    onDelete: function () {
      MessageBox.information("Delete not yet implemented in custom view.");
    }
  });
});
