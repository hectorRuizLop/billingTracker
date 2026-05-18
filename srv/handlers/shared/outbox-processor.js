"use strict";

const cds = require("@sap/cds");
const { EmailSender } = require("./email-sender");

/**
 * Transactional Outbox Processor.
 *
 * Jobs write email payloads to the EmailOutbox table inside a database
 * transaction. This processor polls pending entries and actually sends
 * the emails. On success it finalizes any referenced business state
 * (e.g., promoting an invoice from Draft to Sent) and writes a
 * Notifications history record. On failure it retries up to maxAttempts.
 *
 * This pattern guarantees that business state and email intent are
 * always consistent, even if the external API is temporarily down.
 */

class OutboxProcessor {
  constructor(options = {}) {
    this._emailSender = options.emailSender || new EmailSender();
    this._pollIntervalMs = options.pollIntervalMs || 60_000;
    this._batchSize = options.batchSize || 10;
    this._running = false;
  }

  async _finalizeInvoice(referenceId, payload) {
    const { Invoices, TimeEntries, BillingPeriods } =
      cds.entities("my.billing");

    const ctx = payload ? JSON.parse(payload) : {};
    const { entryIds, projectsData, year, month } = ctx;

    await cds.tx(async (tx) => {
      await tx.run(
        UPDATE(Invoices).set({ status: "S" }).where({ ID: referenceId }),
      );

      if (entryIds && entryIds.length > 0) {
        await tx.run(
          UPDATE(TimeEntries)
            .set({ billingStatus: "I" })
            .where({ ID: { in: entryIds } }),
        );
      }

      if (projectsData && Array.isArray(projectsData)) {
        for (const p of projectsData) {
          const existingBp = await tx.run(
            SELECT.one
              .from(BillingPeriods)
              .where({ project_ID: p.projectId, year, month }),
          );
          if (existingBp) {
            await tx.run(
              UPDATE(BillingPeriods)
                .set({
                  status: "I",
                  totalHours: p.totalHours,
                  totalCost: p.totalCost,
                })
                .where({ ID: existingBp.ID }),
            );
          } else {
            await tx.run(
              INSERT.into(BillingPeriods).entries({
                ID: cds.utils.uuid(),
                project_ID: p.projectId,
                year,
                month,
                status: "I",
                totalHours: p.totalHours,
                totalCost: p.totalCost,
              }),
            );
          }
        }
      }
    });
  }

  async _processEntry(entry) {
    const { Notifications, EmailOutbox } = cds.entities("my.billing");

    try {
      await this._emailSender.send({
        to: entry.to,
        from: entry.from,
        subject: entry.subject,
        text: entry.text,
      });

      // Finalize referenced business state if applicable
      if (entry.referenceId && entry.referenceType?.startsWith("Invoice")) {
        await this._finalizeInvoice(entry.referenceId, entry.payload);
      }

      // Map technical reference types to human-readable notification types
      const notificationType =
        entry.referenceType === "InvoiceNew" ||
        entry.referenceType === "InvoiceRetry"
          ? "InvoiceSent"
          : entry.referenceType || "Email";

      // Write history record
      await cds.run(
        INSERT.into(Notifications).entries({
          recipient_ID: entry.recipient_ID || undefined,
          client_ID: entry.client_ID || undefined,
          type: notificationType,
          subject: entry.subject,
          message: entry.text,
          sentAt: new Date().toISOString(),
          status: "S",
        }),
      );

      // Remove successfully processed entry
      await cds.run(DELETE.from(EmailOutbox).where({ ID: entry.ID }));

      return true;
    } catch (err) {
      const attempts = (entry.attempts || 0) + 1;
      const maxAttempts = entry.maxAttempts || 3;
      const status = attempts >= maxAttempts ? "F" : "P";

      await cds.run(
        UPDATE(EmailOutbox)
          .set({
            status,
            attempts,
            error:
              err.message?.substring(0, 500) || String(err).substring(0, 500),
          })
          .where({ ID: entry.ID }),
      );

      cds
        .log("outbox-processor")
        .error(
          `Email outbox entry ${entry.ID} failed (attempt ${attempts}/${maxAttempts}):`,
          err,
        );

      return false;
    }
  }

  async processPending(limit = this._batchSize) {
    const { EmailOutbox } = cds.entities("my.billing");

    const candidates = await cds.run(
      SELECT.from(EmailOutbox).where({ status: "P" }).limit(limit),
    );

    const pending = (candidates || []).filter(
      (e) => (e.attempts || 0) < (e.maxAttempts || 3),
    );

    if (!pending || pending.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    for (const entry of pending) {
      const ok = await this._processEntry(entry);
      if (ok) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return { processed: pending.length, succeeded, failed };
  }

  async start() {
    if (this._running) return;
    this._running = true;

    const log = cds.log("outbox-processor");
    log.info("Outbox processor started");

    while (this._running) {
      try {
        const result = await this.processPending();
        if (result.processed > 0) {
          log.info(
            `Processed ${result.processed} outbox entries (${result.succeeded} ok, ${result.failed} failed)`,
          );
        }
      } catch (err) {
        log.error("Outbox processor loop error:", err);
      }

      await new Promise((resolve) =>
        global.setTimeout(resolve, this._pollIntervalMs),
      );
    }
  }

  stop() {
    this._running = false;
  }
}

module.exports = { OutboxProcessor };
