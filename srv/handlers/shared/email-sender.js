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
  } = {}) {
    this._userId = userId;
    this._secret = secret;
    this._tokenStorage = tokenStorage;
    this._token = null;
  }

  _loadCachedToken() {
    try {
      if (fs.existsSync(this._tokenStorage)) {
        const raw = fs.readFileSync(this._tokenStorage, "utf8");
        const data = JSON.parse(raw);
        if (data.expires_at && new Date(data.expires_at) > new Date()) {
          this._token = data.access_token;
          return true;
        }
      }
    } catch {
      // ignore corrupt cache
    }
    return false;
  }

  _saveToken(data) {
    try {
      const payload = {
        access_token: data.access_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      };
      fs.writeFileSync(this._tokenStorage, JSON.stringify(payload, null, 2));
    } catch {
      // ignore write failures (e.g. read-only fs)
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
    if (this._token) return this._token;
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
        from: { name: from, email: from },
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
      throw new Error(`SendPulse send failed (${res.status}): ${body}`);
    }

    const answer = await res.json();
    return { sent: true, answer };
  }
}

module.exports = { EmailSender };
