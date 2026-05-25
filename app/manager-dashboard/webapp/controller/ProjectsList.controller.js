sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageBox) {
  "use strict";

  return Controller.extend("nubexx.billing.manager.controller.ProjectsList", {

    onInit: function () {
      this.getOwnerComponent().getRouter().getRoute("ProjectsList").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      var oFCL = this.getOwnerComponent().getRootControl().byId("appFCL");
      if (oFCL) {
        oFCL.setLayout("OneColumn");
      }
      this.getView().byId("projectsTable").getBinding("items").refresh();
    },

    onSelectionChange: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      var sKey = oItem.getBindingContext().getProperty("ID");
      this.getOwnerComponent().getRouter().navTo("ProjectDetail", { key: sKey });
    },

    onPress: function (oEvent) {
      var sKey = oEvent.getSource().getBindingContext().getProperty("ID");
      this.getOwnerComponent().getRouter().navTo("ProjectDetail", { key: sKey });
    },

    onSearch: function (oEvent) {
      this._applyFilters();
    },

    onFilterChange: function () {
      this._applyFilters();
    },

    _applyFilters: function () {
      var aFilters = [];
      var sSearch = this.getView().byId("searchField") ? this.getView().byId("searchField").getValue() : "";
      var sStatus = this.getView().byId("statusFilter").getSelectedKey();
      if (sSearch) {
        aFilters.push(new Filter("name", FilterOperator.Contains, sSearch));
      }
      if (sStatus) {
        aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
      }
      this.getView().byId("projectsTable").getBinding("items").filter(aFilters);
    },

    onCreate: function () {
      MessageBox.information("Create not yet implemented in custom view.");
    }
  });
});