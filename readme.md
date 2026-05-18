# Billing Tracker

Application for tracking billable hours and client invoicing in a consultancy. Supports client, project, and employee management, time entry logging, and monthly billing report generation once approved by project managers.

---

## Technology Stack

| Layer | Technology |
|------|------------|
| Runtime | Node.js 20 |
| Framework | SAP CAP (`@sap/cds`) v9 |
| DB (dev / test) | SQLite (`@cap-js/sqlite`) |
| DB (production) | SAP HANA Cloud (`@cap-js/hana`) |
| Auth (dev / test) | Mocked basic-auth |
| Auth (production) | XSUAA (`@sap/xssec`) |
| Frontend | SAP Fiori Elements (OData V4) |
| Email | SendPulse REST API |
| Jobs | `node-cron` + distributed locking |
| Testing | Jest 29 + `@cap-js/cds-test` |
| CI/CD | GitHub Actions |
| Deployment | MTA → SAP BTP Cloud Foundry |

---

## Prerequisites

- Node.js 20 (see `.nvmrc`)
- `npm install`

---

## Local Development

```bash
# SQLite database (creates db.sqlite automatically)
npm start

# Or with hot-reload
cds watch
```

The server listens at `http://localhost:4004`.

### Employee Frontend

With the server running, open:

```
http://localhost:4004/fiori-apps.html
```

Click the **"Employee Time Tracking"** tile.

### Development Credentials

| User | Password | Roles |
|---------|-----------|-------|
| `20000000-0000-0000-0000-000000000001` | `pass` | Employee |
| `20000000-0000-0000-0000-000000000002` | `pass` | Employee |
| `20000000-0000-0000-0000-000000000003` | `pass` | Manager, Employee |
| `20000000-0000-0000-0000-000000000004` | `pass` | Manager, Employee |
| `20000000-0000-0000-0000-000000000005` | `pass` | Admin, Manager, Employee |

---

## Service Architecture

The backend exposes **three role-based CAP services**:

### AdminService (`/api/admin`)
- Full CRUD on all entities.
- Client management (soft-delete), employees, and projects.
- Actions: `changeEmployeeRole`, `reactivateClient`.

### EmployeeService (`/api/employee`)
- `MyTimeEntries`: CRU on own time entries.
- `MyProjects`: read-only view of assigned projects.
- `MyAssignments`: read-only view of own assignments.
- Action: `submitMonth(year, month)` — submits all draft entries for the month.

### ManagerService (`/api/manager`)
- `Projects`: manage own projects with virtual financial analytics fields.
- `TimeEntries`: read-only view of entries on managed projects.
- `ProjectAssignments`: assign employees to managed projects.
- Actions: `approveTimeEntry`, `rejectTimeEntry`.

---

## Required Configuration

### Environment Variables

| Variable | Required | Description |
|----------|-----------|-------------|
| `SENDPULSE_USER_ID` | Production only | SendPulse user ID |
| `SENDPULSE_SECRET` | Production only | SendPulse API secret |
| `EMAIL_FROM` | Production only | Verified sender address |
| `CF_INSTANCE_GUID` | Production only | CF instance GUID (used by distributed locking) |

### Email Sandbox Mode (Testing)

| Variable | Required | Description |
|----------|-----------|-------------|
| `EMAIL_SANDBOX` | No | Set to `true` to redirect all emails to safe recipients |
| `EMAIL_SANDBOX_RECIPIENTS` | No | Comma-separated list of test recipient addresses |

When `EMAIL_SANDBOX=true`, every outgoing email is sent to the sandbox recipients instead of the real destination. The subject is prefixed with `[SANDBOX → original@email.com]` so testers can verify delivery without risk.

In development, if `SENDPULSE_USER_ID` is not set, `EmailSender` operates in simulation mode (logs to console only).

### CDS Profiles

- **Development**: SQLite (`db.sqlite`) + mocked auth.
- **Test**: SQLite `:memory:` + mocked auth.
- **Production**: HANA HDI + XSUAA.

---

## Business Logic Assumptions

The following design decisions document requirements not explicitly defined in the original specification:

### 1. Category Standard Rates
Four fixed categories with standard hourly rates:
- Junior: 20€/h
- Mid-level: 30€/h
- Senior: 40€/h
- Lead: 50€/h

An employee may have a `customRate` on a specific project assignment that overrides the category rate.

### 2. Rate Snapshot at Creation Time
The `rateSnapshot` field on `TimeEntries` stores the applicable rate when the entry is created. This ensures historical entries retain their original billing value even if the employee's rate changes later.

### 3. Time Entry Status Lifecycle
A four-state lifecycle was established:
- **D (Draft)**: Provisional entry, editable.
- **S (Submitted)**: Sent for manager approval, no longer editable.
- **A (Approved)**: Approved by manager, counts toward billing.
- **R (Rejected)**: Rejected by manager, does not count toward billing.

### 4. Month Locking
Once an employee submits all entries for a month/year via `submitMonth`, no further entries can be created or updated for that month/year. Entries for other months remain editable.

### 5. Client Soft Delete
Clients are not physically deleted; they are marked with `isDeleted = true`. This preserves historical project and billing records linked to them.

### 6. Managers as Billable Employees
Managers are automatically added as assignees to projects they create and can log time entries. They default to the Lead category.

### 7. Background Job Schedule
- **Day 25**: Reminder to employees to submit time entries.
- **Day 1**: Summary to managers of pending timesheets.
- **Day 2**: Monthly billing report generation to clients.

### 8. Transactional Outbox Pattern
Jobs do not send emails directly. They write to the `EmailOutbox` table, and an independent `OutboxProcessor` handles actual delivery. This guarantees atomicity between business state changes and notification intent.

### 9. Distributed Locking
Jobs use a database-based locking mechanism (`JobLocks` table) to prevent concurrent execution in multi-instance deployments.

---

## Testing

```bash
# Integration tests (Jest)
npm test

# Native CDS tests
npm run test:cds

# Linting
npm run lint

# CDS formatting
npm run format
```

Test coverage includes:
- CRUD and visibility restrictions across all three services.
- Time entry validations (daily limit, weekends, current month, etc.).
- Time entry approval/rejection flow.
- `rateSnapshot` logic.
- Background jobs (outbox, locking, reminders).

---

## Project Structure

```
app/                    # Fiori Elements frontend
  appconfig/            # Sandbox launchpad configuration
  employee-time-tracking/
    webapp/
      manifest.json
      Component.js
      i18n/
  fiori-apps.html       # Local launchpad
db/                     # Data model and seed data
  schema.cds
  data/
srv/                    # Services and business logic
  admin-service.cds/js
  employee-service.cds/js
  manager-service.cds/js
  handlers/             # Role-organized handlers
  jobs/                 # Scheduled cron jobs
test/                   # Jest integration tests
```

---

## Deployment

```bash
# Production build
npm run build
```

Generates `gen/srv` and `gen/db`. Deployment to SAP BTP Cloud Foundry is driven by `mta.yaml`, which defines:
- `billing-tracker-srv` module (Node.js CAP).
- `billing-tracker-db-deployer` module (HDB).
- Resources: XSUAA and shared HANA HDI container.

---

## Developer Notes

- Do not modify mocked user IDs in `package.json` without updating tests and seed CSVs.
- Time entry validations are centralized in `srv/handlers/shared/time-entry-policy.js`.
- Rate resolution is centralized in `srv/handlers/shared/resolve-rate-snapshot.js`.
- `server.js` starts the `OutboxProcessor` as a plain background task **without** `cds.spawn` to avoid blocking the single SQLite connection in local development.
