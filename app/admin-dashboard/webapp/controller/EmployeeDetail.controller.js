sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History"
], function (Controller, History) {
  "use strict";

  return Controller.extend("nubexx.billing.admin.controller.EmployeeDetail", {

    onInit: function () {
      this.getOwnerComponent().getRouter().getRoute("EmployeeDetail").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var sKey = oEvent.getParameter("arguments").key;
      this.getView().bindElement({
        path: "/Employees(" + sKey + ")"
      });
      var oFCL = this.getOwnerComponent().getRootControl().byId("appFCL");
      if (oFCL) {
        oFCL.setLayout("TwoColumnsMidExpanded");
      }
    },

    formatInitials: function (sFirstName, sLastName) {
      var sInitials = "";
      if (sFirstName) {
        sInitials += sFirstName.charAt(0).toUpperCase();
      }
      if (sLastName) {
        sInitials += sLastName.charAt(0).toUpperCase();
      }
      return sInitials;
    },

    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();
      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("EmployeeList", {}, true);
      }
    }
  });
});
