"use strict";

const cds = require("@sap/cds");

async function onReadMyNotifications(req) {
  const { Notifications } = cds.entities("my.billing");

  const employee = await SELECT.one
    .from("my.billing.Employees")
    .where({ externalId: req.user.id })
    .columns(["ID"]);

  if (!employee) {
    return req.error(404, "Employee not found.");
  }

  // If this is a $count request, return the count directly
  if (req.query.SELECT?.columns?.some((c) => c.func === "count")) {
    const count = await SELECT.one
      .columns("count(*) as count")
      .from(Notifications)
      .where({ recipient_ID: employee.ID, isRead: false });
    return count?.count || 0;
  }

  const notifications = await SELECT.from(Notifications)
    .where({ recipient_ID: employee.ID })
    .orderBy({ sentAt: "desc" });

  return notifications;
}

async function markNotificationRead(req) {
  const { Notifications } = cds.entities("my.billing");
  const { notificationId } = req.data;

  if (!notificationId) {
    return req.error(400, "notificationId is required.");
  }

  const employee = await SELECT.one
    .from("my.billing.Employees")
    .where({ externalId: req.user.id })
    .columns(["ID"]);

  if (!employee) {
    return req.error(404, "Employee not found.");
  }

  const notification = await SELECT.one
    .from(Notifications)
    .where({ ID: notificationId, recipient_ID: employee.ID });

  if (!notification) {
    return req.error(404, "Notification not found.");
  }

  await UPDATE(Notifications)
    .set({ isRead: true })
    .where({ ID: notificationId });

  return "Notification marked as read.";
}

module.exports = { onReadMyNotifications, markNotificationRead };
