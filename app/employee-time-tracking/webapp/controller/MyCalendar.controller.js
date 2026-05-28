sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/unified/DateTypeRange"
], function (Controller, JSONModel, DateTypeRange) {
  "use strict";

  return Controller.extend("nubexx.billing.employee.controller.MyCalendar", {

    onInit: function () {
      this._oLocalModel = new JSONModel({
        months: [
          { key: 1, text: "January" }, { key: 2, text: "February" },
          { key: 3, text: "March" }, { key: 4, text: "April" },
          { key: 5, text: "May" }, { key: 6, text: "June" },
          { key: 7, text: "July" }, { key: 8, text: "August" },
          { key: 9, text: "September" }, { key: 10, text: "October" },
          { key: 11, text: "November" }, { key: 12, text: "December" }
        ],
        years: []
      });
      this.getView().setModel(this._oLocalModel, "local");

      // Populate years (current year ± 2)
      var iCurrentYear = new Date().getFullYear();
      var aYears = [];
      for (var y = iCurrentYear - 2; y <= iCurrentYear + 2; y++) {
        aYears.push({ key: y, text: String(y) });
      }
      this._oLocalModel.setProperty("/years", aYears);

      // Set current month/year
      var iMonth = new Date().getMonth() + 1;
      this.byId("monthSelect").setSelectedKey(iMonth);
      this.byId("yearSelect").setSelectedKey(iCurrentYear);

      this._loadCalendarDays();
    },

    _loadCalendarDays: function () {
      var iMonth = parseInt(this.byId("monthSelect").getSelectedKey(), 10);
      var iYear = parseInt(this.byId("yearSelect").getSelectedKey(), 10);
      var oCalendar = this.byId("hoursCalendar");

      // Clear previous special dates
      oCalendar.destroySpecialDates();

      // Set calendar current date
      oCalendar.setCurrentDate(new Date(iYear, iMonth - 1, 1));

      // Call OData function
      var oModel = this.getView().getModel();
      oModel.callFunction("/getCalendarDays", {
        method: "GET",
        urlParameters: {
          year: iYear,
          month: iMonth
        },
        success: function (oData) {
          this._renderSpecialDates(oData.value || oData.getCalendarDays || []);
        }.bind(this),
        error: function () {
          // Silently ignore — calendar will just show no markers
        }
      });
    },

    _renderSpecialDates: function (aDays) {
      var oCalendar = this.byId("hoursCalendar");
      aDays.forEach(function (oDay) {
        var oDate = new Date(oDay.date + "T00:00:00.000Z");
        if (oDay.dayType === "weekend") {
          return; // No marker for weekends
        }
        var sType = oDay.hasEntries ? "Type01" : "Type03"; // Green : Red
        oCalendar.addSpecialDate(new DateTypeRange({
          startDate: oDate,
          type: sType,
          tooltip: oDay.totalHours + " hours"
        }));
      });
    },

    onMonthYearChange: function () {
      this._loadCalendarDays();
    },

    onDateSelect: function (oEvent) {
      var oDate = oEvent.getParameter("date");
      var sDateStr = oDate.toISOString().split("T")[0];
      this.getOwnerComponent().getRouter().navTo("MyTimeEntriesList", {
        "?query": "date=" + sDateStr
      });
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("MyTimeEntriesList", {}, true);
    },

    onGoToList: function () {
      this.getOwnerComponent().getRouter().navTo("MyTimeEntriesList", {}, true);
    }
  });
});
