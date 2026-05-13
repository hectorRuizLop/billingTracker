"use strict";

sap.ui.define([
  "sap/ui/core/mvc/ControllerExtension"
], function (ControllerExtension) {
  return ControllerExtension.extend("nubexx.billing.employee.ext.controller.Navigation", {
    onProjectSummary: function (oEvent) {
      this.base.getExtensionAPI().getRouting().navigateToRoute("MyProjectSummaryList");
    },

    onMonthlySummary: function (oEvent) {
      this.base.getExtensionAPI().getRouting().navigateToRoute("MyMonthlySummaryList");
    }
  });
});
