# Handoff: Public IB Registration

**Date**: 2026-05-15
**Branch**: `feature/public-ib-registration`
**Status**: Implemented, build green, not yet deployed.

---

## Apa yang ditambah

User QTrades sekarang bisa daftar IB dari halaman publik di
`https://qtrades.bensserver.cloud/ib`, login pakai Discord OAuth2, submit
nomor akun broker, dan kalau verifikasi Valetax sukses → role IB di
Discord otomatis kedapatan. Tombol "Daftar IB" di Discord (`/ib-setup`)
**tetap dipertahanin**, jadi user bisa pilih channel yang dia mau.

Backend logic-nya **reuse total** `ibService.submitAccount`,
`ibService.runVerification`, `ibService.reVerifyAccount` — gak ada
duplikasi. Cron retry queue otomatis ikut, audit logging otomatis ikut,
SSE event bus otomatis ikut.

---

## File yang dibuat / diubah

### Backend

- **`src/web/userAuth.js`** — *baru.* Helper JWT terpisah dari admin:
  - Cookie name: `qtassist_user_session` (override via
    `USER_SESSION_COOKIE_NAME`)
  - JWT payload: `{ kind: 'ib_user', discordUserId, username, globalName,
    avatar }`. `kind` field nge-prevent admin cookie dipake di endpoint
    user (dan sebaliknya).
  - TTL 7 hari (lebih panjang dari admin yang 24 jam karena scope-nya
    lebih kecil)
  - `sameSite: 'lax'` (BUKAN `strict`) supaya cookie ke-passing pas Discord
    redirect balik ke kita pas OAuth callback
  - Export `requireUser` middleware

- **`src/web/routes/ibPublic.js`** — *baru.* Router publik yang **TIDAK
  pakai** `requireAuth` admin. Endpoint:
  - `GET  /api/ib-public/auth/discord` — kick-off OAuth, simpan state
    CSRF di cookie short-lived (10 min, scoped path `/api/ib-public/auth`)
  - `GET  /api/ib-public/auth/callback` — tukar code → access token →
    fetch identity → set session cookie → redirect balik ke `/ib`
  - `POST /api/ib-public/auth/logout` — clear cookie
  - `GET  /api/ib-public/config` — config publik (link IB, min deposit,
    retry interval). **Gak return** secret apapun (gak ada cookie
    Valetax, gak ada partner ID).
  - `GET  /api/ib-public/me` — info user + status IB-nya + cek
    membership Discord. Login required.
  - `POST /api/ib-public/register` — submit nomor akun. Login required.
    Pre-check guild membership → kalau belum join, tolak dengan code
    `not_in_server` + invite URL (kalau `DISCORD_INVITE_URL` di-set).
  - `POST /api/ib-public/reverify` — re-cek akun yang udah ada.
  - Rate limit: register 5/5min, reverify 3/min, umum 30/min.
  - **Satu akun per user**: kalau user udah ada akun lain dengan status
    bukan `removed`, ditolak dengan code
    `different_account_already_registered`.
  - **CSRF**: state random di cookie, divalidasi di callback.
  - **Open-redirect**: param `next` cuma terima path relative.

- **`src/web/server.js`** — diubah. Mount router baru di
  `/api/ib-public` (sebelum 404 fallthrough).

- **`.env.example`** — diubah. Tambah var baru:
  - `DISCORD_CLIENT_SECRET` — wajib, dari OAuth2 tab
  - `DISCORD_OAUTH_REDIRECT_URI` — wajib, harus persis sama yang
    didaftarin di Discord Dev Portal
  - `DISCORD_INVITE_URL` — opsional, buat tombol "Join Server"
  - `PUBLIC_SITE_URL` — wajib di production, dipake buat URL redirect
    error OAuth
  - `USER_SESSION_COOKIE_NAME` — opsional, default
    `qtassist_user_session`

### Frontend

- **`web-admin/src/pages/public/IbRegister.jsx`** — *baru.* Halaman
  lengkap, self-contained (no admin layout, no admin nav). Fitur:
  - Theme toggle
  - Banner error OAuth (kalau callback fail)
  - "Login dengan Discord" button (icon SVG inline)
  - User card dengan avatar Discord (CDN URL atau default avatar)
  - Banner kalau user belum jadi member server Discord, dengan tombol
    invite kalau `DISCORD_INVITE_URL` di-set
  - Status card (verified / pending / failed / removed) dengan icon &
    color masing-masing
  - Form input nomor akun (validasi client-side: 3-32 chars,
    huruf/angka/dash)
  - Tombol "Cek sekarang" buat re-verify pas pending/failed
  - Pre-fill form dengan nomor akun lama kalau status failed/removed
  - Map error code dari API ke pesan UI yang ramah

- **`web-admin/src/App.jsx`** — diubah. Tambah:
  ```jsx
  <Route path="/ib" element={<IbRegister />} />
  ```
  **Di luar** `RequireAuth`, jadi user gak perlu admin login buat akses.

---

## Setup di production

### 1. Discord Developer Portal

1. Buka aplikasi Discord-mu di https://discord.com/developers/applications
2. **OAuth2 → Redirects → Add Redirect**:
   - Production: `https://qtrades.bensserver.cloud/api/ib-public/auth/callback`
   - Local dev (kalau perlu): `http://localhost:3000/api/ib-public/auth/callback`
3. Save changes
4. Di tab OAuth2 yang sama, copy **Client Secret** (kalau belum ada,
   klik "Reset Secret"). Ini nilainya buat env `DISCORD_CLIENT_SECRET`.

Scope yang diminta bot: `identify` doang. Gak minta email, gak minta
guilds, gak minta apapun lagi. Bot udah punya akses ke `users.fetch()`
via bot token sendiri buat hal yang lain.

### 2. Edit `.env` di VPS

```env
DISCORD_CLIENT_SECRET=xxx_dari_dev_portal
DISCORD_OAUTH_REDIRECT_URI=https://qtrades.bensserver.cloud/api/ib-public/auth/callback
PUBLIC_SITE_URL=https://qtrades.bensserver.cloud
DISCORD_INVITE_URL=https://discord.gg/xxxxxxx     # opsional
```

`DISCORD_CLIENT_ID` dan `DISCORD_GUILD_ID` udah ada dari sebelumnya, gak
perlu diubah.

### 3. Deploy

```bash
cd /path/to/qtassist5251
git pull origin main      # atau merge feature/public-ib-registration dulu
npm install               # gak ada dep baru, tapi safe to run
npm run build:web
pm2 restart qtassist
```

Verifikasi via:

```bash
curl https://qtrades.bensserver.cloud/api/ib-public/config
# {"enabled":true,"serverId":"...","ibLink":"...","minDepositUsd":100,...}
```

### 4. Test flow end-to-end

1. Buka `https://qtrades.bensserver.cloud/ib` di browser
2. Klik **"Login dengan Discord"**
3. Otorisasi (consent screen). Kalau udah pernah → langsung skip
4. Balik ke `/ib`. User card muncul dengan avatar.
5. Kalau belum daftar → form muncul. Submit nomor akun broker
6. Bot panggil Valetax. Kalau verified → role IB ke-grant. Refresh page
   → status card berubah ke "Terverifikasi"
7. Cek di Discord: role IB udah ada di user

---

## Keputusan desain & kenapa

- **Auth user dipisah total dari auth admin.** Beda cookie, beda
  payload, beda middleware. Kalo digabung, ada risiko privilege
  escalation pas ada bug. Field `kind: 'ib_user'` di JWT payload
  ngeyakinin admin cookie gak bisa dipake di endpoint user dan
  sebaliknya.
- **OAuth2 scope cuma `identify`.** Cukup buat tau Discord ID. Email,
  guilds, dll. gak diperlukan, jadi gak diminta (data minimization).
- **Membership check sebelum panggil Valetax.** Tanpa membership, role
  grant di `runVerification` adalah no-op, dan user dapat experience
  yang membingungkan (sukses verify tapi gak ada role). Di-pre-check
  duluan di `/register` & `/me` supaya UX-nya jelas.
- **Reuse `ibService` total.** Cron retry, audit log, role grant, SSE
  event — semua tetap jalan persis seperti flow Discord. Gak ada code
  duplikat.
- **Discord button di-pertahanin.** Backend-nya satu (sama-sama panggil
  `ibService`), jadi gak ada konflik. User pilih bebas mau daftar via
  Discord modal atau via web.

---

## Saran tambahan (opsional, gak urgent)

1. **Update `/ib-setup` embed** supaya tombolnya jadi link button
   (`ButtonStyle.Link` ke `qtrades.bensserver.cloud/ib`) instead of
   modal, biar consistent. Sekarang dua-duanya jalan paralel.
2. **Reset endpoint admin** — sekarang admin yang mau reset akun user
   supaya bisa daftar ulang dengan nomor lain harus update DB manual
   atau pake tombol "Remove" yang ada. Bisa ditambah tombol "Reset"
   khusus di halaman `IbAccounts`.
3. **Email notification** — kirim email ke user pas verified, bukan cuma
   DM Discord (kalau email binding-nya udah ada via `EmailBinding`
   model).
4. **OAuth refresh token** — sekarang gak disimpan, jadi pas cookie
   expire (7 hari) user perlu login ulang. Bisa di-refresh otomatis
   kalau mau seamless.
5. **Rate limit per IP + per user.** Sekarang rate limit-nya per IP
   (default `express-rate-limit`). Buat cegah abuse multi-account dari
   IP berbeda, bisa ditambah keying by `req.ibUser.discordUserId`.

---

## Known limitations

- **Cookie `sameSite: lax`, bukan `strict`.** Required supaya OAuth
  redirect dari Discord ke `/api/ib-public/auth/callback` bawa
  cookie. `lax` masih aman buat CSRF asal kita pakai state param
  (yang udah di-implement).
- **OAuth state cookie** scoped ke `/api/ib-public/auth` — kalau ada
  reverse proxy yang strip cookie dengan path tertentu, bisa break.
  nginx default-nya pass-through aman.
- **`prompt: 'none'`** di OAuth URL — skip consent screen kalau user
  udah pernah authorize app sebelumnya. Kalau pertama kali, Discord
  akan tetap tampilin consent screen.
- **Cookie domain** gak di-set explicit, jadi default ke host yang
  bikin cookie. Kalau nanti web-admin dipindahin ke subdomain berbeda
  dari API, perlu setup domain explicit.

---

## Verifikasi

- [x] Backend syntax check: `node -c src/web/userAuth.js`,
  `src/web/routes/ibPublic.js`, `src/web/server.js` — semua pass.
- [x] Frontend build: `npm run build:web` — sukses, 2484 modules
  transformed, gak ada warning baru.
- [ ] End-to-end test di staging: belum (perlu Discord OAuth client
  secret)
- [ ] Test di production: belum (perlu deploy)

---

**Last Updated**: 2026-05-15
**Repository**: https://github.com/Nabenns/qtassist5251.git
