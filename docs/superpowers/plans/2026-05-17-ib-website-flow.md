# IB Website Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate IB Valetax registration entry point from Discord button to dashboard-only 3-step wizard at `/daftar-ib`. Delete Discord-side IB UI components. Add backend timestamp tracking for funnel analytics + step-state persistence.

**Architecture:** Add 2 nullable timestamp columns to `ib_accounts` table (`linkClickedAt`, `depositConfirmedAt`) via idempotent migration script. Two new user-facing endpoints track step completion. Frontend wizard reads timestamps from GET `/api/ib/my-account` to determine which step to render. Discord side deletes `/ib-setup` slash command + `ib_register` button + handlers entirely. DM notifications via cron service preserved.

**Tech Stack:** PostgreSQL via Sequelize ORM, Express, Discord.js v14 (delete-only), React 18 + Vite + Tailwind brutalist tokens.

**Reference:** Spec at `docs/superpowers/specs/2026-05-17-ib-website-flow-design.md` (commit `e7098c9`).

---

## File Structure

**Backend modified (3):**
- `src/database/models/IbAccount.js` — add 2 timestamp fields, change `brokerAccountNumber` to `allowNull: true` (wizard creates row before user submits broker number)
- `src/web/routes/ib.js` — 2 new user-facing POST endpoints + extend GET response + extend POST submit validation
- `src/events/interactionCreate.js` — delete `handleIbRegister` + `handleIbRegisterModalSubmit` + their dispatches

**Backend created (1):**
- `src/database/migrations/add-ib-tracking-columns.js` — idempotent migration script

**Backend deleted (1):**
- `src/commands/admin/ib-setup.js`

**Frontend modified (1):**
- `web-admin/src/pages/DaftarIb.jsx` — full rewrite as router between wizard and status mode

**Frontend created (5):**
- `web-admin/src/pages/daftar-ib/StepIndicator.jsx`
- `web-admin/src/pages/daftar-ib/Step1Register.jsx`
- `web-admin/src/pages/daftar-ib/Step2Deposit.jsx`
- `web-admin/src/pages/daftar-ib/Step3Submit.jsx`
- `web-admin/src/pages/daftar-ib/StatusView.jsx`

**Out of scope:** `src/services/postingService.js`, `src/deploy-commands.js`, `src/services/ibService.js` (no business-logic change).

---

## Testing Approach

This project has no automated test framework in `web-admin/` and minimal coverage on backend. Setting up a framework is out of scope. Verification per task uses:

- `npm run build` (web-admin) for frontend syntax + bundle correctness
- `node -e "require('./src/...')"` smoke imports for backend modules
- Manual curl / browser testing for routes

Each task explicitly lists what command to run and expected output.

---

## Commit Conventions

Sentence-case prefix `web-admin:` for SPA changes, plain prefix for backend (e.g., `IB:`). Stage explicit files. Never `git add .`.

---

## Task 1: IbAccount model — add tracking columns + relax broker number

**Files:**
- Modify: `src/database/models/IbAccount.js`

- [ ] **Step 1: Open the file and locate `brokerAccountNumber` field**

The field is at lines 34-39. Currently:

```javascript
  brokerAccountNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'broker_account_number',
    comment: 'Account number on the broker (Valetax)'
  },
```

Change `allowNull: false` to `allowNull: true` so wizard can create row before user submits broker number.

```javascript
  brokerAccountNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'broker_account_number',
    comment: 'Account number on the broker (Valetax). Nullable: wizard creates the row in step 1 before user has provided the number in step 3.'
  },
```

- [ ] **Step 2: Add `linkClickedAt` field**

After the `notes` field (around line 105-108), before `createdAt` (line 109), add:

```javascript
  linkClickedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'link_clicked_at',
    comment: 'When user clicked the Valetax registration link from /daftar-ib step 1'
  },
  depositConfirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deposit_confirmed_at',
    comment: 'When user confirmed deposit in /daftar-ib step 2'
  },
```

- [ ] **Step 3: Verify file syntax loads**

Run from project root:

```powershell
cd C:\Users\USER\gt\new\qtassist5251
node -e "const m = require('./src/database/models/IbAccount.js'); console.log('OK', Object.keys(m.rawAttributes).filter(k => k.includes('At') || k.includes('broker')))"
```

Expected output: `OK [ 'brokerAccountNumber', ... 'linkClickedAt', 'depositConfirmedAt', 'createdAt', 'updatedAt' ]`

- [ ] **Step 4: Commit**

```powershell
git add src/database/models/IbAccount.js
git commit -m "IB: add linkClickedAt + depositConfirmedAt fields, relax broker_account_number to nullable"
```

---

## Task 2: Migration script

**Files:**
- Create: `src/database/migrations/add-ib-tracking-columns.js`

- [ ] **Step 1: Check existing migration directory structure**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
Test-Path -LiteralPath "src\database\migrations"
Get-ChildItem -LiteralPath "src\database\migrations" -ErrorAction SilentlyContinue | Select-Object Name
```

Expected: directory exists, possibly empty or contains other migration .js files. If directory missing, the file create in Step 2 will create it.

- [ ] **Step 2: Write the migration script**

Create `src/database/migrations/add-ib-tracking-columns.js` with EXACT content:

```javascript
/**
 * Migration: add IB tracking columns
 *
 * Adds linkClickedAt and depositConfirmedAt to ib_accounts. Also relaxes
 * broker_account_number from NOT NULL to nullable so wizard can create
 * the row in step 1 before user provides the number in step 3.
 *
 * Idempotent — safe to re-run. Checks current column state before each
 * change. Run once via:
 *
 *   node src/database/migrations/add-ib-tracking-columns.js
 *
 * Then restart the bot.
 */

require('dotenv').config();
const { sequelize } = require('../sequelize');

async function migrate() {
  const queryInterface = sequelize.getQueryInterface();
  let tableDescription;

  try {
    tableDescription = await queryInterface.describeTable('ib_accounts');
  } catch (err) {
    console.error('❌ Could not describe ib_accounts table:', err.message);
    console.error('   Make sure DATABASE_URL or DB_* env vars are set and the table exists.');
    await sequelize.close();
    process.exit(1);
  }

  // Add link_clicked_at if missing
  if (!tableDescription.link_clicked_at) {
    await queryInterface.addColumn('ib_accounts', 'link_clicked_at', {
      type: 'TIMESTAMP',
      allowNull: true
    });
    console.log('✅ Added column link_clicked_at to ib_accounts');
  } else {
    console.log('ℹ️  Column link_clicked_at already exists, skipping');
  }

  // Add deposit_confirmed_at if missing
  if (!tableDescription.deposit_confirmed_at) {
    await queryInterface.addColumn('ib_accounts', 'deposit_confirmed_at', {
      type: 'TIMESTAMP',
      allowNull: true
    });
    console.log('✅ Added column deposit_confirmed_at to ib_accounts');
  } else {
    console.log('ℹ️  Column deposit_confirmed_at already exists, skipping');
  }

  // Relax broker_account_number to nullable if currently NOT NULL
  const brokerCol = tableDescription.broker_account_number;
  if (brokerCol && brokerCol.allowNull === false) {
    await queryInterface.changeColumn('ib_accounts', 'broker_account_number', {
      type: 'VARCHAR(255)',
      allowNull: true
    });
    console.log('✅ Relaxed broker_account_number to nullable');
  } else if (brokerCol && brokerCol.allowNull === true) {
    console.log('ℹ️  Column broker_account_number already nullable, skipping');
  } else {
    console.warn('⚠️  Column broker_account_number not found — was the table renamed?');
  }

  console.log('✅ Migration complete');
  await sequelize.close();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify migration script syntax loads**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
node --check src/database/migrations/add-ib-tracking-columns.js
```

Expected: no output (syntax OK).

- [ ] **Step 4: Run migration against local database**

This is destructive (modifies schema). Make sure local PostgreSQL is running and `.env` is set.

```powershell
cd C:\Users\USER\gt\new\qtassist5251
node src/database/migrations/add-ib-tracking-columns.js
```

Expected output (first run):
```
✅ Added column link_clicked_at to ib_accounts
✅ Added column deposit_confirmed_at to ib_accounts
✅ Relaxed broker_account_number to nullable
✅ Migration complete
```

If `ib_accounts` table doesn't exist locally yet (fresh install never started bot), this will print error from describeTable. That's expected — start bot once first to let Sequelize create the table, then re-run migration.

- [ ] **Step 5: Verify by re-running (idempotency check)**

```powershell
node src/database/migrations/add-ib-tracking-columns.js
```

Expected output (second run):
```
ℹ️  Column link_clicked_at already exists, skipping
ℹ️  Column deposit_confirmed_at already exists, skipping
ℹ️  Column broker_account_number already nullable, skipping
✅ Migration complete
```

- [ ] **Step 6: Commit**

```powershell
git add src/database/migrations/add-ib-tracking-columns.js
git commit -m "IB: add migration script for ib_accounts tracking columns"
```

---

## Task 3: New endpoint — track-link-clicked

**Files:**
- Modify: `src/web/routes/ib.js`

- [ ] **Step 1: Locate the user-facing routes section**

Open `src/web/routes/ib.js`. Find the comment block:

```javascript
  /* ────────────────────────────────────────────────────────────────────
   * User-facing routes (any logged-in dashboard user, admin or not).
   *
   * These power the /daftar-ib SPA page so non-admin Discord users can
   * submit their broker account number and see verification status
   * without touching admin endpoints below.
   * ──────────────────────────────────────────────────────────────────── */
```

After this block there are existing routes: `router.get('/my-account', ...)` and `router.post('/my-account', ...)` and `router.post('/my-account/reverify', ...)`.

- [ ] **Step 2: Insert track-link-clicked endpoint AFTER the existing GET /my-account but BEFORE POST /my-account**

Find the line that closes the GET `/my-account` handler (it ends with `});`). After that closing line and before the next `router.post('/my-account', ...)`, insert:

```javascript
  router.post('/my-account/track-link-clicked', requireAuth, async (req, res) => {
    try {
      const serverId = String(process.env.DISCORD_GUILD_ID || '');
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const [account] = await IbAccount.findOrCreate({
        where: { serverId, userId: req.session.discordId },
        defaults: {
          serverId,
          userId: req.session.discordId,
          status: 'pending',
          brokerAccountNumber: null,
          retryCount: 0
        }
      });

      // Idempotent: only set if currently null
      if (!account.linkClickedAt) {
        account.linkClickedAt = new Date();
        await account.save();
      }

      return res.json({ ok: true, account: serializeAccount(account) });
    } catch (error) {
      console.error('POST /api/ib/my-account/track-link-clicked error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });
```

- [ ] **Step 3: Verify file syntax loads**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
node -e "const r = require('./src/web/routes/ib.js'); console.log('OK ib router type:', typeof r)"
```

Expected output: `OK ib router type: function`

- [ ] **Step 4: Commit**

```powershell
git add src/web/routes/ib.js
git commit -m "IB: add POST /api/ib/my-account/track-link-clicked endpoint"
```

---

## Task 4: New endpoint — track-deposit-confirmed

**Files:**
- Modify: `src/web/routes/ib.js`

- [ ] **Step 1: Insert track-deposit-confirmed endpoint after track-link-clicked**

Find the closing `});` of the `track-link-clicked` route added in Task 3. After it (and before existing POST `/my-account`), insert:

```javascript
  router.post('/my-account/track-deposit-confirmed', requireAuth, async (req, res) => {
    try {
      const serverId = String(process.env.DISCORD_GUILD_ID || '');
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const account = await IbAccount.findOne({
        where: { serverId, userId: req.session.discordId }
      });
      if (!account) {
        return res.status(404).json({
          error: 'no_account',
          message: 'Selesaikan step 1 dulu sebelum konfirmasi deposit.'
        });
      }
      if (!account.linkClickedAt) {
        return res.status(409).json({
          error: 'step_1_incomplete',
          message: 'Selesaikan step 1 (daftar Valetax) dulu.'
        });
      }

      // Idempotent: only set if currently null
      if (!account.depositConfirmedAt) {
        account.depositConfirmedAt = new Date();
        await account.save();
      }

      return res.json({ ok: true, account: serializeAccount(account) });
    } catch (error) {
      console.error('POST /api/ib/my-account/track-deposit-confirmed error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });
```

- [ ] **Step 2: Verify file syntax loads**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
node -e "const r = require('./src/web/routes/ib.js'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```powershell
git add src/web/routes/ib.js
git commit -m "IB: add POST /api/ib/my-account/track-deposit-confirmed endpoint"
```

---

## Task 5: Extend serializeAccount + POST submit validation

**Files:**
- Modify: `src/web/routes/ib.js`

- [ ] **Step 1: Locate the `serializeAccount` function**

Find `function serializeAccount(a) {` near the bottom of the file. The current return statement looks like:

```javascript
function serializeAccount(a) {
  return {
    id: a.id,
    serverId: a.serverId,
    userId: a.userId,
    brokerAccountNumber: a.brokerAccountNumber,
    status: a.status,
    retryCount: a.retryCount,
    nextRetryAt: a.nextRetryAt,
    lastCheckedAt: a.lastCheckedAt,
    lastError: a.lastError,
    lastCheckResponse: a.lastCheckResponse,
    verifiedAt: a.verifiedAt,
    totalDepositUsd: a.totalDepositUsd != null ? Number(a.totalDepositUsd) : null,
    lastVolumeAt: a.lastVolumeAt,
    consecutiveZeroVolumeDays: a.consecutiveZeroVolumeDays,
    removedAt: a.removedAt,
    removedReason: a.removedReason,
    notes: a.notes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}
```

Add `linkClickedAt` and `depositConfirmedAt` after `brokerAccountNumber`:

```javascript
function serializeAccount(a) {
  return {
    id: a.id,
    serverId: a.serverId,
    userId: a.userId,
    brokerAccountNumber: a.brokerAccountNumber,
    linkClickedAt: a.linkClickedAt,
    depositConfirmedAt: a.depositConfirmedAt,
    status: a.status,
    retryCount: a.retryCount,
    nextRetryAt: a.nextRetryAt,
    lastCheckedAt: a.lastCheckedAt,
    lastError: a.lastError,
    lastCheckResponse: a.lastCheckResponse,
    verifiedAt: a.verifiedAt,
    totalDepositUsd: a.totalDepositUsd != null ? Number(a.totalDepositUsd) : null,
    lastVolumeAt: a.lastVolumeAt,
    consecutiveZeroVolumeDays: a.consecutiveZeroVolumeDays,
    removedAt: a.removedAt,
    removedReason: a.removedReason,
    notes: a.notes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}
```

- [ ] **Step 2: Locate POST /my-account handler — add step validation**

Find the POST `/my-account` route. Inside the handler body, look for the validation chain that checks the broker account number format (regex `^[A-Za-z0-9_-]{3,32}$`).

After the format validation but BEFORE the `submitAccount` service call, insert step-completion check. The relevant section currently looks like:

```javascript
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(accountNumber)) {
        return res.status(400).json({
          error: 'invalid_account_number',
          message: 'Nomor akun tidak valid.'
        });
      }

      const client = getDiscordClient();
```

Replace with:

```javascript
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(accountNumber)) {
        return res.status(400).json({
          error: 'invalid_account_number',
          message: 'Nomor akun tidak valid.'
        });
      }

      // Wizard step-completion guard. Skipped for legacy accounts that already
      // have a brokerAccountNumber (mid-retry users from before this feature
      // landed) so they can still submit retries without first running the
      // wizard backfill.
      const existing = await IbAccount.findOne({
        where: { serverId, userId: req.session.discordId }
      });
      const isLegacyMidFlow = existing && existing.brokerAccountNumber !== null;
      if (!isLegacyMidFlow) {
        if (!existing || !existing.linkClickedAt) {
          return res.status(412).json({
            error: 'step_1_incomplete',
            message: 'Selesaikan step 1 (daftar Valetax) dulu.'
          });
        }
        if (!existing.depositConfirmedAt) {
          return res.status(412).json({
            error: 'step_2_incomplete',
            message: 'Selesaikan step 2 (konfirmasi deposit) dulu.'
          });
        }
      }

      const client = getDiscordClient();
```

- [ ] **Step 3: Verify file syntax loads**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
node -e "const r = require('./src/web/routes/ib.js'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 4: Commit**

```powershell
git add src/web/routes/ib.js
git commit -m "IB: serialize tracking timestamps, validate step completion on submit"
```

---

## Task 6: Delete /ib-setup slash command

**Files:**
- Delete: `src/commands/admin/ib-setup.js`

- [ ] **Step 1: Confirm file exists**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
Test-Path -LiteralPath "src\commands\admin\ib-setup.js"
```

Expected: `True`

- [ ] **Step 2: Delete the file**

```powershell
Remove-Item -LiteralPath "src\commands\admin\ib-setup.js"
Test-Path -LiteralPath "src\commands\admin\ib-setup.js"
```

Expected: `False`

- [ ] **Step 3: Verify no other code imports it**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
Select-String -Path "src\**\*.js" -Pattern "require.+ib-setup|require.+ibSetup" -ErrorAction SilentlyContinue
```

Expected: no matches.

- [ ] **Step 4: Commit**

```powershell
git add -A src/commands/admin/ib-setup.js
git commit -m "IB: delete /ib-setup slash command (entry point moved to /daftar-ib)"
```

---

## Task 7: Delete handleIbRegister handlers

**Files:**
- Modify: `src/events/interactionCreate.js`

- [ ] **Step 1: Find dispatch for ib_register button**

The dispatch is at line 110. Find:

```javascript
        // Handle IB registration button
        if (interaction.customId === 'ib_register') {
          await handleIbRegister(interaction);
        }
```

Replace these 4 lines with a one-line fallback that points users to the dashboard. The user might still see old embeds with the deprecated button.

```javascript
        // Legacy IB button — feature moved to /daftar-ib in dashboard. Notify the user.
        if (interaction.customId === 'ib_register') {
          await interaction.reply({
            embeds: [createInfoEmbed(
              'Pendaftaran IB Pindah',
              'Daftar IB sekarang dilakukan di dashboard. Buka halaman /daftar-ib di browser kamu setelah login.'
            )],
            ephemeral: true
          });
        }
```

- [ ] **Step 2: Find dispatch for ib_register_modal**

The dispatch is at line 145. Find:

```javascript
        if (interaction.customId === 'ib_register_modal') {
          await handleIbRegisterModalSubmit(interaction);
        }
```

Delete these 3 lines entirely. Modal won't be triggered anymore since button no longer opens it.

- [ ] **Step 3: Find handleIbRegister function definition**

Search for `async function handleIbRegister(interaction) {`. It starts around line 1287. Find the comment header (line 1280):

```javascript
// IB registration flow (used by /ib-setup embed)
```

Then the function:

```javascript
async function handleIbRegister(interaction) {
  // ... function body
}
```

Then `handleIbRegisterModalSubmit`:

```javascript
async function handleIbRegisterModalSubmit(interaction) {
  // ... function body
}
```

Delete the comment header and BOTH function definitions entirely. Both functions are no longer referenced after Steps 1 and 2.

- [ ] **Step 4: Verify the file syntax loads**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
node --check src/events/interactionCreate.js
```

Expected: no output (syntax OK).

- [ ] **Step 5: Verify no orphan references remain**

```powershell
Select-String -Path "src\events\interactionCreate.js" -Pattern "handleIbRegister|ib_register_modal"
```

Expected: only the customId string `'ib_register'` in the legacy fallback. No references to `handleIbRegister`, `handleIbRegisterModalSubmit`, or `ib_register_modal`.

- [ ] **Step 6: Commit**

```powershell
git add src/events/interactionCreate.js
git commit -m "IB: delete handleIbRegister + modal handler, replace button dispatch with dashboard redirect notice"
```

---

## Task 8: Frontend — StepIndicator component

**Files:**
- Create: `web-admin/src/pages/daftar-ib/StepIndicator.jsx`

- [ ] **Step 1: Verify directory does not exist yet**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
Test-Path -LiteralPath "web-admin\src\pages\daftar-ib"
```

Expected: `False` (will be created when first file is written).

- [ ] **Step 2: Create StepIndicator.jsx**

Create file `web-admin/src/pages/daftar-ib/StepIndicator.jsx` with EXACT content:

```jsx
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * StepIndicator — 3-step horizontal progress indicator for /daftar-ib wizard.
 *
 * Active step: bg-primary teal block.
 * Done steps:  bg-success-soft + check icon.
 * Pending:     bg-surface + border.
 *
 * Step labels rendered below in mono uppercase 10px.
 */
export function StepIndicator({ activeStep }) {
  const steps = [
    { n: 1, label: 'Daftar Valetax' },
    { n: 2, label: 'Setor Deposit' },
    { n: 3, label: 'Submit Akun' }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => {
          const isActive = step.n === activeStep;
          const isDone = step.n < activeStep;
          return (
            <div key={step.n} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center font-display text-base font-black border-2 transition-colors duration-75',
                  isActive && 'bg-primary text-primary-fg border-primary',
                  isDone && 'bg-success-soft text-success border-success',
                  !isActive && !isDone && 'bg-surface text-fg-muted border-border'
                )}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${step.n} ${isDone ? 'selesai' : isActive ? 'aktif' : 'belum'}`}
              >
                {isDone ? <CheckCircle2 className="h-5 w-5" /> : step.n}
              </div>
              {idx < steps.length - 1 ? (
                <div
                  className={cn(
                    'h-0.5 flex-1 transition-colors duration-75',
                    step.n < activeStep ? 'bg-success' : 'bg-border'
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step) => (
          <div
            key={step.n}
            className={cn(
              'text-center font-mono text-[10px] font-bold uppercase tracking-[0.15em]',
              step.n === activeStep ? 'text-fg' : 'text-muted-fg'
            )}
          >
            {step.label}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `✓ built in Ns`. Component is unused yet, Vite tree-shakes it from the bundle.

- [ ] **Step 4: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/pages/daftar-ib/StepIndicator.jsx
git commit -m "web-admin: add StepIndicator component for /daftar-ib wizard"
```

---

## Task 9: Frontend — Step1Register component

**Files:**
- Create: `web-admin/src/pages/daftar-ib/Step1Register.jsx`

- [ ] **Step 1: Create Step1Register.jsx**

Create file with EXACT content:

```jsx
import { useState } from 'react';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';

/**
 * Step1Register — wizard step 1.
 *
 * User clicks the Valetax registration link (opens new tab, fires
 * background trackLinkClicked call), confirms via checkbox, then
 * advances to step 2.
 *
 * Props:
 *   config           — IbConfig object with `ibLink` field (string URL or null)
 *   onAdvance        — () => void, called when user clicks the advance button
 *   trackLinkClicked — () => Promise<void>, fired on link click (background)
 */
export function Step1Register({ config, onAdvance, trackLinkClicked }) {
  const [confirmed, setConfirmed] = useState(false);
  const [linkOpened, setLinkOpened] = useState(false);

  function handleLinkClick() {
    // Fire-and-forget tracking. Don't block UI on result.
    trackLinkClicked().catch(() => {
      // Network failure is non-fatal — user can still continue.
    });
    setLinkOpened(true);
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
            Step 1 of 3
          </div>
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-fg mt-1">
            Daftar di Valetax
          </h2>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <p className="text-sm text-muted-fg leading-relaxed">
          Klik tombol di bawah untuk register akun Valetax baru. Pakai link IB
          resmi QTrades supaya kamu di-attach ke kelompok partner. Kalau kamu
          sudah punya akun Valetax sebelumnya, kamu masih bisa lanjut — bot
          akan auto-detect saat verifikasi.
        </p>

        {config?.ibLink ? (
          <a
            href={config.ibLink}
            target="_blank"
            rel="noreferrer"
            onClick={handleLinkClick}
            className="inline-flex w-full items-center justify-center gap-2.5 border-2 border-primary bg-transparent px-5 py-3.5 font-display font-bold text-primary uppercase tracking-wider text-sm transition-colors duration-75 hover:bg-primary hover:text-primary-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <ExternalLink className="h-5 w-5" />
            Buka Link Pendaftaran Valetax
          </a>
        ) : (
          <div className="border border-warning/40 bg-warning-soft px-3 py-2 font-mono text-sm text-warning">
            Link IB belum diset oleh admin. Hubungi admin server.
          </div>
        )}

        <label className="flex items-start gap-3 border border-border bg-surface-2 p-3 text-sm text-fg cursor-pointer hover:bg-surface-3 transition-colors duration-75">
          <input
            type="checkbox"
            className="mt-0.5 border-border"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>Aku sudah register akun di Valetax via link tersebut</span>
        </label>

        <div className="flex justify-end">
          <Button
            onClick={onAdvance}
            disabled={!confirmed}
            trailingIcon={ArrowRight}
          >
            Lanjut ke Step 2
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `✓ built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/pages/daftar-ib/Step1Register.jsx
git commit -m "web-admin: add Step1Register component for /daftar-ib wizard"
```

---

## Task 10: Frontend — Step2Deposit component

**Files:**
- Create: `web-admin/src/pages/daftar-ib/Step2Deposit.jsx`

- [ ] **Step 1: Create Step2Deposit.jsx**

Create file with EXACT content:

```jsx
import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { KPIBlock } from '../../components/ui/brutalist/index.js';

/**
 * Step2Deposit — wizard step 2.
 *
 * Shows minimum deposit amount as a KPI block, asks user to confirm
 * via checkbox, then advances to step 3 after firing the
 * trackDepositConfirmed call (which gates step-3 submit on the backend).
 *
 * Props:
 *   config                 — IbConfig with `minDepositUsd` field
 *   onBack                 — () => void
 *   onAdvance              — () => void, called after track succeeds
 *   trackDepositConfirmed  — () => Promise<{ ok }>, must succeed before advancing
 */
export function Step2Deposit({ config, onBack, onAdvance, trackDepositConfirmed }) {
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const minDeposit = Number(config?.minDepositUsd) || 0;

  async function handleAdvance() {
    setSubmitting(true);
    setError(null);
    try {
      await trackDepositConfirmed();
      onAdvance();
    } catch (err) {
      setError(err?.message || 'Gagal lanjut ke step 3. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
            Step 2 of 3
          </div>
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-fg mt-1">
            Setor Deposit
          </h2>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <KPIBlock
          label="Minimum Deposit"
          value={`USD ${minDeposit.toFixed(2)}`}
          tone="primary"
          size="lg"
        />

        <p className="text-sm text-muted-fg leading-relaxed">
          Lakukan deposit minimum di akun Valetax kamu sebelum lanjut. Bot akan
          auto-verify deposit saat kamu submit nomor akun di step berikutnya.
          Kalau deposit kurang dari minimum, status akan jadi pending sampai
          deposit-nya cukup.
        </p>

        <label className="flex items-start gap-3 border border-border bg-surface-2 p-3 text-sm text-fg cursor-pointer hover:bg-surface-3 transition-colors duration-75">
          <input
            type="checkbox"
            className="mt-0.5 border-border"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>Aku sudah setor deposit minimum di akun Valetax saya</span>
        </label>

        {error ? (
          <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="flex justify-between gap-3">
          <Button
            variant="secondary"
            onClick={onBack}
            leadingIcon={ArrowLeft}
            disabled={submitting}
          >
            Kembali
          </Button>
          <Button
            onClick={handleAdvance}
            disabled={!confirmed || submitting}
            loading={submitting}
            trailingIcon={ArrowRight}
          >
            Lanjut ke Step 3
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `✓ built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/pages/daftar-ib/Step2Deposit.jsx
git commit -m "web-admin: add Step2Deposit component for /daftar-ib wizard"
```

---

## Task 11: Frontend — Step3Submit component

**Files:**
- Create: `web-admin/src/pages/daftar-ib/Step3Submit.jsx`

- [ ] **Step 1: Create Step3Submit.jsx**

Create file with EXACT content:

```jsx
import { useState } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, FormField } from '../../components/ui/Input.jsx';
import { StatusPill } from '../../components/ui/brutalist/index.js';

/**
 * Step3Submit — wizard step 3.
 *
 * Initial render: form to input broker account number and submit.
 * Post-submit: inline status display with the resulting account state.
 *   - pending  → loading-style banner + reverify button
 *   - failed   → error banner + retry option
 *   - removed  → role-revoked banner + retry option
 *   - verified → handled by parent (renders StatusView instead)
 *
 * Props:
 *   account     — current IbAccount or null. Has lastError if returning from failed/removed.
 *   onBack      — () => void (only relevant for forward flow; failed/removed users
 *                  don't really need it but we leave it accessible)
 *   onSubmit    — (brokerAccountNumber: string) => Promise<account>
 *   onReverify  — () => Promise<{result, account}>
 */
export function Step3Submit({ account, onBack, onSubmit, onReverify }) {
  const [accountInput, setAccountInput] = useState(account?.brokerAccountNumber || '');
  const [submitting, setSubmitting] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [error, setError] = useState(null);

  const status = account?.status;
  const isPending = status === 'pending' && account?.brokerAccountNumber;
  const isFailed = status === 'failed';
  const isRemoved = status === 'removed';
  const showForm = !account?.brokerAccountNumber || isFailed || isRemoved;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!accountInput.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(accountInput.trim());
    } catch (err) {
      setError(err?.message || 'Gagal submit. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReverify() {
    setReverifying(true);
    setError(null);
    try {
      await onReverify();
    } catch (err) {
      setError(err?.message || 'Gagal cek ulang. Coba lagi.');
    } finally {
      setReverifying(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
            Step 3 of 3
          </div>
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-fg mt-1">
            Submit Nomor Akun
          </h2>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {(isFailed || isRemoved) && account?.lastError ? (
          <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
            <div className="font-bold uppercase tracking-wider">
              [ pendaftaran sebelumnya: {isFailed ? 'gagal' : 'role dicabut'} ]
            </div>
            <div className="mt-0.5 font-sans">{account.lastError}</div>
            {account.removedReason ? (
              <div className="mt-0.5 font-sans">{account.removedReason}</div>
            ) : null}
          </div>
        ) : null}

        {isPending ? (
          <div className="border border-warning/40 bg-warning-soft px-3 py-2 font-mono text-sm text-warning">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-bold uppercase tracking-wider">[ menunggu verifikasi ]</span>
              <StatusPill status="pending" className="ml-auto" />
            </div>
            <div className="mt-1 font-sans">
              Akun {account.brokerAccountNumber} sedang dicek otomatis. Bot ulang
              cek tiap beberapa menit. Percobaan {account.retryCount}/5.
            </div>
            {account.lastError ? (
              <div className="mt-1 font-sans opacity-80">{account.lastError}</div>
            ) : null}
          </div>
        ) : null}

        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <p className="text-sm text-muted-fg leading-relaxed">
              Masukkan nomor akun MT5 / Valetax kamu. Bot akan auto-verify ke
              Valetax — kalau akun ditemukan dan deposit cukup, role IB Discord
              langsung dikasih ke kamu.
            </p>

            <FormField label="Nomor akun broker" htmlFor="acct">
              <Input
                id="acct"
                inputMode="numeric"
                autoComplete="off"
                required
                placeholder="contoh: 1234567"
                variant="mono"
                value={accountInput}
                onChange={(e) => setAccountInput(e.target.value)}
                disabled={submitting}
              />
            </FormField>

            {error ? (
              <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
                {error}
              </div>
            ) : null}

            <div className="flex justify-between gap-3">
              <Button
                variant="secondary"
                onClick={onBack}
                leadingIcon={ArrowLeft}
                disabled={submitting}
                type="button"
              >
                Kembali
              </Button>
              <Button
                type="submit"
                loading={submitting}
                disabled={!accountInput.trim() || submitting}
              >
                {submitting ? 'Memverifikasi...' : 'Verifikasi Sekarang'}
              </Button>
            </div>
          </form>
        ) : null}

        {isPending ? (
          <div className="flex justify-end">
            <Button
              variant="secondary"
              leadingIcon={RefreshCw}
              onClick={handleReverify}
              loading={reverifying}
            >
              Cek ulang sekarang
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `✓ built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/pages/daftar-ib/Step3Submit.jsx
git commit -m "web-admin: add Step3Submit component for /daftar-ib wizard"
```

---

## Task 12: Frontend — StatusView component

**Files:**
- Create: `web-admin/src/pages/daftar-ib/StatusView.jsx`

- [ ] **Step 1: Create StatusView.jsx**

Create file with EXACT content:

```jsx
import { useState } from 'react';
import { CheckCircle2, RefreshCw, Copy } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { StatusPill } from '../../components/ui/brutalist/index.js';
import { formatDateTime } from '../../api.js';

/**
 * StatusView — for users whose IB account is already verified.
 *
 * Shows account summary, deposit, last verification, volume tracking.
 * No wizard, just status. User can re-verify on demand.
 *
 * Props:
 *   account     — IbAccount with status='verified'
 *   config      — IbConfig (for minDeposit, volumeCheckEnabled, etc)
 *   onReverify  — () => Promise<{result, account}>
 *   onCopy      — (text: string) => void (for copy-to-clipboard with toast)
 */
export function StatusView({ account, config, onReverify, onCopy }) {
  const [reverifying, setReverifying] = useState(false);
  const [error, setError] = useState(null);

  async function handleReverify() {
    setReverifying(true);
    setError(null);
    try {
      await onReverify();
    } catch (err) {
      setError(err?.message || 'Gagal cek ulang. Coba lagi.');
    } finally {
      setReverifying(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-wider text-fg">
                Akun Terverifikasi
              </div>
              <div className="text-xs text-muted-fg">
                Role IB sudah aktif di Discord. Pertahankan volume trading harian.
              </div>
            </div>
          </div>
          <StatusPill status={account.status} />
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="border border-border bg-surface-2 p-4 text-sm space-y-1.5">
          <Row
            label="Nomor akun broker"
            value={
              <span className="inline-flex items-center gap-2 font-mono text-xs">
                {account.brokerAccountNumber}
                <button
                  type="button"
                  onClick={() => onCopy(account.brokerAccountNumber)}
                  className="text-muted-fg hover:text-fg"
                  title="Salin"
                  aria-label="Salin nomor akun"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </span>
            }
          />
          {account.totalDepositUsd != null ? (
            <Row
              label="Total deposit terdeteksi"
              value={`USD ${Number(account.totalDepositUsd).toFixed(2)}`}
            />
          ) : null}
          {config?.minDepositUsd ? (
            <Row label="Minimum deposit" value={`USD ${Number(config.minDepositUsd).toFixed(2)}`} />
          ) : null}
          <Row
            label="Terakhir dicek"
            value={account.lastCheckedAt ? formatDateTime(account.lastCheckedAt) : 'Belum pernah'}
          />
          {account.verifiedAt ? (
            <Row label="Terverifikasi pada" value={formatDateTime(account.verifiedAt)} />
          ) : null}
          {config?.volumeCheckEnabled ? (
            <>
              <Row
                label="Volume harian terakhir"
                value={
                  account.lastVolumeAt
                    ? formatDateTime(account.lastVolumeAt)
                    : 'Belum ada'
                }
              />
              {account.consecutiveZeroVolumeDays > 0 ? (
                <Row
                  label="Hari tanpa volume"
                  value={
                    <span className="text-warning">
                      {account.consecutiveZeroVolumeDays} / {config.volumeGraceDays} hari
                    </span>
                  }
                />
              ) : null}
            </>
          ) : null}
        </div>

        {error ? (
          <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            variant="secondary"
            leadingIcon={RefreshCw}
            onClick={handleReverify}
            loading={reverifying}
          >
            Cek ulang sekarang
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
        {label}
      </div>
      <div className="text-right">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `✓ built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/pages/daftar-ib/StatusView.jsx
git commit -m "web-admin: add StatusView component for verified IB users"
```

---

## Task 13: Frontend — DaftarIb router rewrite

**Files:**
- Modify: `web-admin/src/pages/DaftarIb.jsx` (full rewrite)

- [ ] **Step 1: Replace entire file content**

Replace `web-admin/src/pages/DaftarIb.jsx` with EXACT content:

```jsx
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api, ApiError } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { StepIndicator } from './daftar-ib/StepIndicator.jsx';
import { Step1Register } from './daftar-ib/Step1Register.jsx';
import { Step2Deposit } from './daftar-ib/Step2Deposit.jsx';
import { Step3Submit } from './daftar-ib/Step3Submit.jsx';
import { StatusView } from './daftar-ib/StatusView.jsx';

/**
 * DaftarIb — IB Valetax registration entry point.
 *
 * Routes between three modes based on account state:
 *   - Verified user → StatusView (no wizard)
 *   - First-timer / mid-flow / failed / removed → Wizard (3 steps)
 *
 * Wizard step is determined by:
 *   - !linkClickedAt           → Step 1
 *   - !depositConfirmedAt      → Step 2
 *   - else                     → Step 3
 *
 * Failed/removed users go straight to Step 3 with banner.
 * Pending users with brokerAccountNumber stay on Step 3 showing status.
 * Local step override allows clicking "Kembali" to go back without losing
 * timestamp data.
 */
export default function DaftarIb() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stepOverride, setStepOverride] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/ib/my-account');
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const config = data?.config;
  const account = data?.account;

  // Determine which step from server data, or honor local override.
  function deriveStep() {
    if (!account) return 1;
    if (account.brokerAccountNumber) return 3;
    if (!account.linkClickedAt) return 1;
    if (!account.depositConfirmedAt) return 2;
    return 3;
  }
  const activeStep = stepOverride ?? deriveStep();

  async function trackLinkClicked() {
    const res = await api.post('/api/ib/my-account/track-link-clicked');
    setData((prev) => ({ ...prev, account: res.account }));
  }

  async function trackDepositConfirmed() {
    const res = await api.post('/api/ib/my-account/track-deposit-confirmed');
    setData((prev) => ({ ...prev, account: res.account }));
  }

  async function submitAccount(brokerAccountNumber) {
    const res = await api.post('/api/ib/my-account', { brokerAccountNumber });
    setData((prev) => ({ ...prev, account: res.account }));
    if (res.account?.status === 'verified') {
      toast.success('Akun kamu terverifikasi. Role IB sudah dikasih.');
    } else if (res.account?.status === 'failed') {
      toast.warning('Verifikasi gagal', { description: res.account.lastError });
    } else {
      toast.info('Akun masuk antrian verifikasi.');
    }
    setStepOverride(null);
  }

  async function reverifyAccount() {
    const res = await api.post('/api/ib/my-account/reverify');
    setData((prev) => ({ ...prev, account: res.account }));
    const status = res?.result?.status;
    if (status === 'verified') {
      toast.success('Akun terverifikasi.');
    } else if (status === 'failed') {
      toast.warning('Verifikasi gagal', { description: res?.result?.message });
    } else {
      toast.info('Belum bisa diverifikasi', { description: res?.result?.message });
    }
  }

  function copyToClipboard(text) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    toast.success('Disalin');
  }

  // ==== Render ====

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar IB"
        description={
          user
            ? `Halo ${user.globalName || user.username}, daftar IB Valetax dalam 3 langkah.`
            : 'Daftar IB Valetax dalam 3 langkah.'
        }
        accent="primary"
      />

      {error ? (
        <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
          {error}
        </div>
      ) : null}

      {config && !config.enabled ? (
        <Card>
          <CardBody>
            <div className="border border-warning/40 bg-warning-soft px-4 py-3 font-mono text-sm text-warning">
              <div className="font-bold uppercase tracking-wider">[ sistem ib dinonaktifkan ]</div>
              <div className="mt-1 font-sans">
                Admin belum mengaktifkan pendaftaran IB. Coba lagi nanti.
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardBody>
            <div className="text-sm text-muted-fg">Memuat data...</div>
          </CardBody>
        </Card>
      ) : null}

      {!loading && account?.status === 'verified' ? (
        <StatusView
          account={account}
          config={config}
          onReverify={reverifyAccount}
          onCopy={copyToClipboard}
        />
      ) : null}

      {!loading && account?.status !== 'verified' ? (
        <>
          <StepIndicator activeStep={activeStep} />

          {activeStep === 1 ? (
            <Step1Register
              config={config}
              onAdvance={() => setStepOverride(2)}
              trackLinkClicked={trackLinkClicked}
            />
          ) : null}

          {activeStep === 2 ? (
            <Step2Deposit
              config={config}
              onBack={() => setStepOverride(1)}
              onAdvance={() => setStepOverride(3)}
              trackDepositConfirmed={trackDepositConfirmed}
            />
          ) : null}

          {activeStep === 3 ? (
            <Step3Submit
              account={account}
              onBack={() => setStepOverride(2)}
              onSubmit={submitAccount}
              onReverify={reverifyAccount}
            />
          ) : null}
        </>
      ) : null}

      <Card>
        <CardBody className="text-xs text-muted-fg space-y-1">
          <div className="font-display text-xs font-bold uppercase tracking-wider text-fg mb-1">
            Cara Kerja
          </div>
          <div>1. Daftar akun Valetax pakai link IB resmi (Step 1).</div>
          <div>2. Setor minimum deposit yang ditentukan admin (Step 2).</div>
          <div>3. Submit nomor akun untuk verifikasi otomatis (Step 3).</div>
          <div>4. Bot auto-cek ke Valetax tiap beberapa menit. Role IB Discord langsung dikasih saat akun ditemukan dan deposit cukup.</div>
          <div>5. Jaga volume trading harian agar role tetap aktif (kalau volume tracking di-enable).</div>
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `✓ built in Ns`.

- [ ] **Step 3: Manual smoke check (optional, only if dev server convenient)**

If dev server is running (npm run dev in web-admin/), navigate to /daftar-ib as a logged-in user. Verify:
- StepIndicator renders 3 steps with step 1 active for first-time user
- Step 1 card shows the Valetax link button
- Checkbox disables/enables the "Lanjut" button correctly

Skip this step if dev server is not running — final smoke happens in Task 14.

- [ ] **Step 4: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/pages/DaftarIb.jsx
git commit -m "web-admin: rewrite DaftarIb as wizard router (3 steps + status view)"
```

---

## Task 14: Final smoke + visual regression check

**Files:**
- No code changes. Manual verification.

- [ ] **Step 1: Run final production build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `✓ built in Ns`. Note bundle size for Dashboard chunk — should be slightly larger due to new components.

- [ ] **Step 2: Verify backend modules load**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
node -e "require('./src/database/models/IbAccount.js'); require('./src/web/routes/ib.js'); require('./src/events/interactionCreate.js'); console.log('OK all modules load')"
```

Expected: `OK all modules load`

- [ ] **Step 3: Run migration locally**

```powershell
node src/database/migrations/add-ib-tracking-columns.js
```

Expected: either "Added" or "already exists" messages, ending with `✅ Migration complete`.

- [ ] **Step 4: Manual user flow smoke test**

Start backend + dev server (or pre-built dist via `npm start` in root), login as non-admin user, navigate to `/daftar-ib`. Walk through:

a) **First-time user (no IbAccount row):**
   - Step indicator shows step 1 active
   - Click "Buka Link Pendaftaran Valetax" → opens Valetax in new tab
   - Backend log shows POST /api/ib/my-account/track-link-clicked
   - Check checkbox → "Lanjut ke Step 2" enabled
   - Click → step indicator step 1 done, step 2 active
   - Step 2 shows minimum deposit KPI
   - Check checkbox → click "Lanjut ke Step 3" → API call track-deposit-confirmed
   - Step 3 shows form
   - Submit a fake number (e.g., "1234567") → status returns
   - If Valetax mock mode, status may be `verified` or `failed`

b) **Returning failed user:** simulate by setting status='failed' in DB. Visit page → step indicator shows step 3 active, banner shows lastError, form pre-filled.

c) **Returning verified user:** set status='verified' in DB. Visit page → no wizard, only StatusView.

- [ ] **Step 5: Manual Discord-side check**

If you have a posted /ib-setup embed in any channel:
- Click the "Daftar IB" button (legacy `customId='ib_register'`)
- Expect: ephemeral reply "Pendaftaran IB Pindah" with dashboard hint
- No modal opens, no error

- [ ] **Step 6: Push to remote**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git status
git log --oneline -20
git push origin main
```

Verify all tasks landed and pushed.

---

## Self-Review Notes

**Spec coverage:**
- ✅ Goals: dashboard-only entry point, 3-step wizard, timestamp tracking, verified users skip wizard
- ✅ User flow state machine: covered in Task 13 deriveStep + stepOverride
- ✅ Step 1 UI + backend: Task 9 + Task 3
- ✅ Step 2 UI + backend: Task 10 + Task 4
- ✅ Step 3 UI + backend: Task 11 + reused existing POST /my-account modified in Task 5
- ✅ StatusView: Task 12
- ✅ Database migration: Tasks 1, 2
- ✅ serializeAccount returns new fields: Task 5
- ✅ Discord-side delete: Tasks 6, 7 (with fallback dispatch for legacy buttons)
- ✅ Edge case: legacy mid-flow account (brokerAccountNumber set, no timestamps): Task 5 step 2 covers via `isLegacyMidFlow` guard

**Placeholder scan:** No TBD/TODO/"similar to Task N". All code blocks are complete.

**Type consistency:**
- `linkClickedAt` and `depositConfirmedAt` are camelCase property names returned by serializeAccount (Task 5), consumed by frontend deriveStep (Task 13)
- Database column names `link_clicked_at` and `deposit_confirmed_at` are snake_case (Sequelize `field` mapping) — consistent in Tasks 1 and 2
- StepIndicator props: `activeStep` (number) — consistent in Tasks 8 and 13
- Step1/2/3 component props (config, onAdvance, etc.) — consistent between component definitions (Tasks 9-11) and parent usage (Task 13)
- `setStepOverride` in Task 13 takes a number 1-3 or null

**Risks identified:**
- Migration script must run before bot restart in production. Documented in Task 2 step 4.
- Legacy users mid-flow without timestamps allowed via `isLegacyMidFlow` guard in Task 5.
- Old Discord embeds with `ib_register` button still functional with informational fallback (Task 7 step 1).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-17-ib-website-flow.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for catching issues early.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
