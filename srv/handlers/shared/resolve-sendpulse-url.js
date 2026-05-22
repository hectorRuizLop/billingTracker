"use strict";

const { getDestination } = require("@sap-cloud-sdk/connectivity");

/**
 * Resolve SendPulse base URL from SAP BTP Destination Service.
 *
 * Priority:
 *   1. SAP BTP Destination named "sendpulse-api" (production)
 *   2. Environment variable SENDPULSE_BASE_URL (local / CI)
 *   3. Hardcoded fallback https://api.sendpulse.com
 *
 * This allows changing the endpoint without code changes or redeployment.
 */
async function resolveSendPulseBaseUrl() {
  // Only try BTP Destination Service when VCAP_SERVICES is present
  if (process.env.VCAP_SERVICES) {
    try {
      const destination = await getDestination({
        destinationName: "sendpulse-api",
      });
      if (destination?.url) {
        return destination.url.replace(/\/$/, "");
      }
    } catch (err) {
      const log = require("@sap/cds").log("email");
      log.warn(
        "Destination 'sendpulse-api' not found or unreachable, falling back to env/default:",
        err.message,
      );
    }
  }

  return (
    process.env.SENDPULSE_BASE_URL || "https://api.sendpulse.com"
  );
}

module.exports = { resolveSendPulseBaseUrl };
