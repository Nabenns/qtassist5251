# Brutalist Redesign — QTAssist Web Admin Dashboard

**Date:** 2026-05-16
**Status:** Approved, ready for implementation plan
**Scope:** Visual redesign of web-admin SPA. No business logic, API, or data model changes.

---

## Goals

Replace the current generic admin SaaS aesthetic (Inter font, indigo + slate, soft rounded cards) with a distinctive **Swiss Brutalist Dark** identity that reflects the QTrades brand. Output should:

1. Be visually distinctive from default Tailwind admin templates
2. Use QTrades brand colors as the dominant accent
3. Feel like a control panel for an industrial system, matching the bot's actual role (operations dashboard)
4. Stay functional — readability, accessibility, performance unchanged or improved
5. Survive day-long use (admin operators monitor + intervene throughout the day)

## Non-goals

- Restructure pages or change information architecture
- Touch business logic, services, routes, or API contracts
- Add new features
- Replace the SPA framework, routing library, or build tooling
- Replace existing design-system primitives wholesale (Radix Dialog, Lucide icons stay)

---

## Aesthetic Direction

### Tone

Swiss Brutalist Dark, tuned to QTrades brand. Block-heavy KPI, exposed grid, raw monospace + grotesk pair, hazard-stripe accents, terminal-inspired data presentation. Industrial, no-bullshit, attention-grabbing on the moments that matter (pending review, expired token, failed verification).

Variant landed on: **C3 + QTrades brand** (preview approved 2026-05-16).

### Color tokens (dark, default)

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#08161c` | Page background, dark navy from logo |
| `--surface` | `#0d2329` | Cards, panels |
| `--surface-2` | `#143037` | Nested surfaces, table rows |
| `--surface-3` | `#1a3a40` | Hover states, focus highlights |
| `--border` | `#1f4147` | Sharp 1-2px hairlines |
| `--muted` | `#0d2329` | Skeleton bg |
| `--muted-fg` | `#7eb6b4` | Secondary text, mono labels |
| `--fg` | `#e8f4f1` | Primary text |
| `--fg-muted` | `#5a7378` | Tertiary text, disabled states |
| `--primary` | `#2dd4bf` | Teal Q from logo, all CTAs + active states |
| `--primary-fg` | `#08161c` | Text on primary buttons |
| `--primary-soft` | `#0a3530` | Subtle primary backgrounds |
| `--success` | `#7fffaa` | Approved states |
| `--success-fg` | `#08161c` | Text on success backgrounds |
| `--success-soft` | `#0a3a1a` | Subtle success bg |
| `--warning` | `#facc15` | Pending review, attention required |
| `--warning-fg` | `#08161c` | Text on warning backgrounds |
| `--warning-soft` | `#3a2d05` | Subtle warning bg |
| `--danger` | `#ff6b6b` | Rejected, failed, error |
| `--danger-fg` | `#08161c` | Text on danger backgrounds |
| `--danger-soft` | `#3a1a1a` | Subtle danger bg |
| `--info` | `#60a5fa` | Informational states |
| `--info-fg` | `#08161c` | Text on info backgrounds |
| `--info-soft` | `#0a2540` | Subtle info bg |
| `--ring` | `#2dd4bf` | Focus rings |

### Color tokens (light variant, deferred)

Implemented after dark is stable. Cream paper + jet navy + teal accent, NOT a generic "dark inverted." Specifics drafted in Phase 2.

| Token | Value (placeholder) |
| --- | --- |
| `--bg` | `#fafaf6` |
| `--surface` | `#ffffff` |
| `--border` | `#08161c` (jet navy hairline) |
| `--fg` | `#08161c` |
| `--primary` | `#0d8b7a` (darker teal for AA contrast on cream) |

### Typography

- **Display + body:** [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) — weights 300, 500, 600, 900. Self-hosted via `@fontsource/space-grotesk` to avoid CSP issues with external font CDN.
- **Data + uppercase labels:** [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — weights 400, 500, 700. Self-hosted via `@fontsource/jetbrains-mono`.

Hierarchy via high contrast in size + weight:

| Element | Spec |
| --- | --- |
| Page title (h1) | Space Grotesk 900, 36-48px, tracking -1.5px |
| Section heading (h2) | Space Grotesk 700, 18-22px, tracking -0.5px |
| Card title | Space Grotesk 600, 14-16px |
| Body | Space Grotesk 500, 13-14px |
| Data values (numerics) | Space Grotesk 900, variable size, tracking -1 to -3px |
| Mono label (uppercase) | JetBrains Mono 700, 8-10px, letter-spacing 1.5-2px |
| Mono data row | JetBrains Mono 400-500, 11-12px |

### Motion

Smooth-but-snappy. Animations use `cubic-bezier(0.2, 0.8, 0.2, 1)` (existing project convention), but durations short:

| Use | Duration | Easing |
| --- | --- | --- |
| Page fade-in | 150ms | cubic-bezier custom |
| Modal slide-up | 200ms | ease-out |
| Toast slide-in | 180ms | cubic-bezier custom |
| Hover background swap | instant (no transition) | — |
| Focus ring | instant | — |
| Skeleton shimmer | 1.6s linear infinite | linear |
| Scan-line loading (new) | 1.2s linear infinite | linear |

Hover states use **inversion** (background swap) instead of subtle color shift — matches Brutalist aggressiveness.

### Border + shadow conventions

- **Border-radius:** 0 by default. Specific exceptions: avatar circle, status dot. No more `rounded-xl` / `rounded-2xl`.
- **Borders:** 1px hairline default, 2px for emphasis, 3px never except hazard markers.
- **Shadows:** Replaced with sharp drop-offsets (`box-shadow: 4px 4px 0 var(--border)`) for cards that need elevation. No blurred soft shadows.

---

## Implementation Scope

### Cakupan kerja: A (Design system + Layout)

**In scope:**
1. Replace CSS tokens in `web-admin/src/index.css`
2. Update `web-admin/tailwind.config.js` (border-radius defaults, shadow tokens)
3. Add font self-host setup (`@fontsource/*`)
4. Re-skin all primitives in `web-admin/src/components/ui/`:
   - `Button.jsx` — block-style, no rounded corners, sharp drop shadow, instant hover invert
   - `Input.jsx` + `FormField` — flat border, mono label option, inline focus indicator
   - `Card.jsx` + `CardHeader/Body` — bordered + shadow-step pattern, no rounded
   - `Modal.jsx` + sub-components — full-bleed header with hazard stripe option
   - `Badge.jsx` — block pill, mono uppercase variant for status
   - `Toast.jsx` — slide-in panel with mono header, sharp edges
   - `Tooltip.jsx` — terminal-style with mono font
   - `Table.jsx` + `DataTable` — mono uppercase headers, no zebra, hairline rows
   - `PageHeader.jsx` — block layout with hazard accent line option
   - `Skeleton.jsx` — keep shimmer but adjust colors to new palette
5. Add new Brutalist-specific components in `web-admin/src/components/ui/brutalist/`:
   - `HazardStripe.jsx` — diagonal repeating-linear-gradient teal+navy strip; props for height + density
   - `MonoTable.jsx` — wrapper around `Table` defaulting to mono headers, uppercase, brutalist-tone
   - `KPIBlock.jsx` — block-heavy metric display matching the approved preview
   - `StatusPill.jsx` — terminal-style pill rendering uppercase status enums (`PENDING_REVIEW`, `APPROVED`, etc.)
   - `CommandBar.jsx` — slash-prompt-style action bar for header/footer commands
6. Re-work `web-admin/src/components/Layout.jsx`:
   - Top hazard stripe (4-6px diagonal teal+navy)
   - Sidebar header with QTrades teal "Q" + mono session label
   - Mono nav section labels uppercase
   - Footer with system status indicator (cron last-run, build version, env)
   - Topbar: keep theme toggle, notification toggle, user menu — restyled with new tokens
7. Verify `web-admin/src/pages/Login.jsx` (already custom-styled) still looks coherent with new tokens; tweak if needed for visual consistency

**Out of scope (Cakupan A specifically):**
- Touching individual page files in `web-admin/src/pages/*.jsx` (Dashboard, Transactions, etc.)
- Replacing existing layout grid/structure on those pages
- Adding new pages

Pages keep their current structure. New design system flows through automatically because they all consume `components/ui/*`. This applies to BOTH admin pages and the user-facing `/daftar-ib` page — the redesign reaches both audiences without separate work. If a page looks visually off after redesign (e.g., a custom inline style that fights the new tokens), fix that page individually as a follow-up; do not gold-plate within this iteration.

### Component contracts (new Brutalist components)

#### `<HazardStripe height? density? color?>`

Renders a horizontal hazard stripe.

```jsx
<HazardStripe />                                  // default 6px, teal+navy
<HazardStripe height={8} density={16} />          // larger stripe
<HazardStripe color="warning" />                  // warning yellow + navy
```

Used at:
- Top of Layout (full width, 4-6px)
- Section dividers in PageHeader (optional prop)
- Modal header for high-attention dialogs

#### `<MonoTable>` (alias for `<DataTable variant="mono">`)

Identical API as `DataTable`. Defaults to:
- Header row in JetBrains Mono uppercase 700
- Body rows in Space Grotesk 500
- No zebra, hairline rows
- Hover inverts to surface-2

#### `<KPIBlock label value delta tone>`

Block-heavy metric display.

```jsx
<KPIBlock label="PENDING REVIEW" value="03" delta="+1 LAST 1H" tone="primary" />
<KPIBlock label="VOL · 24H" value="IDR 2.4M" delta="▲ +14% YDA" tone="success" />
```

`tone`: `"primary" | "muted" | "success" | "warning" | "danger"`. Tone determines background + text colors. Always border 2px of `--border` (or transparent when `tone="primary"`).

#### `<StatusPill status>`

Terminal-style status display. Maps known enum values to color tone:

| Status (input) | Display (uppercase) | Tone |
| --- | --- | --- |
| `pending` | `PENDING` | warning |
| `pending_review` | `PENDING_REVIEW` | warning |
| `approved` | `APPROVED` | success |
| `rejected` | `REJECTED` | danger |
| `cancelled` | `CANCELLED` | muted |
| `expired` | `EXPIRED` | muted |
| `verified` | `VERIFIED` | success |
| `failed` | `FAILED` | danger |
| `removed` | `REMOVED` | muted |
| `active` | `ACTIVE` | success |
| `_default_` | uppercase passthrough | muted |

Replaces `<Badge tone="..." dot>...</Badge>` calls in tables/lists where status is an enum. Existing `<Badge>` stays for non-enum uses.

#### `<CommandBar>`

Slash-prompt action bar.

```jsx
<CommandBar prompt="ops $">
  <Button leadingIcon={CheckCircle2} onClick={approve}>approve</Button>
  <Button leadingIcon={XCircle} variant="danger" onClick={reject}>reject</Button>
  <Button variant="secondary" onClick={refresh}>refresh</Button>
</CommandBar>
```

Renders: prompt label, then children inline. Use as bottom action bar in detail pages (transaction detail, IB account detail) and modal footers.

### Component re-skin contracts (existing `ui/`)

All existing components keep their current API/props. Only visual styling changes. If a prop name implies a specific aesthetic (e.g., a `rounded` prop) and conflicts with brutalist tone, document the deprecation and let it become a no-op rather than break consumers.

Specific changes per component documented below.

#### Button

- `border-radius: 0`
- `font-family: Space Grotesk` (heading), `font-weight: 600`
- Primary: bg teal, fg navy, on hover background `--success` (bright green flash)
- Secondary: bg surface-2, fg, border 1px on hover invert
- Danger: bg `--danger`, fg `--danger-fg`, hover background brighten
- Loading state: keep spinner but add monospace `[…]` prefix in label
- Sizes preserved (`sm`, `md`, `lg`)

#### Input + Select + Textarea

- `border-radius: 0`
- Border 1px `--border`, on focus 2px `--ring` plus background tint `--primary-soft`
- Mono variant prop `variant="mono"` for ID/data inputs (e.g., role ID, broker account number)
- Placeholder text uppercase mono in mono variant only

#### Card

- `border-radius: 0`
- Border 1px `--border`
- Optional drop-shadow-step `shadow="step"` prop renders `4px 4px 0 var(--border)`
- `<CardHeader>` may receive optional `<HazardStripe />` decoration via prop

#### Modal

- `border-radius: 0`
- Backdrop blur retained but tinted to `rgba(8, 22, 28, 0.85)`
- Header: optional hazard stripe top edge for high-attention modals (passed via `tone="warning"` or similar)
- Title uses Space Grotesk 700, uppercase optional via prop

#### Badge

- `border-radius: 0` (block pill)
- Mono uppercase variant via existing `dot` API extended to a new `variant="status"`
- Existing tones (`success`/`warning`/`danger`/`neutral`) map to new color tokens

#### Toast

- `border-radius: 0`
- Slide-in from top-right (currently from bottom-right)
- Icon container 32×32 block with tone-colored background
- Mono uppercase tone label inside (`SUCCESS`, `WARNING`, `ERROR`, `INFO`)

#### Tooltip

- Background `--surface-2` border 1px `--border`
- Font JetBrains Mono 11px
- `border-radius: 0`

#### Table + DataTable

- Header row: JetBrains Mono 700 uppercase, color `--muted-fg`, border-bottom 2px `--border`
- Body rows: Space Grotesk 500, hover inverts to `--surface-2`
- No zebra striping
- Cell padding identical to current
- Loading and empty states keep current behavior, restyled

#### PageHeader

- Title in Space Grotesk 900 36-44px, tracking tight
- Description in Space Grotesk 500 14px `--muted-fg`
- Optional `<HazardStripe />` accent line below the title row via `accent` prop
- Action button group right-aligned, mono labels

#### Skeleton

- Background gradient uses new `--muted` and `--surface-2` colors
- `border-radius: 0`

### Layout.jsx (sidebar + topbar)

#### Sidebar

```
┌─────────────────────────┐
│ [hazard stripe 4px]     │  ← teal+navy diagonal
├─────────────────────────┤
│ ◉ Q QTASSIST            │  ← teal Q dot, mono label, session ID
│   admin@discord-id      │  ← mono small
├─────────────────────────┤
│ § OPERASIONAL           │  ← mono uppercase section
│   ▸ DASHBOARD           │  ← mono nav, ▸ when inactive, ▶ when active
│   ▶ TRANSAKSI           │
│   ▸ ROLE SEMENTARA      │
│ ...                     │
├─────────────────────────┤
│ § TOOLS                 │
│ ...                     │
├─────────────────────────┤
│ ≡ system v1.0.0         │  ← footer, mono small, teal version label
│   cron · 04:00 ok       │
│   ws · connected        │
└─────────────────────────┘
```

Width unchanged (60 lg = 240px). Mobile sheet behavior unchanged.

#### Topbar

- Realtime + notification + theme toggle: keep functionality, restyle as monospace pill buttons
- User menu: keep dropdown structure, replace avatar circle with `[Q]` mono block
- Hazard stripe absent on topbar (sidebar already has one); topbar uses border-bottom `--border` only

### Page-level checks (regression)

After re-skin, manually verify each page renders:

- `/login` — already custom Discord-button page; verify color tokens flow through
- `/` Dashboard — KPI section should render via `<KPIBlock>` if existing layout uses card-with-number; manual review needed
- `/transactions`, `/temproles`, `/products`, `/emails`, `/users`, `/audit`, `/discord-post`, `/bot-status`, `/backups`, `/ib-settings`, `/ib-accounts`, `/admin-roles`, `/daftar-ib` — DataTable-driven; should auto-flow from re-skin

If a page uses inline styles that fight tokens, log it. Do NOT fix in this iteration.

---

## Language Conventions

| Surface | Language |
| --- | --- |
| Status enums (StatusPill, table cells) | EN technical, uppercase: `PENDING_REVIEW`, `APPROVED`, `FAILED` |
| Table column headers | EN uppercase short: `ORDER ID`, `USER`, `STATUS`, `AMOUNT` |
| Form field labels | Bahasa Indonesia: "Nomor akun broker", "Alasan penolakan" |
| Sidebar nav labels | Bahasa Indonesia: "Dashboard", "Transaksi", "Role Sementara" |
| Page titles | Bahasa Indonesia: "Akun IB", "Pengaturan Admin" |
| Toast / notification text (admin) | Bahasa Indonesia: "Bukti pembayaran baru" |
| Toast / notification text (user) | Bahasa Indonesia: "Akun kamu sedang dicek otomatis" |
| Modal titles + body | Bahasa Indonesia |
| Mono CommandBar prompts | EN: `ops $`, `ib $`, `admin $` |
| Audit log action types (display) | EN snake-case as stored: `transaction_approved`, `ib_verified` |

---

## Tech Decisions

### Self-host fonts via npm

`@fontsource/space-grotesk` and `@fontsource/jetbrains-mono` added as dependencies in `web-admin/package.json`. Imports go in `web-admin/src/index.css`:

```css
@import '@fontsource/space-grotesk/300.css';
@import '@fontsource/space-grotesk/500.css';
@import '@fontsource/space-grotesk/600.css';
@import '@fontsource/space-grotesk/900.css';
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/500.css';
@import '@fontsource/jetbrains-mono/700.css';
```

Avoids CSP issues with `script-src 'self'` and external font CDN. Adds ~80KB compressed to bundle (acceptable; current app is ~140KB gzipped main bundle).

### Tailwind config additions

```js
fontFamily: {
  sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
  display: ['"Space Grotesk"', 'sans-serif']
},
fontWeight: {
  // existing weights stay; add 900 if not present
}
boxShadow: {
  step: '4px 4px 0 rgb(var(--border))',
  'step-lg': '6px 6px 0 rgb(var(--border))',
  // existing soft + floating retained for legacy components, can deprecate
}
borderRadius: {
  // override defaults to 0
  none: '0',
  sm: '0',
  md: '0',
  lg: '0',
  xl: '0',
  '2xl': '0',
  full: '9999px' // keep for status dot, avatar
}
```

### Dark as default theme

Set `<html class="dark">` in `index.html` and remove the runtime hydration flicker logic. `useTheme()` hook still allows toggling to light, but light variant deferred to Phase 2.

Toggle button stays — clicking it shows a "Light mode coming soon" toast for now; OR temporarily keep the existing light values as a fallback during dev. Decided: temporary fallback (existing slate light theme) so toggle isn't broken.

### Accessibility

- All color combinations pass WCAG AA contrast at minimum
  - Verified pairs: `--fg #e8f4f1` on `--bg #08161c` (16.4:1), `--primary-fg #08161c` on `--primary #2dd4bf` (10.2:1), `--warning-fg #08161c` on `--warning #facc15` (12.4:1)
- Focus rings remain 2px outline + offset, color `--ring`
- Reduced motion preference honored — animations drop to 0.01ms via existing `@media (prefers-reduced-motion: reduce)` rule
- Font sizes never below 11px for any text user reads (mono labels 8-10px are decoration with semantic equivalents nearby)

---

## Validation Plan

### Definition of done (Phase 1, dark only)

1. `npm run build:web` succeeds without TypeScript or build errors
2. Visit each page in dark mode, verify no broken layout / unstyled elements
3. Verify Login page coherent (manual review)
4. Verify hazard stripe renders correctly across browsers (Chrome, Firefox, Edge — operator browsers)
5. Verify keyboard nav focus rings visible on all primitives
6. Run `:focus-visible` check across Button, Input, Modal close button
7. Verify reduced-motion behavior with browser devtools "Reduce motion" toggle
8. Modal opens and closes correctly with new transitions
9. Toast appears top-right, slides in correctly
10. DataTable headers correctly use mono uppercase

### Manual smoke checks per page (logged-in admin)

- `/` Dashboard — KPI numbers render, charts (recharts) still readable on dark bg
- `/transactions` — pagination buttons, status pills correct color, modal approve/reject works
- `/ib-accounts` — same checks as transactions
- `/admin-roles` — picker modal, color dot for role
- `/audit` — date range filter renders, action types display
- `/daftar-ib` (logged-in non-admin) — form input renders correctly, status card rendering

### Regression risks

- Charts (recharts) use hard-coded colors that may not adapt. Audit `web-admin/src/components/charts/*` and patch.
- Inline `style={{...}}` in pages that hard-code rgb() values. Grep + audit; fix critical, log others.
- Inline `className` strings using deprecated rounded utilities. Will visually appear sharp — acceptable.
- Toast position change (bottom-right → top-right) might confuse muscle memory. Documented; admin notified after deploy.

---

## Phasing

**Phase 1 — Dark mode only, this iteration**
- All work scoped above (tokens, fonts, primitive re-skin, new brutalist components, Layout)
- Light variant via temporary fallback to existing slate theme

**Phase 2 — Light variant (separate iteration)**
- Cream + jet navy + teal accent, brutalist consistent
- Replace fallback in `index.css`
- Touch screen capture verification

**Phase 3 — Page-by-page polish (separate iteration, optional)**
- Identify pages that look weak after Phase 1
- Custom layout tweaks where the design system underdelivers
- Ordered by frequency of admin use

---

## File Inventory

Files modified:
- `web-admin/src/index.css`
- `web-admin/tailwind.config.js`
- `web-admin/package.json` (deps: `@fontsource/*`)
- `web-admin/index.html` (add `class="dark"` to root html)
- `web-admin/src/components/Layout.jsx`
- `web-admin/src/components/ui/Button.jsx`
- `web-admin/src/components/ui/Input.jsx`
- `web-admin/src/components/ui/Card.jsx`
- `web-admin/src/components/ui/Modal.jsx`
- `web-admin/src/components/ui/Badge.jsx`
- `web-admin/src/components/ui/Toast.jsx`
- `web-admin/src/components/ui/Tooltip.jsx`
- `web-admin/src/components/ui/Table.jsx`
- `web-admin/src/components/ui/PageHeader.jsx`
- `web-admin/src/components/ui/Skeleton.jsx`
- `web-admin/src/lib/theme.jsx` (default dark + persistence)

Files created:
- `web-admin/src/components/ui/brutalist/HazardStripe.jsx`
- `web-admin/src/components/ui/brutalist/MonoTable.jsx`
- `web-admin/src/components/ui/brutalist/KPIBlock.jsx`
- `web-admin/src/components/ui/brutalist/StatusPill.jsx`
- `web-admin/src/components/ui/brutalist/CommandBar.jsx`
- `web-admin/src/components/ui/brutalist/index.js` (re-export barrel)

Files NOT touched (stay as-is):
- `src/**` (Discord bot)
- `web-admin/src/pages/*.jsx`
- `web-admin/src/api.js`
- `web-admin/src/auth.jsx`
- `web-admin/src/lib/realtime.jsx`
- `web-admin/src/lib/notifications.js`
- `web-admin/src/lib/cn.js`

---

## Out-of-Scope Notes

- Logo asset — operator should set `QTRADES_LOGO_URL` env var separately. The sidebar Q-block uses CSS-styled "Q" text for now, no image dependency.
- Light mode — Phase 2.
- Page-level redesigns — Phase 3 if needed.
- Replacing recharts — accepted limitation that charts may look slightly off until colors are migrated.
- Mobile-first redesign — current responsive sheet behavior preserved, no change.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Bundle size up by ~80KB (fonts) | Self-host with subset; if unacceptable, fall back to system mono + Inter for now |
| recharts dark-bg colors poor | Audit and patch chart color palette in `components/charts/*` as part of Phase 1 |
| Operator visual surprise | Brutalist is bold — confirmed by user during brainstorm; ship behind feature flag if hesitation arises (decision: no flag, direct deploy) |
| WCAG contrast on warning yellow (`#facc15` on `#08161c`) | Verified 12.4:1 — passes AAA |
| Light variant fallback (slate) clashes with brutalist toggle | Acceptable trade-off; toggle tooltip says "Light mode coming soon"; clicking falls back to existing slate theme so the toggle is functionally not broken. Will be replaced in Phase 2. |
