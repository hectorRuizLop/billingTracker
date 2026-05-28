sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History"
], function (Controller, History) {
  "use strict";

  return Controller.extend("nubexx.billing.employee.controller.MyTimeEntriesDetail", {

    onInit: function () {
      this.getOwnerComponent().getRouter().getRoute("MyTimeEntriesDetail").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var sKey = oEvent.getParameter("arguments").key;
      this.getView().bindElement({
        path: "/MyTimeEntries(" + sKey + ")"
      });

      var oFCL = this.getOwnerComponent().getRootControl().byId("appFCL");
      if (oFCL) {
        oFCL.setLayout("TwoColumnsMidExpanded");
      }
    },

    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();
      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("MyTimeEntriesList", {}, true);
      }
    },

    formatProjectInitials: function (sName) {
      if (!sName) return "?";
      return sName.substring(0, 2).toUpperCase();
    }
  });
});
