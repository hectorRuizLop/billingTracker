"use strict";

const cds = require("@sap/cds");
const fs = require("fs");

/**
 * EmailSender uses SendPulse's REST API directly via native fetch.
 *
 * When SENDPULSE_USER_ID and SENDPULSE_SECRET are configured, emails are
 * sent via SendPulse's HTTP API (OAuth2 token is cached to disk).
 * When credentials are missing (dev / test / local), emails are logged to
 * the console instead of failing so the application remains runnable.
 */
class EmailSender {
  constructor({
    userId = process.env.SENDPULSE_USER_ID,
    secret = process.env.SENDPULSE_SECRET,
    tokenStorage = process.env.SENDPULSE_TOKEN_STORAGE ||
      "/tmp/sendpulse-token.json",
    fromName = "Billing Tracker",
  } = {}) {
    this._userId = userId;
    this._secret = secret;
    this._tokenStorage = tokenStorage;
    this._fromName = fromName;
    this._token = null;
    // Track expiry in-memory so we can proactively refresh before the next send
    this._tokenExpiresAt = null;
  }

  _loadCachedToken() {
    try {
      if (fs.existsSync(this._tokenStorage)) {
        const raw = fs.readFileSync(this._tokenStorage, "utf8");
        const data = JSON.parse(raw);
        const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
        if (expiresAt && expiresAt > new Date()) {
          this._token = data.access_token;
          // Mirror expiry in-memory so _ensureToken can re-check it without
          // hitting the filesystem on every call
          this._tokenExpiresAt = expiresAt;
          return true;
        }
      }
    } catch {
      // ignore corrupt / missing cache file
    }
    return false;
  }

  _saveToken(data) {
    try {
      const expiresAt = new Date(Date.now() + data.expires_in * 1000);
      const payload = {
        access_token: data.access_token,
        expires_at: expiresAt.toISOString(),
      };
      // Write to a temp file first, then rename so concurrent readers never
      // see a half-written JSON blob (atomic on most POSIX filesystems)
      const tmp = `${this._tokenStorage}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
      fs.renameSync(tmp, this._tokenStorage);
      this._tokenExpiresAt = expiresAt;
    } catch {
      // ignore write failures (e.g. read-only fs on BTP)
    }
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
    this._saveToken(data);
    return this._token;
  }

  async _ensureToken() {
    // Re-check in-memory expiry on every call so a long-running process
    // proactively refreshes before the token actually expires at the API
    if (this._token && this._tokenExpiresAt && this._tokenExpiresAt > new Date()) {
      return this._token;
    }
    // In-memory token is gone or expired — try the disk cache next
    this._token = null;
    if (this._loadCachedToken()) return this._token;
    return this._fetchToken();
  }

  async send({ to, from, subject, text }) {
    if (!this._userId || !this._secret) {
      const log = cds.log("email");
      log.info(`[Simulated Email] To: ${to}\nSubject: ${subject}\n${text}`);
      return { simulated: true };
    }

    const token = await this._ensureToken();

    const email = {
      email: {
        subject,
        text,
        // Use the human-readable sender name, not the raw email address,
        // so mail clients display "Billing Tracker" instead of the address string
        from: { name: this._fromName, email: from },
        to: [{ name: to, email: to }],
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
        try { fs.rmSync(this._tokenStorage, { force: true }); } catch { /* ignore */ }
      }
      throw new Error(`SendPulse send failed (${res.status}): ${body}`);
    }

    const answer = await res.json();
    return { sent: true, answer };
  }
}

module.exports = { EmailSender };
