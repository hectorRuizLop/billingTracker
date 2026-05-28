sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, JSONModel, MessageBox) {
  "use strict";

  return Controller.extend("nubexx.billing.manager.controller.TimeEntriesList", {

    onInit: function () {
      this._oKpiModel = new JSONModel({totalEntries: 0, pendingEntries: 0, approvedEntries: 0, rejectedEntries: 0});
      this.getView().setModel(this._oKpiModel, "kpiModel");

      this.getOwnerComponent().getRouter().getRoute("TimeEntriesList").attachPatternMatched(this._onRouteMatched, this);

      var oTable = this.getView().byId("timeEntriesTable");
      if (oTable) {
        oTable.attachEvent("updateFinished", this._updateKPIs, this);
      }
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
    },

    _updateKPIs: function () {
      var oTable = this.getView().byId("timeEntriesTable");
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

      var iPending = 0, iApproved = 0, iRejected = 0;

      aContexts.forEach(function (oCtx) {
        if (!oCtx) return;
        var sStatus = oCtx.getProperty("status");
        if (sStatus === "S") iPending++;
        else if (sStatus === "A") iApproved++;
        else if (sStatus === "R") iRejected++;
      });

      this._oKpiModel.setData({
        totalEntries: aContexts.length,
        pendingEntries: iPending,
        approvedEntries: iApproved,
        rejectedEntries: iRejected
      });
    },

    formatInitials: function (sName) {
      if (!sName) return "?";
      var aParts = sName.split(" ");
      if (aParts.length >= 2) {
        return (aParts[0][0] + aParts[aParts.length - 1][0]).toUpperCase();
      }
      return sName.substring(0, 2).toUpperCase();
    }
  });
});