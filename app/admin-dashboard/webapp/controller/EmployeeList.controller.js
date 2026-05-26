sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/json/JSONModel"
], function (Controller, Filter, FilterOperator, JSONModel) {
  "use strict";

  return Controller.extend("nubexx.billing.admin.controller.EmployeeList", {

    onInit: function () {
      this._sSearchQuery = "";
      this._sRole = "";
      this._bActiveOnly = false;

      this._oKPIModel = new JSONModel({total: 0, active: 0, managers: 0});
      this.getView().setModel(this._oKPIModel, "kpiModel");

      this._oFilterCountModel = new JSONModel({all: 0, employee: 0, manager: 0, admin: 0});
      this.getView().setModel(this._oFilterCountModel, "filterCountModel");

      this.getOwnerComponent().getRouter().getRoute("EmployeeList").attachPatternMatched(this._onRouteMatched, this);

      // Fetch KPI stats after model is ready
      setTimeout(this._fetchEmployeeStats.bind(this), 1000);
    },

    _fetchEmployeeStats: function () {
      var oModel = this.getView().getModel();
      if (!oModel) {
        return;
      }
      var oListBinding = oModel.bindList("/Employees");
      oListBinding.requestContexts(0, 999).then(function (aContexts) {
        var iTotal = aContexts.length;
        var iActive = 0;
        var iManagers = 0;
        var oCounts = {all: aContexts.length, employee: 0, manager: 0, admin: 0};

        aContexts.forEach(function (oCtx) {
          if (oCtx.getProperty("isActive")) {
            iActive++;
          }
          var sRole = oCtx.getProperty("role");
          if (sRole === "M") {
            iManagers++;
          }
          if (sRole === "E") {
            oCounts.employee++;
          } else if (sRole === "M") {
            oCounts.manager++;
          } else if (sRole === "A") {
            oCounts.admin++;
          }
        });

        this._oKPIModel.setData({total: iTotal, active: iActive, managers: iManagers});
        this._oFilterCountModel.setData(oCounts);
      }.bind(this)).catch(function () {});
    },

    _onRouteMatched: function () {
      var oFCL = this.getOwnerComponent().getRootControl().byId("appFCL");
      if (oFCL) {
        oFCL.setLayout("OneColumn");
      }
      this._refreshEmployees();
    },

    _refreshEmployees: function () {
      var oTable = this.getView().byId("employeeTable");
      if (oTable) {
        var oBinding = oTable.getBinding("items");
        if (oBinding) {
          var oHeaderContext = oBinding.getHeaderContext();
          if (oHeaderContext) {
            oHeaderContext.refresh();
          }
        }
      }
    },

    onPress: function (oEvent) {
      var sKey = oEvent.getSource().getBindingContext().getProperty("ID");
      this.getOwnerComponent().getRouter().navTo("EmployeeDetail", {
        key: sKey
      });
    },

    onSearch: function (oEvent) {
      this._sSearchQuery = oEvent.getParameter("query");
      this._applyFilters();
    },

    onRoleFilterChange: function (oEvent) {
      this._sRole = oEvent.getParameter("key");
      this._applyFilters();
    },

    onActiveFilterChange: function (oEvent) {
      this._bActiveOnly = oEvent.getParameter("pressed");
      this._applyFilters();
    },

    _applyFilters: function () {
      var aFilters = [];
      if (this._sSearchQuery) {
        aFilters.push(new Filter("fullName", FilterOperator.Contains, this._sSearchQuery));
      }
      if (this._sRole) {
        aFilters.push(new Filter("role", FilterOperator.EQ, this._sRole));
      }
      if (this._bActiveOnly) {
        aFilters.push(new Filter("isActive", FilterOperator.EQ, true));
      }

      var oTable = this.getView().byId("employeeTable");
      if (oTable) {
        var oBinding = oTable.getBinding("items");
        if (oBinding) {
          if (aFilters.length > 0) {
            oBinding.filter(new Filter({filters: aFilters, and: true}));
          } else {
            oBinding.filter([]);
          }
        }
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

    formatCategoryState: function (sCategory) {
      switch (sCategory) {
        case "Senior":
          return "Success";
        case "Lead":
          return "Warning";
        case "Mid Level":
          return "Information";
        case "Junior":
        default:
          return "None";
      }
    },

    formatAssignmentLoad: function (oEmployee) {
      if (!oEmployee || !oEmployee.assignments) {
        return 0;
      }
      var aAssignments = oEmployee.assignments;
      if (aAssignments.length === 0) {
        return 0;
      }
      var iActive = 0;
      aAssignments.forEach(function (oAssignment) {
        if (oAssignment.isActive) {
          iActive++;
        }
      });
      // Max reference load = 5 projects
      return Math.min(100, Math.round((iActive / 5) * 100));
    },

    formatAssignmentCount: function (oEmployee) {
      if (!oEmployee || !oEmployee.assignments) {
        return "0";
      }
      var aAssignments = oEmployee.assignments;
      var iActive = 0;
      aAssignments.forEach(function (oAssignment) {
        if (oAssignment.isActive) {
          iActive++;
        }
      });
      return iActive + "/5";
    }
  });
});
