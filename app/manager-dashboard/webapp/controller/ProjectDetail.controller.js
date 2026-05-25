sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/m/Dialog",
  "sap/m/TextArea",
  "sap/m/Button",
  "sap/m/VBox"
], function (Controller, History, Fragment, JSONModel, MessageBox, MessageToast, Dialog, TextArea, Button, VBox) {
  "use strict";

  return Controller.extend("nubexx.billing.manager.controller.ProjectDetail", {

    onInit: function () {
      this.getOwnerComponent().getRouter().getRoute("ProjectDetail").attachPatternMatched(this._onRouteMatched, this);
      this._oTabFragments = {};
      this._oTimeEntryFilters = { status: null, date: null, chartStatus: null };
      this._oCurrentMonth = null;
      this._iChartSyncTimeout = null;
      this._oChartModel = new JSONModel({ entries: [] });
      this.getView().setModel(this._oChartModel, "chartData");
    },

    _onRouteMatched: function (oEvent) {
      var sKey = oEvent.getParameter("arguments").key;
      this.getView().bindElement({
        path: "/Projects(" + sKey + ")",
        parameters: { $expand: "categoryStats,assignments,timeEntries" }
      });

      this._resetTabFragments();
      this._oCurrentMonth = null;
      this._loadTabFragment("general");

      var oFCL = this.getOwnerComponent().getRootControl().byId("appFCL");
      if (oFCL) {
        oFCL.setLayout("TwoColumnsMidExpanded");
      }
    },

    _resetTabFragments: function () {
      var mTabIds = {
        general: "generalTab",
        financials: "financialsTab",
        assignments: "assignmentsTab",
        timeEntries: "timeEntriesTab"
      };

      Object.keys(this._oTabFragments).forEach(function (sKey) {
        var oFragment = this._oTabFragments[sKey];
        if (oFragment) {
          var oTab = this.getView().byId(mTabIds[sKey]);
          if (oTab) {
            oTab.removeContent(oFragment);
          }
          this.getView().removeDependent(oFragment);
          oFragment.destroy();
        }
      }.bind(this));

      this._oTabFragments = {};
    },

    _loadTabFragment: function (sKey) {
      var mTabIds = {
        general: "generalTab",
        financials: "financialsTab",
        assignments: "assignmentsTab",
        timeEntries: "timeEntriesTab"
      };

      if (this._oTabFragments[sKey]) {
        return;
      }

      var mFragmentNames = {
        general: "General",
        financials: "Financial",
        assignments: "Assignments",
        timeEntries: "TimeEntries"
      };

      Fragment.load({
        name: "nubexx.billing.manager.view.fragments." + mFragmentNames[sKey] + "Tab",
        controller: this
      }).then(function (oContent) {
        this._oTabFragments[sKey] = oContent;
        this.getView().addDependent(oContent);
        var oTab = this.getView().byId(mTabIds[sKey]);
        if (oTab) {
          oTab.addContent(oContent);
        }
        if (sKey === "timeEntries") {
          this._configureTimeEntriesChart();
          setTimeout(function () {
            this._initializeMonthNavigator();
          }.bind(this), 100);

          var oTable = this._getTimeEntriesTable();
          if (oTable && !oTable._bChartSyncAttached) {
            oTable.attachEvent("updateFinished", function () {
              this._updateChartModel();
            }.bind(this));
            oTable._bChartSyncAttached = true;
          }
        }
      }.bind(this)).catch(function (oError) {
        MessageBox.error("Failed to load tab fragment: " + (oError.message || oError));
      });
    },

    _configureTimeEntriesChart: function () {
      var oChart = this.getView().byId("timeEntriesChart") || sap.ui.getCore().byId("timeEntriesChart");
      if (!oChart) {
        return;
      }

      oChart.setVizProperties({
        plotArea: {
          dataPointStyle: {
            rules: [
              { dataContext: { "Status": "D" }, properties: { color: "#89919a" } },
              { dataContext: { "Status": "S" }, properties: { color: "#0a6ed1" } },
              { dataContext: { "Status": "A" }, properties: { color: "#107e3e" } },
              { dataContext: { "Status": "R" }, properties: { color: "#b00" } }
            ]
          },
          dataLabel: { visible: false },
          dataPointSize: { min: 12, max: 28 }
        },
        legend: { visible: false },
        title: { visible: false, text: "" },
        categoryAxis: {
          title: { visible: false },
          label: { angle: 0, visible: true }
        },
        valueAxis: { title: { visible: false } },
        interaction: {
          selectability: {
            mode: "SINGLE"
          }
        }
      });
    },

    formatDateShort: function (sDate) {
      if (!sDate) {
        return "";
      }
      var aMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      var oDate = new Date(sDate + "T00:00:00");
      return aMonths[oDate.getMonth()] + " " + oDate.getDate();
    },

    _ensureCurrentMonth: function () {
      if (!this._oCurrentMonth) {
        var oNow = new Date();
        this._oCurrentMonth = { year: oNow.getFullYear(), month: oNow.getMonth() + 1 };
      }
    },

    _getTimeEntriesTable: function () {
      return this.getView().byId("timeEntriesTable") || sap.ui.getCore().byId("timeEntriesTable");
    },

    _initializeMonthNavigator: function () {
      var oTitle = this.getView().byId("monthNavigatorTitle") || sap.ui.getCore().byId("monthNavigatorTitle");
      if (!oTitle) {
        return;
      }

      this._ensureCurrentMonth();
      this._updateMonthTitle();
      this._applyTimeEntriesFilters();
    },

    _updateChartModel: function () {
      var oTable = this._getTimeEntriesTable();
      if (!oTable) {
        return;
      }

      // When a chart-specific filter (date or chartStatus) is active,
      // skip updating the chart model. If we shrink the dataset to a
      // single status/value, sap.viz can lose the dataPointStyle color
      // rules and fall back to default palette colors.
      if (this._oTimeEntryFilters.date || this._oTimeEntryFilters.chartStatus) {
        return;
      }

      var aEntries = [];
      oTable.getItems().forEach(function (oItem) {
        var oCtx = oItem.getBindingContext();
        if (oCtx) {
          aEntries.push({
            date: oCtx.getProperty("date"),
            status: oCtx.getProperty("status"),
            hours: oCtx.getProperty("hours")
          });
        }
      });

      this._oChartModel.setProperty("/entries", aEntries);
      this._configureTimeEntriesChart();
    },

    _updateMonthTitle: function () {
      var oTitle = this.getView().byId("monthNavigatorTitle") || sap.ui.getCore().byId("monthNavigatorTitle");
      if (!oTitle || !this._oCurrentMonth) {
        return;
      }

      var aMonths = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      var sText = aMonths[this._oCurrentMonth.month - 1] + " " + this._oCurrentMonth.year;
      oTitle.setText(sText);
    },

    _resetChartFilterUI: function () {
      this._oTimeEntryFilters.date = null;
      this._oTimeEntryFilters.chartStatus = null;

      var oClearBtn = this.getView().byId("clearChartFilterBtn") || sap.ui.getCore().byId("clearChartFilterBtn");
      if (oClearBtn) {
        oClearBtn.setVisible(false);
      }

      var oChart = this.getView().byId("timeEntriesChart") || sap.ui.getCore().byId("timeEntriesChart");
      if (oChart) {
        oChart.vizSelection([], { clearSelection: true });
      }
    },

    onPreviousMonth: function () {
      this._ensureCurrentMonth();
      this._oCurrentMonth.month -= 1;
      if (this._oCurrentMonth.month < 1) {
        this._oCurrentMonth.month = 12;
        this._oCurrentMonth.year -= 1;
      }
      this._updateMonthTitle();
      this._resetChartFilterUI();
      this._applyTimeEntriesFilters();
    },

    onNextMonth: function () {
      this._ensureCurrentMonth();
      this._oCurrentMonth.month += 1;
      if (this._oCurrentMonth.month > 12) {
        this._oCurrentMonth.month = 1;
        this._oCurrentMonth.year += 1;
      }
      this._updateMonthTitle();
      this._resetChartFilterUI();
      this._applyTimeEntriesFilters();
    },

    _applyTimeEntriesFilters: function () {
      this._ensureCurrentMonth();

      var aFilters = [];
      if (this._oTimeEntryFilters.chartStatus) {
        aFilters.push(new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, this._oTimeEntryFilters.chartStatus));
      } else if (this._oTimeEntryFilters.status) {
        aFilters.push(new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, this._oTimeEntryFilters.status));
      }
      if (this._oTimeEntryFilters.date) {
        aFilters.push(new sap.ui.model.Filter("date", sap.ui.model.FilterOperator.EQ, this._oTimeEntryFilters.date));
      }
      if (this._oCurrentMonth && this._oCurrentMonth.year) {
        aFilters.push(new sap.ui.model.Filter("year", sap.ui.model.FilterOperator.EQ, String(this._oCurrentMonth.year)));
      }
      if (this._oCurrentMonth && this._oCurrentMonth.month) {
        aFilters.push(new sap.ui.model.Filter("month", sap.ui.model.FilterOperator.EQ, this._oCurrentMonth.month));
      }

      var oTable = this._getTimeEntriesTable();
      if (oTable) {
        var oTableBinding = oTable.getBinding("items");
        if (oTableBinding) {
          oTableBinding.filter(aFilters);
        }
      }

      // Sync chart model after table data loads (V4 updateFinished can be unreliable)
      if (this._iChartSyncTimeout) {
        clearTimeout(this._iChartSyncTimeout);
      }
      this._iChartSyncTimeout = setTimeout(function () {
        this._iChartSyncTimeout = null;
        this._updateChartModel();
      }.bind(this), 700);
    },

    onChartSelectData: function (oEvent) {
      var aData = oEvent.getParameter("data");
      if (!aData || aData.length === 0) {
        return;
      }

      var oSelected = aData[0].data;
      var sFormattedDate = oSelected["Date"];
      var sStatus = oSelected["Status"];

      // Only accept known status codes to avoid bad filter requests
      var aValidStatuses = ["D", "S", "A", "R"];
      if (sStatus && aValidStatuses.indexOf(sStatus) === -1) {
        sStatus = null;
      }

      // The event only brings the formatted date (e.g. "Apr 11").
      // We need the ISO date for the OData filter, so look it up in the chart model
      // by matching formatted date + status.
      var sIsoDate = null;
      var aEntries = this._oChartModel.getProperty("/entries");
      if (aEntries && sFormattedDate && sStatus) {
        var oMatched = aEntries.find(function (oEntry) {
          return oEntry.status === sStatus && this.formatDateShort(oEntry.date) === sFormattedDate;
        }.bind(this));
        if (oMatched) {
          sIsoDate = oMatched.date;
        }
      }
      // Fallback: if no status match or chart model empty, try matching only by date
      if (!sIsoDate && aEntries && sFormattedDate) {
        var oMatchedByDate = aEntries.find(function (oEntry) {
          return this.formatDateShort(oEntry.date) === sFormattedDate;
        }.bind(this));
        if (oMatchedByDate) {
          sIsoDate = oMatchedByDate.date;
        }
      }

      this._oTimeEntryFilters.date = sIsoDate;
      this._oTimeEntryFilters.chartStatus = sStatus || null;
      this._applyTimeEntriesFilters();

      var oClearBtn = this.getView().byId("clearChartFilterBtn") || sap.ui.getCore().byId("clearChartFilterBtn");
      if (oClearBtn) {
        oClearBtn.setVisible(true);
      }
    },

    onClearChartFilter: function () {
      this._resetChartFilterUI();
      this._applyTimeEntriesFilters();
    },

    onTabSelect: function (oEvent) {
      var sKey = oEvent.getParameter("key");
      this._loadTabFragment(sKey);
    },

    _capitalize: function (sString) {
      return sString.charAt(0).toUpperCase() + sString.slice(1);
    },

    _findColumnListItem: function (oControl) {
      var oItem = oControl;
      while (oItem && !oItem.getBindingContext) {
        oItem = oItem.getParent();
      }
      return oItem;
    },

    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();
      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("ProjectsList", {}, true);
      }
    },

    onSegmentSelect: function (oEvent) {
      // Donut chart segment selected
    },

    _callAction: function (sUrl, oBody) {
      return fetch(sUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: oBody ? JSON.stringify(oBody) : undefined
      }).then(function (oResponse) {
        if (!oResponse.ok) {
          return oResponse.json().then(function (oData) {
            throw new Error(oData.error && oData.error.message ? oData.error.message : "Request failed");
          });
        }
        return oResponse.json();
      });
    },

    onApproveEntry: function (oEvent) {
      var oButton = oEvent.getSource();
      var oItem = this._findColumnListItem(oButton);
      if (!oItem) {
        MessageBox.error("Could not determine the selected row.");
        return;
      }
      var sEntryId = oItem.getBindingContext().getProperty("ID");
      var sUrl = "/api/manager/TimeEntries(" + sEntryId + ")/approveTimeEntry";

      this._callAction(sUrl).then(function () {
        MessageToast.show("Time entry approved");
        this._refreshTimeEntries();
      }.bind(this)).catch(function (oError) {
        MessageBox.error(oError.message || "Failed to approve time entry");
      });
    },

    onRejectEntry: function (oEvent) {
      var oButton = oEvent.getSource();
      var oItem = this._findColumnListItem(oButton);
      if (!oItem) {
        MessageBox.error("Could not determine the selected row.");
        return;
      }
      var oContext = oItem.getBindingContext();
      var oModel = this.getView().getModel();

      var oTextArea = new TextArea({
        placeholder: "Enter rejection note (min. 10 characters)...",
        rows: 4,
        width: "100%"
      });

      var oDialog = new Dialog({
        title: "Reject Time Entry",
        content: new VBox({
          items: [oTextArea]
        }).addStyleClass("sapUiSmallMargin"),
        beginButton: new Button({
          text: "Reject",
          type: "Reject",
          press: function () {
            var sNote = oTextArea.getValue().trim();
            if (sNote.length < 10) {
              MessageBox.error("Rejection note must be at least 10 characters.");
              return;
            }

            var sEntryId = oContext.getProperty("ID");
            var sUrl = "/api/manager/TimeEntries(" + sEntryId + ")/rejectTimeEntry";
            this._callAction(sUrl, { rejectionNote: sNote }).then(function () {
              MessageToast.show("Time entry rejected");
              this._refreshTimeEntries();
              oDialog.close();
            }.bind(this)).catch(function (oError) {
              MessageBox.error(oError.message || "Failed to reject time entry");
            });
          }.bind(this)
        }),
        endButton: new Button({
          text: "Cancel",
          press: function () {
            oDialog.close();
          }
        }),
        afterClose: function () {
          oDialog.destroy();
        }
      });

      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    onApproveSelected: function (oEvent) {
      var oTable = this._getTimeEntriesTable();
      if (!oTable) {
        return;
      }

      var aSelectedItems = oTable.getSelectedItems();
      if (aSelectedItems.length === 0) {
        MessageBox.warning("No time entries selected.");
        return;
      }

      MessageBox.confirm("Approve " + aSelectedItems.length + " time entr" + (aSelectedItems.length === 1 ? "y" : "ies") + "?", {
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) {
            return;
          }

          var aPromises = aSelectedItems.map(function (oItem) {
            var sEntryId = oItem.getBindingContext().getProperty("ID");
            var sUrl = "/api/manager/TimeEntries(" + sEntryId + ")/approveTimeEntry";
            return this._callAction(sUrl);
          }.bind(this));

          Promise.all(aPromises).then(function () {
            MessageToast.show(aSelectedItems.length + " time entr" + (aSelectedItems.length === 1 ? "y" : "ies") + " approved");
            this._refreshTimeEntries();
          }.bind(this)).catch(function (oError) {
            MessageBox.error(oError.message || "Failed to approve selected time entries");
          });
        }.bind(this)
      });
    },

    onRejectSelected: function (oEvent) {
      var oTable = this._getTimeEntriesTable();
      if (!oTable) {
        return;
      }

      var aSelectedItems = oTable.getSelectedItems();
      if (aSelectedItems.length === 0) {
        MessageBox.warning("No time entries selected.");
        return;
      }

      var oTextArea = new TextArea({
        placeholder: "Enter rejection note (min. 10 characters)...",
        rows: 4,
        width: "100%"
      });

      var oDialog = new Dialog({
        title: "Reject Selected Time Entries",
        content: new VBox({
          items: [oTextArea]
        }).addStyleClass("sapUiSmallMargin"),
        beginButton: new Button({
          text: "Reject",
          type: "Reject",
          press: function () {
            var sNote = oTextArea.getValue().trim();
            if (sNote.length < 10) {
              MessageBox.error("Rejection note must be at least 10 characters.");
              return;
            }

            var aPromises = aSelectedItems.map(function (oItem) {
              var sEntryId = oItem.getBindingContext().getProperty("ID");
              var sUrl = "/api/manager/TimeEntries(" + sEntryId + ")/rejectTimeEntry";
              return this._callAction(sUrl, { rejectionNote: sNote });
            }.bind(this));

            Promise.all(aPromises).then(function () {
              MessageToast.show(aSelectedItems.length + " time entr" + (aSelectedItems.length === 1 ? "y" : "ies") + " rejected");
              this._refreshTimeEntries();
              oDialog.close();
            }.bind(this)).catch(function (oError) {
              MessageBox.error(oError.message || "Failed to reject selected time entries");
            });
          }.bind(this)
        }),
        endButton: new Button({
          text: "Cancel",
          press: function () {
            oDialog.close();
          }
        }),
        afterClose: function () {
          oDialog.destroy();
        }
      });

      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    onFilterTimeEntries: function (oEvent) {
      var sKey = oEvent.getParameter("selectedItem").getKey();
      this._oTimeEntryFilters.status = sKey || null;
      this._oTimeEntryFilters.chartStatus = null;
      this._applyTimeEntriesFilters();
    },

    onSortTimeEntries: function () {
      var oBundle = this.getView().getModel("i18n").getResourceBundle();

      var oRadioGroup = new sap.m.RadioButtonGroup({
        columns: 1,
        selectedIndex: 0,
        buttons: [
          new sap.m.RadioButton({ text: oBundle.getText("SortDate"), selected: true }),
          new sap.m.RadioButton({ text: oBundle.getText("SortEmployee") }),
          new sap.m.RadioButton({ text: oBundle.getText("SortHours") }),
          new sap.m.RadioButton({ text: oBundle.getText("SortStatus") }),
          new sap.m.RadioButton({ text: oBundle.getText("SortCost") })
        ]
      });

      var oSwitch = new sap.m.Switch({ state: false });

      var oDialog = new sap.m.Dialog({
        title: oBundle.getText("SortBy"),
        contentWidth: "20rem",
        content: new sap.m.VBox({
          items: [
            new sap.m.Title({ text: oBundle.getText("SortBy"), titleStyle: "H5" }).addStyleClass("sapUiSmallMarginTop sapUiTinyMarginBegin"),
            oRadioGroup.addStyleClass("sapUiSmallMargin"),
            new sap.m.HBox({
              alignItems: "Center",
              items: [
                new sap.m.Text({ text: oBundle.getText("Ascending") }).addStyleClass("sapUiTinyMarginEnd"),
                oSwitch,
                new sap.m.Text({ text: oBundle.getText("Descending") }).addStyleClass("sapUiTinyMarginBegin")
              ]
            }).addStyleClass("sapUiSmallMargin")
          ]
        }),
        beginButton: new sap.m.Button({
          text: oBundle.getText("Sort"),
          type: "Emphasized",
          press: function () {
            var aKeys = ["date", "employeeName", "hours", "status", "cost"];
            var sKey = aKeys[oRadioGroup.getSelectedIndex()];
            var bDescending = oSwitch.getState();

            var oTable = this._getTimeEntriesTable();
            var oBinding = oTable.getBinding("items");
            oBinding.sort(new sap.ui.model.Sorter(sKey, bDescending));
            oDialog.close();
          }.bind(this)
        }),
        endButton: new sap.m.Button({
          text: oBundle.getText("Reject"),
          press: function () {
            oDialog.close();
          }
        }),
        afterClose: function () {
          oDialog.destroy();
        }
      });

      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    _refreshTimeEntries: function () {
      var oElementBinding = this.getView().getElementBinding();
      if (oElementBinding) {
        var oContext = oElementBinding.getBoundContext();
        if (oContext) {
          oContext.refresh();
        }
      }
    }
  });
});
