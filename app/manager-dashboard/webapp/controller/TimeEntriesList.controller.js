sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageBox) {
  "use strict";

  return Controller.extend("nubexx.billing.manager.controller.TimeEntriesList", {

    onInit: function () {
      this.getOwnerComponent().getRouter().getRoute("TimeEntriesList").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      var oFCL = this.getOwnerComponent().getRootControl().byId("appFCL");
      if (oFCL) {
        oFCL.setLayout("OneColumn");
      }
      this.getView().byId("timeEntriesTable").getBinding("items").refresh();
    },

    onPress: function (oEvent) {
      var sKey = oEvent.getSource().getBindingContext().getProperty("ID");
      this.getOwnerComponent().getRouter().navTo("TimeEntryDetail", { key: sKey });
    },

    onSearch: function () {
      this._applyFilters();
    },

    onFilterChange: function () {
      this._applyFilters();
    },

    _applyFilters: function () {
      var aFilters = [];
      var sStatus = this.getView().byId("statusFilter").getSelectedKey();
      if (sStatus) {
        aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
      }
      this.getView().byId("timeEntriesTable").getBinding("items").filter(aFilters);
    },

    _getSelectedContexts: function () {
      return this.getView().byId("timeEntriesTable").getSelectedContexts();
    },

    onApprove: function () {
      var aContexts = this._getSelectedContexts();
      if (aContexts.length === 0) {
        MessageBox.warning("Please select at least one time entry.");
        return;
      }
      MessageBox.information("Bulk approve not yet implemented in custom view.");
    },

    onReject: function () {
      var aContexts = this._getSelectedContexts();
      if (aContexts.length === 0) {
        MessageBox.warning("Please select at least one time entry.");
        return;
      }
      MessageBox.information("Bulk reject not yet implemented in custom view.");
    }
  });
});