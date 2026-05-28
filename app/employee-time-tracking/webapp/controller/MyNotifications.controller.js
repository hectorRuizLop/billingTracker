sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox"
], function (Controller, MessageBox) {
  "use strict";

  return Controller.extend("nubexx.billing.employee.controller.MyNotifications", {

    onInit: function () {
      this.getOwnerComponent().getRouter().getRoute("MyNotifications").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      var oFCL = this.getOwnerComponent().getRootControl().byId("appFCL");
      if (oFCL) {
        oFCL.setLayout("OneColumn");
      }
      this._refreshNotifications();
    },

    _refreshNotifications: function () {
      var oList = this.getView().byId("notificationList");
      if (oList) {
        var oBinding = oList.getBinding("items");
        if (oBinding) {
          var oHeaderContext = oBinding.getHeaderContext();
          if (oHeaderContext) {
            oHeaderContext.refresh();
          }
        }
      }
    },

    onMarkRead: function (oEvent) {
      var oCtx = oEvent.getSource().getBindingContext();
      var sId = oCtx.getProperty("ID");
      var oModel = this.getView().getModel();
      var oActionBinding = oModel.bindContext("/markNotificationRead(...)", null);
      oActionBinding.setParameter("notificationId", sId);
      oActionBinding.execute().then(function () {
        this._refreshNotifications();
      }.bind(this)).catch(function (oError) {
        MessageBox.error(oError.message || "Failed to mark as read.");
      });
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("MyTimeEntriesList", {}, true);
    }
  });
});
