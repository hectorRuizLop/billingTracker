sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History"
], function (Controller, History) {
  "use strict";

  return Controller.extend("nubexx.billing.admin.invoices.controller.InvoiceDetail", {

    onInit: function () {
      this.getOwnerComponent().getRouter().getRoute("InvoiceDetail").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var sKey = oEvent.getParameter("arguments").key;
      this.getView().bindElement({
        path: "/Invoices(" + sKey + ")"
      });
    },

    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();
      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("InvoiceList", {}, true);
      }
    }
  });
});
