sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, JSONModel, MessageBox) {
  "use strict";

  return Controller.extend("nubexx.billing.manager.controller.ProjectsList", {

    onInit: function () {
      this._oKpiModel = new JSONModel({totalProjects: 0, openProjects: 0, totalBudget: 0, totalHours: 0});
      this.getView().setModel(this._oKpiModel, "kpiModel");

      this.getOwnerComponent().getRouter().getRoute("ProjectsList").attachPatternMatched(this._onRouteMatched, this);

      var oTable = this.getView().byId("projectsTable");
      if (oTable) {
        oTable.attachEvent("updateFinished", this._updateKPIs, this);
      }
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
    },

    _updateKPIs: function () {
      var oTable = this.getView().byId("projectsTable");
      if (!oTable) return;
      var oBinding = oTable.getBinding("items");
      if (!oBinding) return;

      var iLength = oBinding.getLength ? oBinding.getLength() : 0;
      var aContexts = [];
      if (oBinding.getAllCurrentContexts) {
        aContexts = oBinding.getAllCurrentContexts();
      } else if (oBinding.getContexts) {
        aContexts = oBinding.getContexts(0, iLength);
      }

      var iTotalProjects = aContexts.length;
      var iOpenProjects = 0;
      var fTotalBudget = 0;
      var fTotalHours = 0;

      aContexts.forEach(function (oCtx) {
        if (!oCtx) return;
        if (oCtx.getProperty("status") === "O") iOpenProjects++;
        fTotalBudget += parseFloat(oCtx.getProperty("budget")) || 0;
        fTotalHours += parseFloat(oCtx.getProperty("totalHours")) || 0;
      });

      this._oKpiModel.setData({
        totalProjects: iTotalProjects,
        openProjects: iOpenProjects,
        totalBudget: (fTotalBudget / 1000).toFixed(0),
        totalHours: fTotalHours.toFixed(0)
      });
    },

    formatProjectInitials: function (sName) {
      if (!sName) return "?";
      return sName.substring(0, 2).toUpperCase();
    }
  });
});