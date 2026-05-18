"use strict";

const cds = require("@sap/cds");

/**
 * EmailSender uses SendPulse's REST API directly via native fetch.
 *
 * When SENDPULSE_USER_ID and SENDPULSE_SECRET are configured, emails are
 * sent via SendPulse's HTTP API (OAuth2 token is kept in-memory only).
 * When credentials are missing (dev / test / local), emails are logged to
 * the console instead of failing so the application remains runnable.
 *
 * Sandbox Mode:
 *   Set EMAIL_SANDBOX=true and EMAIL_SANDBOX_RECIPIENTS=email1,email2
 *   to redirect ALL outgoing emails to those addresses. This is useful
 *   for testing with real SendPulse credentials without risking emails
 *   landing in real customer/employee inboxes.
 *
 * Tokens are cached only in-memory
 */
class EmailSender {
  constructor({
    userId = process.env.SENDPULSE_USER_ID,
    secret = process.env.SENDPULSE_SECRET,
    fromName = "Billing Tracker",
    sandboxMode =
      process.env.EMAIL_SANDBOX === "true" ||
      process.env.EMAIL_SANDBOX === "1",
    sandboxRecipients = process.env.EMAIL_SANDBOX_RECIPIENTS,
  } = {}) {
    this._userId = userId;
    this._secret = secret;
    this._fromName = fromName;
    this._sandboxMode = sandboxMode;
    this._sandboxRecipients = sandboxRecipients
      ? sandboxRecipients.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    this._token = null;
    // Track expiry in memory so we can proactively refresh before the next send
    this._tokenExpiresAt = null;
  }

  async _fetchToken() {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", this._userId);
    params.append("client_secret", this._secret);

    const res = await fetch("https://api.sendpulse.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SendPulse auth failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    if (!data.access_token) {
      throw new Error("SendPulse auth response missing access_token");
    }

    this._token = data.access_token;
    // Cache expiry in-memory only no disk writes
    this._tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    return this._token;
  }

  async _ensureToken() {
    // Re-check in-memory expiry on every call so a long-running process
    // proactively refreshes before the token actually expires at the API
    if (
      this._token &&
      this._tokenExpiresAt &&
      this._tokenExpiresAt > new Date()
    ) {
      return this._token;
    }
    // In memory token is gone or expired fetch a fresh one
    this._token = null;
    this._tokenExpiresAt = null;
    return this._fetchToken();
  }

  async send({ to, from, subject, text }) {
    if (!this._userId || !this._secret) {
      const log = cds.log("email");
      log.info(`[Simulated Email] To: ${to}\nSubject: ${subject}\n${text}`);
      return { simulated: true };
    }

    const log = cds.log("email");
    const originalTo = to;
    let actualSubject = subject;
    let actualText = text;
    let recipients = [{ name: to, email: to }];

    if (this._sandboxMode) {
      if (this._sandboxRecipients.length > 0) {
        recipients = this._sandboxRecipients.map((r) => ({
          name: r,
          email: r,
        }));
        actualSubject = `[SANDBOX → ${originalTo}] ${subject}`;
        actualText =
          ` SANDBOX MODE  This email was redirected from its original recipient.\n\n` +
          `Original recipient: ${originalTo}\n` +
          `Sandbox recipients: ${this._sandboxRecipients.join(", ")}\n` +
          `---\n\n${text}`;

        log.warn(
          `[SANDBOX] Email to "${originalTo}" redirected to: ${this._sandboxRecipients.join(", ")}`,
        );
      } else {
        log.warn(
          `[SANDBOX] EMAIL_SANDBOX is active but EMAIL_SANDBOX_RECIPIENTS is empty. ` +
            `Email will be sent to the original recipient: ${originalTo}`,
        );
      }
    }

    const token = await this._ensureToken();

    const email = {
      email: {
        subject: actualSubject,
        text: actualText,
        // Use the human-readable sender name, not the raw email address,
        // so mail clients display "Billing Tracker" instead of the address string
        from: { name: this._fromName, email: from },
        to: recipients,
      },
    };

    const res = await fetch("https://api.sendpulse.com/smtp/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(email),
    });

    if (!res.ok) {
      const body = await res.text();
      // 401 means our cached token was revoked/expired; clear it so the next
      // call triggers a fresh _fetchToken() instead of failing immediately again
      if (res.status === 401) {
        this._token = null;
        this._tokenExpiresAt = null;
      }
      throw new Error(`SendPulse send failed (${res.status}): ${body}`);
    }

    const answer = await res.json();
    return { sent: true, originalTo, redirectedTo: this._sandboxMode ? this._sandboxRecipients : null, answer };
  }
}

module.exports = { EmailSender };
