sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/Dialog",
  "sap/m/DatePicker",
  "sap/m/Button",
  "sap/m/VBox",
  "sap/m/Popover",
  "sap/m/Text"
], function (Controller, Filter, FilterOperator, JSONModel, MessageBox, Dialog, DatePicker, Button, VBox, Popover, Text) {
  "use strict";

  return Controller.extend("nubexx.billing.employee.controller.MyTimeEntriesList", {

    onInit: function () {
      this._sSearchQuery = "";
      this._sStatus = "";
      this._sDateFrom = "";
      this._sDateTo = "";
      this._sProjectFilter = "";

      this._oWeekModel = new JSONModel({columns: []});
      this.getView().setModel(this._oWeekModel, "weekModel");

      this._oPeriodModel = new JSONModel({key: "week", title: "Weekly Hours"});
      this.getView().setModel(this._oPeriodModel, "periodModel");

      this._oStatusCountModel = new JSONModel({all: 0, draft: 0, submitted: 0, approved: 0, rejected: 0});
      this.getView().setModel(this._oStatusCountModel, "statusCountModel");

      this.getOwnerComponent().getRouter().getRoute("MyTimeEntriesList").attachPatternMatched(this._onRouteMatched, this);

      this._oNotificationModel = new JSONModel({count: 0});
      this.getView().setModel(this._oNotificationModel, "notifications");

      this._startNotificationPolling();

      // Attach to table data loaded to update week chart
      var oTable = this.getView().byId("timeEntriesTable");
      if (oTable) {
        oTable.attachEvent("updateFinished", this._onTableUpdateFinished, this);
      }

    },



    _onRouteMatched: function () {
      var oFCL = this.getOwnerComponent().getRootControl().byId("appFCL");
      if (oFCL) {
        oFCL.setLayout("OneColumn");
      }
      this._refreshTimeEntries();
      this._fetchNotificationCount();
    },

    _startNotificationPolling: function () {
      this._notificationInterval = setInterval(function () {
        this._fetchNotificationCount();
      }.bind(this), 30000);
    },

    _fetchNotificationCount: function () {
      var oModel = this.getView().getModel();
      var oListBinding = oModel.bindList("/MyNotifications", null, null, [new Filter("isRead", FilterOperator.EQ, false)]);
      oListBinding.requestContexts(0, 1).then(function (aContexts) {
        var iCount = oListBinding.getLength ? oListBinding.getLength() : aContexts.length;
        this._oNotificationModel.setProperty("/count", iCount);
        var oBell = this.getView().byId("notificationBell");
        if (oBell) {
          oBell.getCustomData()[0].setValue(String(iCount));
          oBell.setType(iCount > 0 ? "Emphasized" : "Transparent");
        }
      }.bind(this)).catch(function () {
        // silently ignore
      });
    },

    onOpenNotifications: function () {
      this.getOwnerComponent().getRouter().navTo("MyNotifications");
    },

    onExit: function () {
      if (this._notificationInterval) {
        clearInterval(this._notificationInterval);
      }
    },

    _onTableUpdateFinished: function () {
      this._updateWeekChart();
      this._updateStatusCountsAsync();
      this._updateRejectionButtonVisibility();
    },

    _updateStatusCountsAsync: function () {
      var oTable = this.getView().byId("timeEntriesTable");
      if (!oTable) {
        return;
      }

      var oBinding = oTable.getBinding("items");
      if (!oBinding) {
        return;
      }

      var iLength = oBinding.getLength ? oBinding.getLength() : 0;

      // requestContexts loads ALL data from the server for accurate counts
      var oRequest = oBinding.requestContexts ? oBinding.requestContexts(0, iLength) : Promise.resolve([]);

      oRequest.then(function (aContexts) {
        var oCounts = {all: aContexts.length, draft: 0, submitted: 0, approved: 0, rejected: 0};

        aContexts.forEach(function (oCtx) {
          var sStatus = oCtx.getProperty("status");
          if (sStatus === "D") {
            oCounts.draft++;
          } else if (sStatus === "S") {
            oCounts.submitted++;
          } else if (sStatus === "A") {
            oCounts.approved++;
          } else if (sStatus === "R") {
            oCounts.rejected++;
          }
        });

        // Cache totals when viewing "All" (no status filter)
        if (!this._sStatus) {
          this._oTotalStatusCounts = oCounts;
        }

        // Show totals when filtered, otherwise show current counts
        if (this._sStatus && this._oTotalStatusCounts) {
          this._oStatusCountModel.setData(this._oTotalStatusCounts);
        } else {
          this._oStatusCountModel.setData(oCounts);
        }
      }.bind(this)).catch(function () {
        // Fallback to synchronous method with currently loaded contexts
        this._updateStatusCounts();
      }.bind(this));
    },

    _updateRejectionButtonVisibility: function () {
      var oTable = this.getView().byId("timeEntriesTable");
      if (!oTable) {
        return;
      }
      oTable.getItems().forEach(function (oItem) {
        var oCtx = oItem.getBindingContext();
        var aCells = oItem.getCells();
        var oBtn = aCells[4]; // alert button at index 4
        if (oBtn && oCtx) {
          oBtn.setVisible(oCtx.getProperty("status") === "R");
        }
      });
    },

    onPeriodChange: function (oEvent) {
      var sKey = oEvent.getParameter("key");
      var sTitle = sKey === "week" ? "Weekly Hours" : sKey === "month" ? "Monthly Hours" : "Yearly Hours";
      this._oPeriodModel.setProperty("/key", sKey);
      this._oPeriodModel.setProperty("/title", sTitle);
      this._updateWeekChart();
    },

    _updateWeekChart: function () {
      var oTable = this.getView().byId("timeEntriesTable");
      if (!oTable) {
        return;
      }

      var oBinding = oTable.getBinding("items");
      if (!oBinding) {
        return;
      }

      // Get ALL contexts from the binding, not just visible table items
      var iLength = oBinding.getLength ? oBinding.getLength() : 0;
      var aContexts = [];
      if (oBinding.getAllCurrentContexts) {
        aContexts = oBinding.getAllCurrentContexts();
      } else if (oBinding.getContexts) {
        aContexts = oBinding.getContexts(0, iLength);
      }

      var aData = [];
      aContexts.forEach(function (oCtx) {
        if (oCtx) {
          aData.push({
            date: oCtx.getProperty("date"),
            hours: parseFloat(oCtx.getProperty("hours")) || 0
          });
        }
      });

      var sPeriod = this._oPeriodModel.getProperty("/key") || "week";

      // Find the most recent date with data
      var oLatestDate = null;
      aData.forEach(function (oItem) {
        if (oItem.date) {
          var oDate = new Date(oItem.date + "T00:00:00");
          if (!oLatestDate || oDate > oLatestDate) {
            oLatestDate = oDate;
          }
        }
      });

      var oBaseDate = oLatestDate || new Date();

      if (sPeriod === "year") {
        this._updateYearChart(aData, oBaseDate);
      } else if (sPeriod === "month") {
        this._updateMonthChart(aData, oBaseDate);
      } else {
        this._updateWeekDayChart(aData, oBaseDate);
      }
    },

    _updateWeekDayChart: function (aData, oBaseDate) {
      var aDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
      var oMonday = this._findMonday(oBaseDate);
      var aColumns = [];
      var bHasData = false;

      // Look back up to 10 weeks to find one with data
      for (var w = 0; w < 10; w++) {
        aColumns = [];
        bHasData = false;

        for (var i = 0; i < 5; i++) {
          var oDay = new Date(oMonday);
          oDay.setDate(oMonday.getDate() + i);
          var sDayKey = this._formatDate(oDay);
          var fHours = 0;

          aData.forEach(function (oItem) {
            if (oItem.date === sDayKey) {
              fHours += oItem.hours;
            }
          });

          if (fHours > 0) {
            bHasData = true;
          }

          aColumns.push({
            label: aDayNames[i],
            value: fHours,
            color: this._getChartColor(fHours)
          });
        }

        if (bHasData) {
          break;
        }

        // Go one week back
        oMonday.setDate(oMonday.getDate() - 7);
      }

      this._oWeekModel.setProperty("/columns", aColumns);
    },

    _findMonday: function (oDate) {
      var iDayOfWeek = oDate.getDay();
      var iDiffToMonday = oDate.getDate() - iDayOfWeek + (iDayOfWeek === 0 ? -6 : 1);
      var oMonday = new Date(oDate.getFullYear(), oDate.getMonth(), iDiffToMonday);
      oMonday.setHours(0, 0, 0, 0);
      return oMonday;
    },

    _updateMonthChart: function (aData, oBaseDate) {
      var iYear = oBaseDate.getFullYear();
      var iMonth = oBaseDate.getMonth();
      var aWeeks = [0, 0, 0, 0];
      var aLabels = ["W1", "W2", "W3", "W4"];

      aData.forEach(function (oItem) {
        if (oItem.date) {
          var oDate = new Date(oItem.date + "T00:00:00");
          if (oDate.getFullYear() === iYear && oDate.getMonth() === iMonth) {
            var iDay = oDate.getDate();
            var iWeek = Math.min(3, Math.floor((iDay - 1) / 7));
            aWeeks[iWeek] += oItem.hours;
          }
        }
      });

      var aColumns = [];
      for (var i = 0; i < 4; i++) {
        aColumns.push({
          label: aLabels[i],
          value: aWeeks[i],
          color: this._getChartColor(aWeeks[i])
        });
      }

      this._oWeekModel.setProperty("/columns", aColumns);
    },

    _updateYearChart: function (aData, oBaseDate) {
      var iYear = oBaseDate.getFullYear();
      var aMonths = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      var aLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      aData.forEach(function (oItem) {
        if (oItem.date) {
          var oDate = new Date(oItem.date + "T00:00:00");
          if (oDate.getFullYear() === iYear) {
            aMonths[oDate.getMonth()] += oItem.hours;
          }
        }
      });

      var aColumns = [];
      for (var i = 0; i < 12; i++) {
        aColumns.push({
          label: aLabels[i],
          value: aMonths[i],
          color: this._getChartColor(aMonths[i])
        });
      }

      this._oWeekModel.setProperty("/columns", aColumns);
    },

    _getChartColor: function (fHours) {
      if (fHours >= 6) {
        return "Good";
      } else if (fHours >= 3) {
        return "Critical";
      } else if (fHours > 0) {
        return "Error";
      }
      return "Neutral";
    },

    _updateStatusCounts: function () {
      var oTable = this.getView().byId("timeEntriesTable");
      if (!oTable) {
        return;
      }

      var oBinding = oTable.getBinding("items");
      if (!oBinding) {
        return;
      }

      var aContexts = oBinding.getAllCurrentContexts ? oBinding.getAllCurrentContexts() : [];
      var oCounts = {all: aContexts.length, draft: 0, submitted: 0, approved: 0, rejected: 0};

      aContexts.forEach(function (oCtx) {
        var sStatus = oCtx.getProperty("status");
        if (sStatus === "D") {
          oCounts.draft++;
        } else if (sStatus === "S") {
          oCounts.submitted++;
        } else if (sStatus === "A") {
          oCounts.approved++;
        } else if (sStatus === "R") {
          oCounts.rejected++;
        }
      });

      this._oStatusCountModel.setData(oCounts);
    },

    _refreshTimeEntries: function () {
      var oTable = this.getView().byId("timeEntriesTable");
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

    onSelectionChange: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      this._navToDetail(oItem.getBindingContext());
    },

    onPress: function (oEvent) {
      this._navToDetail(oEvent.getSource().getBindingContext());
    },

    _navToDetail: function (oContext) {
      var sKey = oContext.getProperty("ID");
      this.getOwnerComponent().getRouter().navTo("MyTimeEntriesDetail", {
        key: sKey
      });
    },

    onSearch: function (oEvent) {
      this._sSearchQuery = oEvent.getParameter("query");
      this._applyFilters();
    },

    onStatusIconTabSelect: function (oEvent) {
      var sKey = oEvent.getParameter("key");
      this._sStatus = (sKey === "all") ? "" : sKey;
      this._applyFilters();
    },

    onDateRangeFilterChange: function (oEvent) {
      var oSource = oEvent.getSource();
      this._sDateFrom = oSource.getDateValue() ? this._formatDate(oSource.getDateValue()) : "";
      this._sDateTo = oSource.getSecondDateValue() ? this._formatDate(oSource.getSecondDateValue()) : "";
      this._applyFilters();
    },

    _formatDate: function (oDate) {
      var iYear = oDate.getFullYear();
      var iMonth = oDate.getMonth() + 1;
      var iDay = oDate.getDate();
      return iYear + "-" + (iMonth < 10 ? "0" + iMonth : iMonth) + "-" + (iDay < 10 ? "0" + iDay : iDay);
    },

    _applyFilters: function () {
      var aFilters = [];
      if (this._sSearchQuery) {
        aFilters.push(new Filter({
          filters: [
            new Filter("projectName", FilterOperator.Contains, this._sSearchQuery),
            new Filter("description", FilterOperator.Contains, this._sSearchQuery)
          ],
          and: false
        }));
      }
      if (this._sStatus) {
        aFilters.push(new Filter("status", FilterOperator.EQ, this._sStatus));
      }
      if (this._sDateFrom) {
        aFilters.push(new Filter("date", FilterOperator.GE, this._sDateFrom));
      }
      if (this._sDateTo) {
        aFilters.push(new Filter("date", FilterOperator.LE, this._sDateTo));
      }
      if (this._sProjectFilter) {
        aFilters.push(new Filter("projectName", FilterOperator.EQ, this._sProjectFilter));
        this._sProjectFilter = ""; // clear after one use
      }
      var oTable = this.getView().byId("timeEntriesTable");
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

    onDonutSegmentSelect: function (oEvent) {
      var aSegments = oEvent.getParameter("selectedSegments");
      if (aSegments && aSegments.length > 0) {
        var sProjectName = aSegments[0].getLabel();
        this._sProjectFilter = sProjectName;

        // Switch to time entries tab
        var oIconTabBar = this.getView().byId("iconTabBar");
        oIconTabBar.setSelectedKey("timeEntries");

        // Reset status filter to All
        var oStatusTabBar = this.getView().byId("statusIconTabBar");
        oStatusTabBar.setSelectedKey("all");
        this._sStatus = "";

        this._applyFilters();
      }
    },

    onShowRejectionNote: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext();
      var sNote = oContext ? oContext.getProperty("rejectionNote") : "";

      if (!this._oRejectionPopover) {
        this._oRejectionPopover = new Popover({
          title: "Rejection Note",
          placement: "Auto",
          content: new Text({text: sNote || "No note provided"})
        });
        this.getView().addDependent(this._oRejectionPopover);
      } else {
        this._oRejectionPopover.getContent()[0].setText(sNote || "No note provided");
      }
      this._oRejectionPopover.openBy(oSource);
    },

    formatRejectionVisible: function (status) {
      return status === "R";
    },

    formatProgressState: function (totalHours) {
      var fHours = parseFloat(totalHours) || 0;
      if (fHours >= 160) {
        return "Success";
      }
      if (fHours >= 120) {
        return "Warning";
      }
      return "None";
    },

    onTabSelect: function (oEvent) {
      var sKey = oEvent.getParameter("key");
      var oTable, oBinding, oHeaderContext;
      if (sKey === "projectSummary") {
        oTable = this.getView().byId("projectSummaryTable");
        oBinding = oTable.getBinding("items");
        if (oBinding) {
          try {
            oHeaderContext = oBinding.getHeaderContext();
            if (oHeaderContext) {
              oHeaderContext.refresh();
            }
          } catch (e) {
            // Some bindings don't support header context refresh
          }
        }
      } else if (sKey === "monthlySummary") {
        oTable = this.getView().byId("monthlySummaryTable");
        oBinding = oTable.getBinding("items");
        if (oBinding) {
          try {
            oHeaderContext = oBinding.getHeaderContext();
            if (oHeaderContext) {
              oHeaderContext.refresh();
            }
          } catch (e) {
            // Some bindings don't support header context refresh
          }
        }
      }
    },

    onSubmitMonth: function () {
      var that = this;

      if (this._oSubmitDialog) {
        this._oSubmitDialog.destroy();
      }

      var oDatePicker = new DatePicker({
        displayFormat: "MM/yyyy",
        valueFormat: "yyyy-MM",
        placeholder: "Select month and year"
      });

      this._oSubmitDialog = new Dialog({
        title: "Submit Month",
        content: new VBox({
          items: [oDatePicker]
        }).addStyleClass("sapUiSmallMargin"),
        beginButton: new Button({
          text: "Submit",
          type: "Emphasized",
          press: function () {
            var sValue = oDatePicker.getValue();
            if (!sValue) {
              MessageBox.error("Please select a month.");
              return;
            }
            var aParts = sValue.split("-");
            var iYear = parseInt(aParts[0], 10);
            var iMonth = parseInt(aParts[1], 10);
            if (isNaN(iYear) || isNaN(iMonth)) {
              MessageBox.error("Invalid date selection.");
              return;
            }
            that._oSubmitDialog.close();
            that._callSubmitMonth(iYear, iMonth);
          }
        }),
        endButton: new Button({
          text: "Cancel",
          press: function () {
            that._oSubmitDialog.close();
          }
        }),
        afterClose: function () {
          that._oSubmitDialog.destroy();
          that._oSubmitDialog = null;
        }
      });

      this.getView().addDependent(this._oSubmitDialog);
      this._oSubmitDialog.open();
    },

    _callSubmitMonth: function (iYear, iMonth) {
      var oModel = this.getView().getModel();
      var oActionBinding = oModel.bindContext("/submitMonth(...)", null);
      oActionBinding.setParameter("year", iYear);
      oActionBinding.setParameter("month", iMonth);
      oActionBinding.execute().then(function () {
        MessageBox.success("Month submitted successfully.");
        this._refreshTimeEntries();
      }.bind(this)).catch(function (oError) {
        MessageBox.error(oError.message || "Failed to submit month.");
      });
    }
  });
});
