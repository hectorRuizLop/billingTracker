"use strict";

const cds = require("@sap/cds");

module.exports = async function server(o) {
  const app = await cds.server(o);

  if (process.env.NODE_ENV !== "test") {
    const { PendingHoursReminder } = require("./srv/jobs/pending-hours-reminder");
    const reminder = new PendingHoursReminder();
    reminder.start();
  }

  return app;
};
