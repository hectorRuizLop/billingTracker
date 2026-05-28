"use strict";

const cds = require("@sap/cds");
const { getDestination } = require("@sap-cloud-sdk/connectivity");
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");

const logger = cds.log("workzone");

/**
 * Resolve Work Zone base URL from SAP BTP Destination Service.
 */
async function resolveWorkZoneBaseUrl() {
  if (process.env.VCAP_SERVICES) {
    try {
      const destination = await getDestination({
        destinationName: "workzone-api",
      });
      if (destination?.url) {
        return destination.url.replace(/\/$/, "");
      }
    } catch (err) {
      logger.warn(
        "Destination 'workzone-api' not found or unreachable:",
        err.message,
      );
    }
  }

  const fallback = process.env.WORKZONE_BASE_URL;
  if (fallback) {
    return fallback.replace(/\/$/, "");
  }

  return null;
}

/**
 * Send a notification to SAP Build Work Zone.
 *
 * In development (no VCAP_SERVICES and no WORKZONE_BASE_URL),
 * the notification is logged to console and treated as success.
 */
async function sendNotification({ to, subject, text, referenceType, referenceId }) {
  const baseUrl = await resolveWorkZoneBaseUrl();

  if (!baseUrl) {
    logger.info(
      `[DEV] WorkZone notification would be sent to ${to}: ${subject}`,
    );
    return { success: true, id: "dev-mock-id" };
  }

  const payload = {
    notificationType: referenceType || "Generic",
    title: subject,
    body: text,
    recipients: [{ email: to }],
    origin: "billing-tracker",
    navigationTarget: referenceId
      ? `/timeentries/${referenceId}`
      : undefined,
  };

  try {
    const response = await executeHttpRequest(
      { destinationName: "workzone-api" },
      {
        method: "POST",
        url: `${baseUrl}/api/v1/notifications`,
        data: payload,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    logger.info("WorkZone notification sent:", response.data);
    return { success: true, id: response.data?.id };
  } catch (err) {
    logger.error("WorkZone notification failed:", err.message);
    throw err;
  }
}

module.exports = { sendNotification };
