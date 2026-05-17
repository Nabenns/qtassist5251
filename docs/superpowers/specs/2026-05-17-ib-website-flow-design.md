# IB Full Website Flow Implementation Spec

**Date:** 2026-05-17
**Status:** Approved, ready for implementation plan
**Scope:** Migrate IB registration entry point from Discord button to dashboard-only 3-step wizard. Delete Discord-side IB UI components. Backend tracking for funnel analytics + step-state persistence.

---

## Goals

Make `/daftar-ib` the single entry point for IB Valetax registration. Remove Discord-side UI (`/ib-setup` slash command and `ib_register` button) so user journey is unified and discoverable from one place.

1. Reduce confusion about where to register IB (Discord vs dashboard)
2. Provide guided step-by-step wizard so first-time users don't get lost
3. Track per-step timestamps in database for funnel analytics
4. Preserve existing functionality: bot-side verification, role assignment, volume tracking, DM notifications
5. Keep backward compatibility for users mid-flow when migration lands

## Non-goals

- Bot does NOT auto-register Valetax accounts on user's behalf (no Valetax registration API used; user still goes to Valetax site to register)
- Email/webhook notifications outside Discord (Discord DM stays the only direct user channel)
- Admin-side IB role gating (any logged-in user can submit; backend natural gate via Valetax verify suffices)
- Cleanup automation for previously posted Discord embeds (admin manual cleanup)
- Multi-server support (still single-server like rest of bot)

---

## User Flow

```
User logs in → /daftar-ib (route already user-accessible)
  │
  ├─ first-timer (no IbAccount row) → Wizard Step 1
  │
  ├─ verified (account.status === 'verified') → Status View (skip wizard)
  │
  ├─ failed / removed → Wizard Step 3 with banner: "Daftar ulang"
  │
  ├─ pending without brokerAccountNumber:
  │    ├─ no linkClickedAt → Step 1
  │    ├─ has linkClickedAt, no depositConfirmedAt → Step 2
  │    └─ has both → Step 3
  │
  └─ pending with brokerAccountNumber (legacy or mid-retry) → Step 3 with status display
```

## Wizard Steps

### Step 1: Daftar Valetax

**Purpose:** Direct user to Valetax registration page with QTrades partner referral link.

**UI:**
- Title "DAFTAR DI VALETAX" (font-display 900 uppercase) + caption "Step 1 of 3"
- Description: "Klik tombol di bawah untuk register akun Valetax baru. Pakai link IB resmi QTrades supaya kamu di-attach ke kelompok partner."
- Primary button "Buka Link Pendaftaran Valetax" with ExternalLink icon — `target="_blank" rel="noreferrer"`
- Side effect on click: POST `/api/ib/my-account/track-link-clicked` (fire-and-forget; UI does not block)
- Below button: checkbox "Aku sudah register akun di Valetax via link tersebut" — required to proceed
- Footer: "Lanjut ke Step 2" button — disabled until checkbox checked

**Backend behavior on link click:**
- Find or create `IbAccount` row by `(serverId, userId)` with `status='pending'`, `brokerAccountNumber=null`, `retryCount=0`
- Set `linkClickedAt = now()` if not already set (idempotent — second click does nothing)
- Return `{ ok: true, account: <serialized> }`

### Step 2: Setor Deposit

**Purpose:** Inform user about minimum deposit requirement and confirm they've deposited.

**UI:**
- Title "SETOR DEPOSIT" + caption "Step 2 of 3"
- KPI block: "USD {minDepositUsd}" labeled "MINIMUM DEPOSIT" (primary tone)
- Description: "Lakukan deposit minimum USD X di akun Valetax kamu sebelum lanjut. Bot akan auto-verify deposit saat kamu submit nomor akun di step berikutnya."
- Checkbox "Aku sudah setor deposit minimum di akun Valetax saya" — required
- Footer: "Kembali" (secondary) + "Lanjut ke Step 3" (primary, disabled until checkbox)

**Backend behavior on next click:**
- POST `/api/ib/my-account/track-deposit-confirmed`
- Validate `account.linkClickedAt !== null` — reject with 409 if not (user shouldn't reach step 2 without step 1)
- Set `depositConfirmedAt = now()` if not already set
- Return `{ ok: true, account: <serialized> }`

### Step 3: Submit Akun

**Purpose:** User submits broker account number, bot verifies inline + redirects to status display.

**UI:**
- Title "SUBMIT NOMOR AKUN" + caption "Step 3 of 3"
- FormField with mono-variant Input for "Nomor akun broker" (placeholder: e.g. `1234567`)
- Description: "Masukkan nomor akun MT5/Valetax kamu. Bot akan auto-verify ke Valetax — kalau akun ditemukan dan deposit cukup, role IB Discord langsung dikasih ke kamu."
- Submit button "Verifikasi Sekarang" — loading text `[ memverifikasi… ]`
- After submit: card transitions to status view inline (without navigation), showing StatusPill + summary
- For status `failed`/`removed` users coming back: show banner with `lastError` reason at top of step

**Backend behavior on submit (existing endpoint, reused):**
- POST `/api/ib/my-account` with `{ brokerAccountNumber }`
- Validate `linkClickedAt !== null && depositConfirmedAt !== null` (new in spec) — reject with 412 Precondition Failed if missing
- Existing logic: trigger `ibService.submitAccount` + inline `runVerification` if config enabled
- Return account state — frontend renders StatusPill based on result

## Status View (verified users)

Skip wizard entirely. Render existing IbAccount card with:

- StatusPill at top
- KPI grid: deposit detected, last checked, verified at, last volume, days without volume
- "Cek ulang sekarang" button (calls existing `/api/ib/my-account/reverify`)
- Note about volume tracking + grace days

For users that returned to dashboard after `failed` or `removed`: show wizard Step 3 with prominent banner:

> "Pendaftaran sebelumnya: {failed/removed} — {reason}. Submit ulang nomor akun untuk mencoba lagi."

---

## Database Migration

### IbAccount table changes

```sql
ALTER TABLE ib_accounts
  ADD COLUMN link_clicked_at TIMESTAMP NULL,
  ADD COLUMN deposit_confirmed_at TIMESTAMP NULL;
```

### Sequelize model update

```javascript
// src/database/models/IbAccount.js — add fields
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
}
```

### Migration script

File: `src/database/migrations/add-ib-tracking-columns.js`

Idempotent: checks if columns exist before adding. Safe to re-run.

```javascript
const { sequelize } = require('../sequelize');

async function migrate() {
  const queryInterface = sequelize.getQueryInterface();
  const tableDescription = await queryInterface.describeTable('ib_accounts');

  if (!tableDescription.link_clicked_at) {
    await queryInterface.addColumn('ib_accounts', 'link_clicked_at', {
      type: 'TIMESTAMP',
      allowNull: true,
      comment: 'When user clicked the Valetax registration link from /daftar-ib step 1'
    });
    console.log('✅ Added column link_clicked_at to ib_accounts');
  } else {
    console.log('ℹ️ Column link_clicked_at already exists, skipping');
  }

  if (!tableDescription.deposit_confirmed_at) {
    await queryInterface.addColumn('ib_accounts', 'deposit_confirmed_at', {
      type: 'TIMESTAMP',
      allowNull: true,
      comment: 'When user confirmed deposit in /daftar-ib step 2'
    });
    console.log('✅ Added column deposit_confirmed_at to ib_accounts');
  } else {
    console.log('ℹ️ Column deposit_confirmed_at already exists, skipping');
  }

  console.log('✅ Migration complete');
  await sequelize.close();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
```

Operator runs: `node src/database/migrations/add-ib-tracking-columns.js` once before restart.

---

## API Changes

### Existing endpoints (modified)

#### GET /api/ib/my-account

Response now includes `linkClickedAt` and `depositConfirmedAt`:

```json
{
  "config": {...},
  "account": {
    "id": 1,
    "status": "pending",
    "brokerAccountNumber": null,
    "linkClickedAt": "2026-05-17T08:00:00.000Z",
    "depositConfirmedAt": null,
    "retryCount": 0,
    ...
  }
}
```

`account` is null if no row exists yet.

#### POST /api/ib/my-account

Validation extended:
- If `linkClickedAt === null` → 412 `{ error: 'step_1_incomplete', message: 'Selesaikan step 1 (daftar Valetax) dulu.' }`
- If `depositConfirmedAt === null` → 412 `{ error: 'step_2_incomplete', message: 'Selesaikan step 2 (konfirmasi deposit) dulu.' }`
- Else: existing flow continues

Backward compat: if account row already has `brokerAccountNumber` (legacy), validation skipped — assumed user is mid-retry.

### New endpoints

#### POST /api/ib/my-account/track-link-clicked

```javascript
router.post('/my-account/track-link-clicked', requireAuth, async (req, res) => {
  const serverId = process.env.DISCORD_GUILD_ID;
  const userId = req.session.discordId;

  const [account] = await IbAccount.findOrCreate({
    where: { serverId, userId },
    defaults: {
      serverId,
      userId,
      status: 'pending',
      brokerAccountNumber: null,
      retryCount: 0
    }
  });

  if (!account.linkClickedAt) {
    account.linkClickedAt = new Date();
    await account.save();
  }

  return res.json({ ok: true, account: serializeAccount(account) });
});
```

Idempotent. Multiple clicks don't overwrite timestamp.

#### POST /api/ib/my-account/track-deposit-confirmed

```javascript
router.post('/my-account/track-deposit-confirmed', requireAuth, async (req, res) => {
  const serverId = process.env.DISCORD_GUILD_ID;
  const userId = req.session.discordId;

  const account = await IbAccount.findOne({ where: { serverId, userId } });
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

  if (!account.depositConfirmedAt) {
    account.depositConfirmedAt = new Date();
    await account.save();
  }

  return res.json({ ok: true, account: serializeAccount(account) });
});
```

### Helper update

`serializeAccount` in routes/ib.js — add fields:

```javascript
function serializeAccount(a) {
  return {
    ...existing,
    linkClickedAt: a.linkClickedAt,
    depositConfirmedAt: a.depositConfirmedAt
  };
}
```

---

## Discord Side: Files to Delete

### Files removed entirely

1. `src/commands/admin/ib-setup.js`

### Files modified to remove IB UI

#### src/events/interactionCreate.js

Remove:
- `if (interaction.customId === 'ib_register')` button handler dispatch (line 110 in current code)
- `if (interaction.customId === 'ib_register_modal')` modal submit dispatch (line 145 in current code)
- `async function handleIbRegister(interaction)` function definition (line 1287)
- `async function handleIbRegisterModalSubmit(interaction)` function definition (line 1327)
- Comment header `// IB registration flow (used by /ib-setup embed)` (line 1280)
- Imports of `ModalBuilder`, `TextInputBuilder`, `TextInputStyle` if no longer used elsewhere — check before removing (used by other modals like email)

#### src/services/postingService.js

No changes — verified via grep that this file does NOT contain `postIbRegistration` or other IB-specific posting code. The IB embed posting lives entirely in `src/commands/admin/ib-setup.js` which gets deleted.

#### src/deploy-commands.js

No changes — verified that commands are loaded via `fs.readdirSync` glob over `src/commands/`. Deleting `ib-setup.js` is sufficient; deploy-commands.js will simply skip it on next deploy run.

### What stays

- `src/services/ibService.js` — full keeps (verifyAccount, processPendingQueue, etc.)
- DM notifications in `cronService.js` — `verified`, `failed`, `removed` DMs to user remain
- Mod log channel notifications (if configured) remain
- All admin slash commands except `ib-setup` (e.g. `/ib-status`, `/ib-list` if they exist) untouched

---

## Frontend File Inventory

### New files

```
web-admin/src/pages/daftar-ib/
├── StepIndicator.jsx        Numbered step circles + connecting lines
├── Step1Register.jsx        Valetax registration link + checkbox
├── Step2Deposit.jsx         Min deposit info + checkbox
├── Step3Submit.jsx          Broker account number form + verify
└── StatusView.jsx           Verified user status display
```

### Modified files

- `web-admin/src/pages/DaftarIb.jsx` — full rewrite as router between wizard and status mode
- `web-admin/src/api.js` — no changes (existing api object suffices)

### Component contracts

#### StepIndicator

```jsx
<StepIndicator activeStep={1 | 2 | 3} />
```

Renders 3 circles with connecting lines, numbered. Active step: bg-primary. Done step: bg-success-soft + check icon. Pending: bg-surface + border. Below: 3-column grid of step labels (mono uppercase 10px).

#### Step1Register

```jsx
<Step1Register
  config={{ ibLink, minDepositUsd, ... }}
  onAdvance={() => setStep(2)}
  trackLinkClicked={() => api.post('/api/ib/my-account/track-link-clicked')}
/>
```

Renders title, link button, checkbox, advance button. `trackLinkClicked` fires on link button click (background, no await on UI).

#### Step2Deposit

```jsx
<Step2Deposit
  config={{ minDepositUsd }}
  onBack={() => setStep(1)}
  onAdvance={() => setStep(3)}
  trackDepositConfirmed={() => api.post('/api/ib/my-account/track-deposit-confirmed')}
/>
```

`trackDepositConfirmed` fires on advance click before transitioning. If returns error (e.g., step 1 not complete), display inline + don't advance.

#### Step3Submit

```jsx
<Step3Submit
  account={account}             // null for first time, has lastError if returning
  onSubmit={(brokerAccountNumber) => Promise<account>}
  onBack={() => setStep(2)}
/>
```

Handles loading state, shows post-submit status inline. Pending status renders progress + "Cek ulang" button. Failed/removed shows banner with reason. Verified transitions to StatusView via parent re-render.

#### StatusView

```jsx
<StatusView account={account} config={config} onReverify={...} />
```

Renders account summary card with all metrics. Used when user returns and is already verified.

#### DaftarIb (router)

```jsx
function DaftarIb() {
  const { account, config, loading } = useIbAccount();

  if (loading) return <Skeleton />;

  // Verified users skip wizard entirely
  if (account?.status === 'verified') {
    return <StatusView account={account} config={config} ... />;
  }

  // Failed/removed users go straight to step 3 with banner
  if (account?.status === 'failed' || account?.status === 'removed') {
    return <WizardLayout activeStep={3}>
      <Step3Submit account={account} ... />
    </WizardLayout>;
  }

  // Determine step from data
  const step = !account?.linkClickedAt ? 1
             : !account?.depositConfirmedAt ? 2
             : 3;

  return <WizardLayout activeStep={step}>{renderStep(step)}</WizardLayout>;
}
```

---

## Edge Cases

### User has legacy account (pre-migration)

- `account.brokerAccountNumber` exists but `linkClickedAt` and `depositConfirmedAt` are null
- DaftarIb router treats: `brokerAccountNumber !== null` → render Step 3 directly with current status
- POST /my-account validation: skip step-completion check if account already has brokerAccountNumber

### User abandons wizard mid-flow

- linkClickedAt set but no further action — next visit goes to Step 2 automatically
- depositConfirmedAt set but no broker number — next visit goes to Step 3
- No expiry on these timestamps — user can return weeks later and continue

### Discord button still posted in some channel

- Old `<button customId="ib_register">` still exists in some Discord embed
- After this change: button click results in interaction error (handler removed)
- Mitigation: admin manually deletes old embed, OR we add a one-line fallback handler that responds with "Pendaftaran sekarang lewat dashboard" + dashboard link
- Decision: include the fallback handler — minimal effort, prevents user confusion

### User confirms step 1 but doesn't actually register at Valetax

- They check the checkbox and proceed without registering
- Step 3 verify will fail (account number doesn't exist in Valetax) → status becomes failed after retry exhaustion
- No prevention needed — natural backend gate

### User changes mind on step 1 (didn't register Valetax yet)

- Just doesn't check the checkbox or doesn't click "Lanjut" — they remain on step 1
- linkClickedAt may or may not be set (if they clicked the link to "preview")
- No reset action needed; user can simply close and come back

### Bot down when user submits step 3

- Frontend gets 503 from existing endpoint
- Show error toast, allow retry
- Account row persists with linkClickedAt + depositConfirmedAt — user can retry submit

---

## Testing Plan

### Manual smoke tests

After deploy, exercise each path:

1. **First-time user:** Login non-admin → /daftar-ib → step 1 (link click + check) → step 2 (deposit check) → step 3 (submit invalid number) → see failed status with retry option
2. **First-time user happy path:** Same flow but submit valid number → status becomes pending → wait 1-2 min for cron → status becomes verified → role assigned in Discord
3. **Returning verified user:** Logout, login as user with already-verified IB → see StatusView, no wizard
4. **Failed user retry:** User with failed status → see step 3 with banner → submit new number → flow continues
5. **Mid-flow abandon:** Submit step 1, refresh page → land on step 2. Submit step 2, refresh → land on step 3.
6. **Step skip protection:** POST /api/ib/my-account/track-deposit-confirmed without first calling track-link-clicked → see 409 step_1_incomplete
7. **Discord button fallback:** Click old `ib_register` button if exists → ephemeral message with dashboard link

### Regression tests

- Existing user with status verified before this change: should display StatusView, not corrupt
- Existing user mid-pending without timestamps: should be allowed to retry without 412 error
- Volume cron still revokes role on inactive accounts (no behavior change)
- Admin /ib-accounts list still shows all users including new ones with timestamps

---

## Phasing

This is one phase, deployed all at once:

1. Run migration script on VPS
2. Pull code, npm install web-admin, build, restart bot
3. Manual smoke tests
4. Tell users about new flow (Discord channel announcement is operator's responsibility)

No feature flag — change is unlikely to break existing users (backward compat via brokerAccountNumber check).

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Migration fails halfway | Idempotent script, safe to re-run. If column add fails, logs which one — operator manual ALTER. |
| User confused by removal of Discord button | Fallback handler points to dashboard. Operator should announce in Discord channel. |
| Existing pending account becomes blocked by new validation | Backward compat: skip validation if `brokerAccountNumber` already set |
| Wizard loses state on browser refresh | All state lives in backend (timestamp columns) — refresh resumes correctly |
| Step 1 "preview" link click vs "actual register" | Backend can't distinguish — but linkClickedAt is just a tracking timestamp, doesn't affect user advancement (checkbox controls advancement) |

---

## Out-of-Scope Notes

- No admin dashboard view for funnel analytics (count of users at each step) — data is queryable in raw SQL by ops, dedicated UI is Phase 2 if needed
- No localized error messages — current ID/EN mix retained
- No email notification on each step transition — DM Discord stays the only notification channel
- No deletion of historical Discord embeds posted via /ib-setup — manual operator cleanup
