"use strict";

const cds = require("@sap/cds");

async function logSecurityEvent(req, data) {
  if (process.env.NODE_ENV === "test") return;

  try {
    const audit = await cds.connect.to("audit-log");
    await audit.log("SecurityEvent", {
      user: req.user.id,
      data,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      cds.log("audit").warn(`Skipping audit log: ${error.message}`);
      return;
    }

    throw error;
  }
}

module.exports = { logSecurityEvent };
