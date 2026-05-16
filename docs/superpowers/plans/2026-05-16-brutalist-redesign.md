# QTAssist Brutalist Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current generic admin SaaS aesthetic of the QTAssist web-admin SPA with a Swiss Brutalist Dark identity tuned to the QTrades brand (teal #2dd4bf + dark navy #08161c).

**Architecture:** CSS variable swap in `index.css` + Tailwind config update + primitive re-skin in `web-admin/src/components/ui/` + 5 new Brutalist components in `components/ui/brutalist/` + Layout rework. Pages and business logic untouched. Self-hosted Space Grotesk + JetBrains Mono via @fontsource. Phase 1 = dark mode only; light variant deferred.

**Tech Stack:** React 18, Vite 5, Tailwind 3, Radix UI primitives, Lucide icons, recharts. Self-hosted fonts via @fontsource/space-grotesk and @fontsource/jetbrains-mono. No new runtime deps beyond fonts.

**Reference:** Spec at `docs/superpowers/specs/2026-05-16-brutalist-redesign-design.md` (commit daf4f47).

---

## File Structure

**Files modified (16):**

- `web-admin/index.html` â€” set `class="dark"` on root, update theme-color logic
- `web-admin/package.json` â€” add @fontsource deps
- `web-admin/tailwind.config.js` â€” fontFamily + boxShadow + borderRadius defaults
- `web-admin/src/index.css` â€” color tokens swap, font imports, component utilities
- `web-admin/src/lib/theme.jsx` â€” default to dark, light variant fallback
- `web-admin/src/components/Layout.jsx` â€” sidebar + topbar rework
- `web-admin/src/components/ui/Button.jsx` â€” re-skin
- `web-admin/src/components/ui/Input.jsx` â€” re-skin + mono variant
- `web-admin/src/components/ui/Card.jsx` â€” re-skin
- `web-admin/src/components/ui/Badge.jsx` â€” re-skin + status variant
- `web-admin/src/components/ui/Modal.jsx` â€” re-skin
- `web-admin/src/components/ui/Toast.jsx` â€” re-skin + reposition top-right
- `web-admin/src/components/ui/Tooltip.jsx` â€” re-skin (mono font)
- `web-admin/src/components/ui/Table.jsx` â€” re-skin (mono headers)
- `web-admin/src/components/ui/PageHeader.jsx` â€” re-skin (display font, hazard accent)
- `web-admin/src/components/ui/Skeleton.jsx` â€” re-skin (border-radius 0)

**Files created (6):**

- `web-admin/src/components/ui/brutalist/HazardStripe.jsx`
- `web-admin/src/components/ui/brutalist/MonoTable.jsx`
- `web-admin/src/components/ui/brutalist/KPIBlock.jsx`
- `web-admin/src/components/ui/brutalist/StatusPill.jsx`
- `web-admin/src/components/ui/brutalist/CommandBar.jsx`
- `web-admin/src/components/ui/brutalist/index.js`

**Files NOT touched:** `src/**` (Discord bot), `web-admin/src/pages/*.jsx`, `web-admin/src/api.js`, `web-admin/src/auth.jsx`, `web-admin/src/lib/realtime.jsx`, `web-admin/src/lib/notifications.js`, `web-admin/src/lib/cn.js`, `web-admin/src/components/charts/*` (audit only, no edit unless broken).

---

## Testing Approach

This is a visual redesign with no behavioral logic changes. Manual smoke checks per task suffice (build success + page renders without errors + visual inspection). No automated test framework exists in `web-admin/`. Setting one up is out of scope; pages are exercised via the existing dev server.

**Verification command for every task:**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected output line: `âœ“ built in <N>s` with no errors.

If a task changes runtime behavior (e.g., theme.jsx default), additional smoke check is `npm run dev` and visit http://localhost:5173/login.

---

## Commit Conventions

This project uses sentence-case messages. Stage explicitly (no `git add .`). Commit messages start with a scope-like prefix: `web-admin:` for SPA changes, `docs:` for plan/spec edits.

Each task has a "Commit" step with the exact files to stage and the message.

---

## Task 1: Install font dependencies

**Files:**
- Modify: `web-admin/package.json`

- [ ] **Step 1: Add font packages to package.json**

Open `web-admin/package.json` and add to `dependencies` (alphabetic order, before `clsx`):

```json
"@fontsource/jetbrains-mono": "^5.1.2",
"@fontsource/space-grotesk": "^5.1.2",
```

After edit, the `dependencies` block should start like:

```json
  "dependencies": {
    "@fontsource/jetbrains-mono": "^5.1.2",
    "@fontsource/space-grotesk": "^5.1.2",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-tooltip": "^1.1.8",
    "clsx": "^2.1.1",
```

- [ ] **Step 2: Install the new deps**

Run from project root:

```powershell
npm install --prefix web-admin
```

Expected: install completes with no errors. `web-admin/node_modules/@fontsource/space-grotesk/` and `web-admin/node_modules/@fontsource/jetbrains-mono/` exist.

- [ ] **Step 3: Verify packages resolve**

```powershell
Test-Path "web-admin\node_modules\@fontsource\space-grotesk\500.css"
Test-Path "web-admin\node_modules\@fontsource\jetbrains-mono\400.css"
```

Both must print `True`.

- [ ] **Step 4: Commit**

```powershell
git add web-admin/package.json web-admin/package-lock.json
git commit -m "web-admin: add @fontsource deps for Space Grotesk + JetBrains Mono"
```

---

## Task 2: Replace design tokens in index.css

**Files:**
- Modify: `web-admin/src/index.css`

- [ ] **Step 1: Replace the entire `:root` token block**

Find the `@layer base { :root { ... } }` block (lines 13-48 in the current file) and replace its body to keep the existing slate/indigo light theme as fallback (Phase 2 will replace it). The current `:root` values are kept as-is for now — DO NOT change them in this task. Only the `.dark` block is replaced in Step 2.

Verify no edit was made to `:root`:

```powershell
Select-String -Path web-admin\src\index.css -Pattern "indigo|slate-50|--primary: 79"
```

Should still match the original indigo line.

- [ ] **Step 2: Replace the entire `.dark` token block**

Find the `.dark { ... }` block (currently lines 50-84) and replace its body with:

```css
  .dark {
    --bg: 8 22 28;              /* #08161c — dark navy from QTrades logo */
    --surface: 13 35 41;         /* #0d2329 */
    --surface-2: 20 48 55;       /* #143037 */
    --surface-3: 26 58 64;       /* #1a3a40 */
    --border: 31 65 71;          /* #1f4147 */
    --muted: 13 35 41;           /* #0d2329 */
    --muted-fg: 126 182 180;     /* #7eb6b4 */
    --fg: 232 244 241;           /* #e8f4f1 */
    --fg-muted: 90 115 120;      /* #5a7378 */

    --primary: 45 212 191;       /* #2dd4bf — QTrades teal */
    --primary-fg: 8 22 28;       /* navy on teal */
    --primary-soft: 10 53 48;    /* #0a3530 */

    --success: 127 255 170;      /* #7fffaa */
    --success-fg: 8 22 28;
    --success-soft: 10 58 26;    /* #0a3a1a */

    --warning: 250 204 21;       /* #facc15 */
    --warning-fg: 8 22 28;
    --warning-soft: 58 45 5;     /* #3a2d05 */

    --danger: 255 107 107;       /* #ff6b6b */
    --danger-fg: 8 22 28;
    --danger-soft: 58 26 26;     /* #3a1a1a */

    --info: 96 165 250;          /* #60a5fa */
    --info-fg: 8 22 28;
    --info-soft: 10 37 64;       /* #0a2540 */

    --ring: 45 212 191;          /* same as primary */

    color-scheme: dark;
  }
```

- [ ] **Step 3: Add font imports at top of index.css**

Add these `@import` lines BEFORE the existing `@tailwind base;` line at the top of the file:

```css
@import '@fontsource/space-grotesk/300.css';
@import '@fontsource/space-grotesk/500.css';
@import '@fontsource/space-grotesk/600.css';
@import '@fontsource/space-grotesk/900.css';
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/500.css';
@import '@fontsource/jetbrains-mono/700.css';

@tailwind base;
```

- [ ] **Step 4: Update body font-family**

Find the `body { ... }` rule (currently around line 89-92) and change `font-family` from Inter to Space Grotesk:

```css
  body {
    @apply bg-bg text-fg antialiased;
    font-family: 'Space Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
```

- [ ] **Step 5: Update `.input` utility class for sharp corners**

Find the `.input` rule (currently around line 148-153) inside `@layer components`. Replace `rounded-lg` with `rounded-none`:

```css
  .input {
    @apply block w-full rounded-none border border-border bg-surface text-fg placeholder:text-muted-fg/70
      px-3 py-2 text-sm shadow-sm transition
      focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40
      disabled:opacity-50 disabled:cursor-not-allowed;
  }
```

- [ ] **Step 6: Update `.surface` utility class**

Find the `.surface` rule (around line 144-146). Replace `rounded-xl` with `rounded-none` and `shadow-soft` with the new step shadow:

```css
  .surface {
    @apply rounded-none bg-surface border border-border;
    box-shadow: 4px 4px 0 rgb(var(--border));
  }
```

- [ ] **Step 7: Update `.badge` utility class**

Find the `.badge` rule (around line 159-161). Replace `rounded-full` with `rounded-none` and update font specs:

```css
  .badge {
    @apply inline-flex items-center gap-1 rounded-none px-2 py-0.5 text-xs font-medium;
  }
```

- [ ] **Step 8: Update `:focus-visible` ring radius**

Find the `:focus-visible` rule (around line 122-127). Change `border-radius: 6px` to `border-radius: 0`:

```css
  :focus-visible {
    outline: 2px solid rgb(var(--ring));
    outline-offset: 2px;
    border-radius: 0;
  }
```

- [ ] **Step 9: Build to verify CSS compiles**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`. The CSS bundle (`dist/assets/index-*.css`) should now contain the new color values. Verify with:

```powershell
Select-String -Path dist\assets\index-*.css -Pattern "8 22 28"
```

Must match (the dark bg color).

- [ ] **Step 10: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/index.css
git commit -m "web-admin: replace dark theme tokens with QTrades brutalist palette"
```

---

## Task 3: Update Tailwind config

**Files:**
- Modify: `web-admin/tailwind.config.js`

- [ ] **Step 1: Add fontFamily section to theme.extend**

Find the `extend: { ... }` block. Insert the following block at the top of `extend`, immediately after the opening `{`:

```js
      fontFamily: {
        sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['"Space Grotesk"', 'sans-serif']
      },
```

- [ ] **Step 2: Override borderRadius defaults**

Find the existing `borderRadius` block (currently has `lg`, `xl`, `2xl`). Replace the entire block:

```js
      borderRadius: {
        none: '0',
        sm: '0',
        DEFAULT: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '9999px'
      },
```

- [ ] **Step 3: Extend boxShadow**

Find the existing `boxShadow` block. Replace the entire block:

```js
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.06)',
        floating:
          '0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10), 0 12px 24px -8px rgb(0 0 0 / 0.10)',
        step: '4px 4px 0 rgb(var(--border))',
        'step-lg': '6px 6px 0 rgb(var(--border))',
        'step-primary': '4px 4px 0 rgb(var(--primary))'
      },
```

- [ ] **Step 4: Build to verify**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/tailwind.config.js
git commit -m "web-admin: configure Tailwind for brutalist tone (sharp corners, mono font, step shadows)"
```

---

## Task 4: Default to dark theme

**Files:**
- Modify: `web-admin/index.html`
- Modify: `web-admin/src/lib/theme.jsx`

- [ ] **Step 1: Update index.html bootstrap script to default dark**

Open `web-admin/index.html`. Find the inline `<script>` block (lines 10-26). Replace the body of the IIFE with logic that defaults to dark when no preference stored:

```html
    <script>
      (function () {
        try {
          var stored = localStorage.getItem('qtassist-theme');
          // Default to dark; light is opt-in via toggle.
          var theme = stored === 'light' ? 'light' : 'dark';
          if (theme === 'dark') document.documentElement.classList.add('dark');
          var meta = document.querySelector('meta[name="theme-color"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'theme-color');
            document.head.appendChild(meta);
          }
          meta.setAttribute('content', theme === 'dark' ? '#08161c' : '#fafaf6');
        } catch (_) {}
      })();
    </script>
```

- [ ] **Step 2: Update theme.jsx readInitialTheme to default dark**

Open `web-admin/src/lib/theme.jsx`. Replace the `readInitialTheme` function (lines 7-19):

```jsx
function readInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (_) {
    // private mode etc.
  }
  // Default to dark; light is an opt-in fallback until Phase 2.
  return 'dark';
}
```

- [ ] **Step 3: Disable OS-pref tracking**

In the same file, replace the `useEffect` block that listens to `prefers-color-scheme` (lines 45-58) with a no-op so the dashboard never auto-switches:

```jsx
  // OS-level theme tracking disabled: the dashboard is dark-first.
  // Users who want light flip the toggle, which we persist to localStorage.
```

(Just delete the entire useEffect block — keep the comment.)

- [ ] **Step 4: Build + smoke test**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/index.html web-admin/src/lib/theme.jsx
git commit -m "web-admin: default to dark theme, disable OS-pref auto-switch"
```

---

## Task 5: Create HazardStripe component

**Files:**
- Create: `web-admin/src/components/ui/brutalist/HazardStripe.jsx`

- [ ] **Step 1: Write the HazardStripe component**

Create file with content:

```jsx
import { cn } from '../../../lib/cn.js';

/**
 * HazardStripe — diagonal repeating-linear-gradient strip used as
 * top-of-layout decoration, section dividers, and modal headers.
 *
 * Props:
 *   height: pixels (default 6)
 *   density: pixels per stripe period (default 12)
 *   color:  one of "primary" | "warning" | "danger" | "success"
 *   className: extra classes
 *
 * Implementation note: we inline the gradient as a style prop because
 * Tailwind cannot generate dynamic repeating-linear-gradient values
 * from arbitrary numeric props.
 */
export function HazardStripe({
  height = 6,
  density = 12,
  color = 'primary',
  className
}) {
  const stripeColors = {
    primary: 'rgb(var(--primary))',
    warning: 'rgb(var(--warning))',
    danger: 'rgb(var(--danger))',
    success: 'rgb(var(--success))'
  };
  const accent = stripeColors[color] || stripeColors.primary;
  const bg = 'rgb(var(--bg))';
  const period = density * 2;

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn('w-full', className)}
      style={{
        height: `${height}px`,
        backgroundImage: `repeating-linear-gradient(135deg, ${accent} 0 ${density}px, ${bg} ${density}px ${period}px)`
      }}
    />
  );
}
```

- [ ] **Step 2: Build to verify**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`. (Component is unused by anyone yet; Vite will tree-shake it from the bundle until it's imported.)

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/brutalist/HazardStripe.jsx
git commit -m "web-admin: add HazardStripe brutalist component"
```

---

## Task 6: Create StatusPill component

**Files:**
- Create: `web-admin/src/components/ui/brutalist/StatusPill.jsx`

- [ ] **Step 1: Write the StatusPill component**

Create file with content:

```jsx
import { cn } from '../../../lib/cn.js';

/**
 * StatusPill — terminal-style enum status display.
 *
 * Maps known status values to color tone + uppercase label. Unknown
 * status values fall through to a neutral pill with the raw value
 * uppercased.
 *
 * Props:
 *   status: string (e.g. "pending", "approved", "ib_verified")
 *   className: extra classes
 */

const STATUS_MAP = {
  pending: { tone: 'warning', label: 'PENDING' },
  pending_review: { tone: 'warning', label: 'PENDING_REVIEW' },
  approved: { tone: 'success', label: 'APPROVED' },
  rejected: { tone: 'danger', label: 'REJECTED' },
  cancelled: { tone: 'muted', label: 'CANCELLED' },
  expired: { tone: 'muted', label: 'EXPIRED' },
  verified: { tone: 'success', label: 'VERIFIED' },
  failed: { tone: 'danger', label: 'FAILED' },
  removed: { tone: 'muted', label: 'REMOVED' },
  active: { tone: 'success', label: 'ACTIVE' },
  inactive: { tone: 'muted', label: 'INACTIVE' },
  ok: { tone: 'success', label: 'OK' },
  error: { tone: 'danger', label: 'ERROR' }
};

const TONE_STYLES = {
  warning: 'bg-warning text-warning-fg',
  success: 'bg-success text-success-fg',
  danger: 'bg-danger text-danger-fg',
  muted: 'bg-surface-2 text-muted-fg ring-1 ring-inset ring-border',
  primary: 'bg-primary text-primary-fg'
};

export function StatusPill({ status, className }) {
  const meta = STATUS_MAP[status] || {
    tone: 'muted',
    label: String(status || 'UNKNOWN').toUpperCase()
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase leading-tight',
        TONE_STYLES[meta.tone] || TONE_STYLES.muted,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
```

- [ ] **Step 2: Build to verify**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/brutalist/StatusPill.jsx
git commit -m "web-admin: add StatusPill brutalist component"
```

---

## Task 7: Create KPIBlock component

**Files:**
- Create: `web-admin/src/components/ui/brutalist/KPIBlock.jsx`

- [ ] **Step 1: Write the KPIBlock component**

Create file with content:

```jsx
import { cn } from '../../../lib/cn.js';

/**
 * KPIBlock — block-heavy metric display.
 *
 * Renders a label, dominant value, and optional delta. Tone determines
 * background + text colors. Used on dashboard pages where we want a
 * single number to dominate visual hierarchy.
 *
 * Props:
 *   label:  small uppercase mono label, e.g. "PENDING REVIEW"
 *   value:  the dominant number/string, e.g. "03" or "IDR 2.4M"
 *   delta:  optional secondary line, e.g. "+1 LAST 1H"
 *   tone:   "primary" | "muted" | "success" | "warning" | "danger" (default "muted")
 *   size:   "md" | "lg" (default "md")
 *   className: extra classes
 */

const TONE_STYLES = {
  primary: {
    container: 'bg-primary text-primary-fg',
    label: 'text-primary-fg/65',
    delta: 'text-primary-fg/70'
  },
  muted: {
    container: 'bg-surface text-fg ring-1 ring-inset ring-border',
    label: 'text-muted-fg',
    delta: 'text-fg-muted'
  },
  success: {
    container: 'bg-success text-success-fg',
    label: 'text-success-fg/65',
    delta: 'text-success-fg/75'
  },
  warning: {
    container: 'bg-warning text-warning-fg',
    label: 'text-warning-fg/65',
    delta: 'text-warning-fg/75'
  },
  danger: {
    container: 'bg-danger text-danger-fg',
    label: 'text-danger-fg/65',
    delta: 'text-danger-fg/75'
  }
};

const SIZE_STYLES = {
  md: { value: 'text-4xl', wrapper: 'p-3' },
  lg: { value: 'text-5xl', wrapper: 'p-4' }
};

export function KPIBlock({
  label,
  value,
  delta,
  tone = 'muted',
  size = 'md',
  className
}) {
  const t = TONE_STYLES[tone] || TONE_STYLES.muted;
  const s = SIZE_STYLES[size] || SIZE_STYLES.md;
  return (
    <div className={cn(s.wrapper, t.container, className)}>
      {label ? (
        <div className={cn('font-mono text-[9px] font-bold uppercase tracking-[0.15em]', t.label)}>
          {label}
        </div>
      ) : null}
      <div className={cn('font-display font-black leading-none tracking-tight mt-1', s.value)}>
        {value}
      </div>
      {delta ? (
        <div className={cn('font-mono text-[10px] tracking-wider mt-1.5', t.delta)}>
          {delta}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/brutalist/KPIBlock.jsx
git commit -m "web-admin: add KPIBlock brutalist component"
```

---

## Task 8: Create CommandBar component

**Files:**
- Create: `web-admin/src/components/ui/brutalist/CommandBar.jsx`

- [ ] **Step 1: Write the CommandBar component**

Create file with content:

```jsx
import { cn } from '../../../lib/cn.js';

/**
 * CommandBar — slash-prompt action bar.
 *
 * Renders a mono prompt label and inline children (typically Buttons).
 * Used as bottom action bar in detail pages and modal footers when we
 * want a "terminal command" feel rather than a regular toolbar.
 *
 * Props:
 *   prompt: leading prompt label, e.g. "ops $", "ib $"
 *   children: action elements
 *   className: extra classes
 */
export function CommandBar({ prompt = 'ops $', children, className }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 border-y border-border bg-surface-2 px-4 py-2.5',
        className
      )}
    >
      <span
        className="font-mono text-xs tracking-wider text-primary"
        aria-hidden="true"
      >
        {prompt}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/brutalist/CommandBar.jsx
git commit -m "web-admin: add CommandBar brutalist component"
```

---

## Task 9: Create MonoTable + index barrel

**Files:**
- Create: `web-admin/src/components/ui/brutalist/MonoTable.jsx`
- Create: `web-admin/src/components/ui/brutalist/index.js`

- [ ] **Step 1: Write MonoTable.jsx**

This is a thin re-export wrapper around the existing DataTable that defaults to the brutalist mono header look. Since the underlying Table component will be re-skinned in Task 14 to use mono headers by default, MonoTable acts mainly as a semantic alias for clarity in pages that want to be explicit. Create file with content:

```jsx
import { DataTable as BaseDataTable, THead, TBody, TR, TH, TD, TableLoading, TableEmpty } from '../Table.jsx';

/**
 * MonoTable — alias for DataTable with the brutalist mono header look.
 *
 * After the Table component is re-skinned for the Brutalist redesign,
 * MonoTable behaves identically to DataTable. Existing pages can keep
 * importing DataTable; new pages or pages that want to be explicit
 * about the brutalist intent can import MonoTable.
 *
 * Props match DataTable.
 */
export function MonoTable(props) {
  return <BaseDataTable {...props} />;
}

export { THead, TBody, TR, TH, TD, TableLoading, TableEmpty };
```

- [ ] **Step 2: Write index.js barrel**

Create file with content:

```js
export { HazardStripe } from './HazardStripe.jsx';
export { StatusPill } from './StatusPill.jsx';
export { KPIBlock } from './KPIBlock.jsx';
export { CommandBar } from './CommandBar.jsx';
export {
  MonoTable,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableLoading,
  TableEmpty
} from './MonoTable.jsx';
```

- [ ] **Step 3: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 4: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/brutalist/MonoTable.jsx web-admin/src/components/ui/brutalist/index.js
git commit -m "web-admin: add MonoTable + brutalist barrel export"
```

---

## Task 10: Re-skin Button component

**Files:**
- Modify: `web-admin/src/components/ui/Button.jsx`

- [ ] **Step 1: Replace variant + size styles**

Open `web-admin/src/components/ui/Button.jsx`. Replace the `variantStyles` object (lines 12-25) with:

```jsx
const variantStyles = {
  primary:
    'bg-primary text-primary-fg hover:bg-success hover:text-success-fg active:bg-primary/80 border border-primary',
  secondary:
    'bg-surface-2 text-fg border border-border hover:bg-surface-3 active:bg-surface-3',
  ghost:
    'bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg',
  outline:
    'bg-transparent text-fg border border-border hover:bg-surface-2',
  danger:
    'bg-danger text-danger-fg hover:bg-danger/85 active:bg-danger/70 border border-danger',
  success:
    'bg-success text-success-fg hover:bg-success/85 active:bg-success/70 border border-success'
};
```

Replace `sizeStyles` (lines 27-32) with sharp-corner sizes:

```jsx
const sizeStyles = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  icon: 'h-9 w-9 p-0 gap-0'
};
```

- [ ] **Step 2: Update font-family in className**

In the same file, find the className line inside the rendered `<button>` (line 56-62). Replace `'... font-medium ...'` with `'... font-display font-semibold ...'`:

```jsx
      className={cn(
        'inline-flex items-center justify-center font-display font-semibold transition select-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantStyles[variant] || variantStyles.primary,
        sizeStyles[size] || sizeStyles.md,
        className
      )}
```

- [ ] **Step 3: Update transition to instant for hover (snappy brutalist)**

Replace the `transition select-none` portion of the className with `transition-colors duration-75 select-none` so hover swaps feel instant rather than eased:

```jsx
        'inline-flex items-center justify-center font-display font-semibold transition-colors duration-75 select-none',
```

- [ ] **Step 4: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/Button.jsx
git commit -m "web-admin: re-skin Button (sharp corners, display font, snap hover)"
```

---

## Task 11: Re-skin Input + Select + Textarea + FormField

**Files:**
- Modify: `web-admin/src/components/ui/Input.jsx`

- [ ] **Step 1: Add mono variant prop to Input**

Open `web-admin/src/components/ui/Input.jsx`. Replace the entire `Input` forwardRef (lines 8-40) with:

```jsx
export const Input = forwardRef(function Input(
  { className, type = 'text', leadingIcon: Leading, trailingIcon: Trailing, variant, ...props },
  ref
) {
  const monoCls = variant === 'mono' ? 'font-mono tracking-wide' : '';
  if (Leading || Trailing) {
    return (
      <div className={cn('relative', className)}>
        {Leading ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-muted-fg">
            <Leading className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : null}
        <input
          ref={ref}
          type={type}
          className={cn('input', monoCls, Leading && 'pl-9', Trailing && 'pr-9')}
          {...props}
        />
        {Trailing ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-fg">
            <Trailing className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : null}
      </div>
    );
  }

  return <input ref={ref} type={type} className={cn('input', monoCls, className)} {...props} />;
});
```

- [ ] **Step 2: Update FormField label styling**

In the same file, replace the `FormField` component (lines 61-74) with mono uppercase labels:

```jsx
export function FormField({ label, hint, error, htmlFor, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg"
        >
          {label}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="font-mono text-xs text-muted-fg">{hint}</p> : null}
      {error ? <p className="font-mono text-xs text-danger">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 3: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 4: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/Input.jsx
git commit -m "web-admin: re-skin Input + FormField (mono labels, optional mono variant)"
```

---

## Task 12: Re-skin Card

**Files:**
- Modify: `web-admin/src/components/ui/Card.jsx`

- [ ] **Step 1: Replace Card primitives**

Replace the entire content of `web-admin/src/components/ui/Card.jsx` with:

```jsx
import { cn } from '../../lib/cn.js';

/**
 * Card primitive: brutalist visual container.
 *
 * Default: sharp corners, 1px border, no shadow. Pass `shadow="step"`
 * to render the dropped-offset shadow.
 *
 * Use Card + CardHeader + CardBody + CardFooter for structured panels.
 */
export function Card({ className, children, shadow, ...props }) {
  return (
    <div
      className={cn(
        'bg-surface border border-border',
        shadow === 'step' && 'shadow-step',
        shadow === 'step-lg' && 'shadow-step-lg',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, title, description, action, children }) {
  if (children) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-b border-border px-4 py-3',
          className
        )}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-border px-4 py-3',
        className
      )}
    >
      <div className="space-y-0.5">
        {title ? (
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-fg">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="text-xs text-muted-fg">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('px-4 py-4', className)}>{children}</div>;
}

export function CardFooter({ className, children }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-4 py-3',
        className
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/Card.jsx
git commit -m "web-admin: re-skin Card (sharp corners, optional step shadow, uppercase headers)"
```

---

## Task 13: Re-skin Badge + StatusBadge

**Files:**
- Modify: `web-admin/src/components/ui/Badge.jsx`

- [ ] **Step 1: Replace Badge tones and StatusBadge labels**

Replace the entire content of `web-admin/src/components/ui/Badge.jsx` with:

```jsx
import { cn } from '../../lib/cn.js';

/**
 * Badge — sharp-corner pill for tags, counts, secondary status.
 *
 * For canonical state machine status (transaction.status, ibAccount.status,
 * etc.) prefer `<StatusPill>` from `components/ui/brutalist` which uses
 * uppercase mono and the standard tone mapping.
 */
const tones = {
  neutral: 'bg-surface-2 text-fg-muted border border-border',
  primary: 'bg-primary-soft text-primary border border-primary/30',
  success: 'bg-success-soft text-success border border-success/30',
  warning: 'bg-warning-soft text-warning border border-warning/30',
  danger: 'bg-danger-soft text-danger border border-danger/30',
  info: 'bg-info-soft text-info border border-info/30'
};

export function Badge({ tone = 'neutral', className, children, dot = false }) {
  return (
    <span className={cn('badge', tones[tone] || tones.neutral, className)}>
      {dot ? (
        <span
          className={cn('h-1.5 w-1.5 rounded-full bg-current opacity-90')}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}

const STATUS_TONES = {
  pending: { tone: 'warning', label: 'Menunggu' },
  pending_review: { tone: 'warning', label: 'Menunggu Review' },
  approved: { tone: 'success', label: 'Disetujui' },
  rejected: { tone: 'danger', label: 'Ditolak' },
  cancelled: { tone: 'neutral', label: 'Dibatalkan' },
  expired: { tone: 'neutral', label: 'Kadaluarsa' }
};

export function StatusBadge({ status, className }) {
  const meta = STATUS_TONES[status] || { tone: 'neutral', label: status || 'unknown' };
  return (
    <Badge tone={meta.tone} className={className} dot>
      {meta.label}
    </Badge>
  );
}
```

- [ ] **Step 2: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/Badge.jsx
git commit -m "web-admin: re-skin Badge (sharp corner, hard borders)"
```

---

## Task 14: Re-skin Table primitives

**Files:**
- Modify: `web-admin/src/components/ui/Table.jsx`

- [ ] **Step 1: Replace TH and TR styling**

Open `web-admin/src/components/ui/Table.jsx`. Replace the `THead` (lines 35-41), `TR` (lines 47-53), and `TH` (lines 55-70) functions with:

```jsx
export function THead({ className, children }) {
  return (
    <thead className={cn('bg-surface-2 border-b-2 border-border', className)}>
      {children}
    </thead>
  );
}

export function TR({ className, children, ...props }) {
  return (
    <tr
      className={cn('hover:bg-surface-2 transition-colors duration-75', className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TH({ className, children, align = 'left', ...props }) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}
```

- [ ] **Step 2: Update TD padding to match**

In the same file, replace the `TD` function (lines 72-87) with:

```jsx
export function TD({ className, children, align = 'left', ...props }) {
  return (
    <td
      className={cn(
        'px-4 py-2.5 align-middle text-fg text-sm',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}
```

- [ ] **Step 3: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 4: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/Table.jsx
git commit -m "web-admin: re-skin Table (mono uppercase headers, hairline rows, snap hover)"
```

---

## Task 15: Re-skin Modal

**Files:**
- Modify: `web-admin/src/components/ui/Modal.jsx`

- [ ] **Step 1: Replace Modal styling**

Replace the entire content of `web-admin/src/components/ui/Modal.jsx` with:

```jsx
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { HazardStripe } from './brutalist/HazardStripe.jsx';

/**
 * Accessible modal built on top of Radix Dialog. Brutalist styling:
 * sharp corners, hard borders, optional hazard stripe header for
 * high-attention dialogs.
 *
 * Usage:
 *   <Modal open={open} onOpenChange={setOpen}>
 *     <ModalHeader title="Title" description="..." onClose={...} />
 *     <ModalBody>...</ModalBody>
 *     <ModalFooter>...</ModalFooter>
 *   </Modal>
 */
export function Modal({ open, onOpenChange, children }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-40 backdrop-blur-sm animate-overlay-in"
          style={{ backgroundColor: 'rgb(8 22 28 / 0.85)' }}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[min(96vw,42rem)]',
            '-translate-x-1/2 -translate-y-1/2',
            'border border-border bg-surface shadow-step-lg',
            'animate-modal-in focus:outline-none'
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * ModalHeader. Pass `tone="warning"` or `tone="danger"` to render a
 * hazard stripe at the top edge for high-attention dialogs.
 */
export function ModalHeader({ title, description, onClose, tone }) {
  const stripe = tone === 'warning' || tone === 'danger' ? tone : null;
  return (
    <>
      {stripe ? <HazardStripe color={stripe} height={4} density={10} /> : null}
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div className="space-y-0.5">
          {title ? (
            <DialogPrimitive.Title className="font-display text-base font-bold uppercase tracking-wider text-fg">
              {title}
            </DialogPrimitive.Title>
          ) : null}
          {description ? (
            <DialogPrimitive.Description className="text-xs text-muted-fg">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-fg hover:bg-surface-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </>
  );
}

export function ModalBody({ className, children }) {
  return <div className={cn('px-4 py-4 space-y-4', className)}>{children}</div>;
}

export function ModalFooter({ className, children }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2 px-4 py-3',
        className
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/Modal.jsx
git commit -m "web-admin: re-skin Modal (sharp corners, hazard stripe option, navy backdrop)"
```

---

## Task 16: Re-skin Toast

**Files:**
- Modify: `web-admin/src/components/ui/Toast.jsx`

- [ ] **Step 1: Reposition viewport top-right + sharp corners**

Open `web-admin/src/components/ui/Toast.jsx`. Replace the `ToastViewport` function (lines 108-166) with:

```jsx
function ToastViewport({ toasts, dismiss }) {
  return (
    <div
      className="pointer-events-none fixed top-16 right-4 z-[60] flex w-[min(95vw,22rem)] flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const cfg = variantConfig[t.variant] || variantConfig.default;
        const Icon = cfg.icon;
        const toneLabel = t.variant === 'default' ? 'INFO' : t.variant.toUpperCase();
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-stretch gap-0 border border-border bg-surface shadow-step',
              'animate-in'
            )}
          >
            <div
              className={cn(
                'flex w-10 shrink-0 items-center justify-center',
                cfg.tile
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0 px-3 py-2.5">
              <div className={cn('font-mono text-[9px] font-bold uppercase tracking-[0.15em]', cfg.accent)}>
                {toneLabel}
              </div>
              <div className="text-sm font-semibold text-fg leading-tight mt-0.5">{t.title}</div>
              {t.description ? (
                <div className="mt-0.5 text-xs text-muted-fg break-words">{t.description}</div>
              ) : null}
              {t.actionLabel ? (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      t.onAction?.();
                    } finally {
                      dismiss(t.id);
                    }
                  }}
                  className={cn(
                    'mt-2 inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-wider hover:underline',
                    cfg.accent
                  )}
                >
                  {t.actionLabel}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="flex w-8 shrink-0 items-center justify-center text-muted-fg hover:bg-surface-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Update variantConfig with tile bg colors**

In the same file, replace the `variantConfig` object (lines 17-43) with:

```jsx
const variantConfig = {
  default: {
    icon: Info,
    accent: 'text-info',
    tile: 'bg-info text-info-fg'
  },
  success: {
    icon: CheckCircle2,
    accent: 'text-success',
    tile: 'bg-success text-success-fg'
  },
  error: {
    icon: XCircle,
    accent: 'text-danger',
    tile: 'bg-danger text-danger-fg'
  },
  warning: {
    icon: AlertTriangle,
    accent: 'text-warning',
    tile: 'bg-warning text-warning-fg'
  },
  info: {
    icon: Info,
    accent: 'text-info',
    tile: 'bg-info text-info-fg'
  }
};
```

- [ ] **Step 3: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 4: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/Toast.jsx
git commit -m "web-admin: re-skin Toast (top-right, color tile, mono uppercase tone label)"
```

---

## Task 17: Re-skin Tooltip

**Files:**
- Modify: `web-admin/src/components/ui/Tooltip.jsx`

- [ ] **Step 1: Replace TooltipContent styling**

Open `web-admin/src/components/ui/Tooltip.jsx`. Replace the `Tooltip` export (lines 17-35) with:

```jsx
export function Tooltip({ content, children, side = 'top', align = 'center', className }) {
  if (!content) return children;
  return (
    <TooltipPrimitive>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={6}
        className={cn(
          'z-[70] border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg shadow-step',
          'animate-in',
          className
        )}
      >
        {content}
      </TooltipContent>
    </TooltipPrimitive>
  );
}
```

- [ ] **Step 2: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/Tooltip.jsx
git commit -m "web-admin: re-skin Tooltip (mono font, sharp corners, step shadow)"
```

---

## Task 18: Re-skin PageHeader

**Files:**
- Modify: `web-admin/src/components/ui/PageHeader.jsx`

- [ ] **Step 1: Replace with brutalist heading**

Replace the entire content of `web-admin/src/components/ui/PageHeader.jsx` with:

```jsx
import { cn } from '../../lib/cn.js';
import { HazardStripe } from './brutalist/HazardStripe.jsx';

/**
 * PageHeader — block-heavy page heading.
 *
 * Title in display font, weight 900, letter-spacing tight. Optional
 * `accent` prop renders a hazard stripe under the title row for
 * high-attention pages.
 *
 * Props:
 *   title:       string
 *   description: string
 *   actions:     React node, right-aligned
 *   accent:      "primary" | "warning" | "danger" | "success" — adds hazard stripe
 *   className:   extra classes
 */
export function PageHeader({ title, description, actions, accent, className }) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-fg leading-none">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-muted-fg max-w-2xl">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {accent ? <HazardStripe color={accent} height={4} density={10} /> : null}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/PageHeader.jsx
git commit -m "web-admin: re-skin PageHeader (display 900, optional hazard accent)"
```

---

## Task 19: Re-skin Skeleton

**Files:**
- Modify: `web-admin/src/components/ui/Skeleton.jsx`

- [ ] **Step 1: Replace SkeletonCard to drop rounded class**

Open `web-admin/src/components/ui/Skeleton.jsx`. Replace `SkeletonCard` (lines 31-39) with:

```jsx
export function SkeletonCard({ className }) {
  return (
    <div className={cn('bg-surface border border-border p-5 space-y-3', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}
```

(`Skeleton` and `SkeletonText` and `SkeletonRow` already use `.skeleton` utility which now renders sharp corners since we updated `index.css`. No changes needed.)

- [ ] **Step 2: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/ui/Skeleton.jsx
git commit -m "web-admin: re-skin SkeletonCard (sharp corners, brutalist surface)"
```

---

## Task 20: Rework Layout — sidebar header + nav styling

**Files:**
- Modify: `web-admin/src/components/Layout.jsx`

- [ ] **Step 1: Add HazardStripe to top of layout**

Open `web-admin/src/components/Layout.jsx`. At the top of the file, add the import after the existing `Button` import:

```jsx
import { HazardStripe } from './ui/brutalist/HazardStripe.jsx';
```

- [ ] **Step 2: Insert HazardStripe at the very top of the page wrapper**

Find the `return (` of the default `Layout` export (currently around line 105 with `<div className="min-h-screen bg-bg text-fg">`). Insert a HazardStripe as the first child of that wrapper:

```jsx
  return (
    <div className="min-h-screen bg-bg text-fg">
      <HazardStripe height={4} density={10} className="fixed top-0 left-0 right-0 z-40" />
      {/* Sidebar (desktop) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:flex lg:flex-col',
          'transition-colors'
        )}
      >
        <SidebarContent isAdmin={isAdmin} />
      </aside>
      {/* ... rest unchanged ... */}
```

(The 4px stripe is fixed-positioned at top, behind the topbar. Topbar already has `sticky top-0 z-20` so it sits below the stripe visually.)

- [ ] **Step 3: Replace SidebarContent header**

Find the `SidebarContent` function. Replace the header block (currently the `<div className="flex items-center gap-3 border-b border-border px-4 py-4">...</div>` at the top) with:

```jsx
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-fg font-display font-black text-base">
            Q
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-bold uppercase tracking-wider text-fg leading-tight">
              QTASSIST
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-fg leading-tight">
              {isAdmin ? 'admin · ops desk' : 'user · daftar ib'}
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 4: Replace nav section labels and link styling**

Inside the same `SidebarContent` function, replace the entire `<nav>` block with:

```jsx
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="px-3 pb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-fg">
              § {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => onNavigate?.()}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-2.5 px-3 py-2 text-sm font-mono uppercase tracking-wider transition-colors duration-75',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                          isActive
                            ? 'bg-primary text-primary-fg'
                            : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                        )
                      }
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate text-[11px]">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
```

- [ ] **Step 5: Replace sidebar footer**

In the same function, replace the footer block (the `<div className="border-t border-border p-3 text-[10px] text-muted-fg">QTrades · v1</div>`) with:

```jsx
      <div className="border-t border-border px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-fg space-y-0.5">
        <div className="flex items-center justify-between">
          <span>system</span>
          <span className="text-primary">v1.0.0</span>
        </div>
        <div className="flex items-center justify-between">
          <span>build</span>
          <span>{import.meta.env.MODE}</span>
        </div>
      </div>
```

- [ ] **Step 6: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 7: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/Layout.jsx
git commit -m "web-admin: rework Layout sidebar (mono nav, brand block, hazard stripe top, system footer)"
```

---

## Task 21: Rework Layout — topbar styling

**Files:**
- Modify: `web-admin/src/components/Layout.jsx`

- [ ] **Step 1: Replace user dropdown trigger to brutalist Q-block**

In `Layout.jsx`, find the `Topbar` function. Replace the `<DropdownMenu.Trigger asChild>` block (the button with the avatar circle, currently around lines 300-310) with:

```jsx
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 border border-border bg-surface px-3 py-1.5 text-sm text-fg hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <div className="flex h-6 w-6 items-center justify-center bg-primary text-primary-fg font-display font-black text-xs">
                {user?.username?.[0]?.toUpperCase() || 'Q'}
              </div>
              <span className="hidden sm:inline font-mono text-xs uppercase tracking-wider">
                {user?.globalName || user?.username || 'user'}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-fg" />
            </button>
          </DropdownMenu.Trigger>
```

- [ ] **Step 2: Update DropdownMenu.Content styling**

In the same function, replace the `<DropdownMenu.Content ...>` className (currently uses `rounded-lg`) with sharp corners and step shadow:

```jsx
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className={cn(
                'z-30 min-w-[12rem] border border-border bg-surface p-1 shadow-step',
                'animate-in'
              )}
            >
```

- [ ] **Step 3: Restyle dropdown contents**

Inside that `Content`, replace the inner blocks with mono-styled labels:

```jsx
              <div className="px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-fg">
                {isAdmin ? 'admin' : 'user'} · <span className="font-bold text-fg">{user?.username}</span>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
                className="flex cursor-pointer items-center gap-2 px-2 py-1.5 font-mono text-xs uppercase tracking-wider text-fg outline-none hover:bg-surface-2 focus:bg-surface-2"
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </DropdownMenu.Item>
```

- [ ] **Step 4: Restyle topbar utility buttons**

In the same Topbar function, the realtime indicator, notification toggle, and theme toggle are wrapped in icon buttons that already use `rounded-lg`. With the global Tailwind override making rounded a no-op these will already render sharp. Keep the existing classNames as-is — no changes needed.

Verify no `rounded-md` or `rounded-lg` clashes by reading the Topbar render output mentally. Expected: no visual artifacts.

- [ ] **Step 5: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 6: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/Layout.jsx
git commit -m "web-admin: rework Layout topbar (Q-block trigger, mono labels, sharp dropdown)"
```

---

## Task 22: Audit charts component for dark-bg readability

**Files:**
- Read: `web-admin/src/components/charts/*`
- Modify: chart files only IF colors are unreadable on the new dark navy bg

- [ ] **Step 1: List existing chart files**

```powershell
Get-ChildItem -Path web-admin\src\components\charts -Recurse -File | Select-Object Name
```

Capture the output. Each file is a recharts wrapper.

- [ ] **Step 2: Inspect chart color usage**

For each `.jsx` file in the charts directory, read it and look for hard-coded `fill=`, `stroke=`, or hex color string literals. Make a list of which charts use which colors.

```powershell
Select-String -Path web-admin\src\components\charts\*.jsx -Pattern "(fill|stroke)=|#[0-9a-fA-F]{3,6}" | Select-Object Path, Line
```

- [ ] **Step 3: Decide patches**

For each color found, judge by eye whether the color reads OK on `#08161c` background:
- Indigo / blue near-black: bad. Patch to `rgb(var(--primary))` (teal).
- Light gray / slate-300: OK as label text.
- Indigo gradient: replace with primary gradient.

If a color reads poorly, patch the chart file to use a CSS variable: `fill="rgb(var(--primary))"`. If it reads OK, leave it.

- [ ] **Step 4: Build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`.

- [ ] **Step 5: Smoke test by visiting Dashboard page**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run dev
```

Open `http://localhost:5173/`, log in as admin (Discord OAuth — needs running bot). Visit dashboard. Charts should be visible against the navy bg. Stop dev server with Ctrl+C.

If you can't log in (bot not running locally), skip this smoke check and rely on Step 4's build pass plus visual review during the next deploy.

- [ ] **Step 6: Commit**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git add web-admin/src/components/charts
git commit -m "web-admin: patch chart colors for navy dark-mode readability"
```

If no patches were needed, skip the commit and document that fact in the next task's notes.

---

## Task 23: Final smoke + visual regression check

**Files:**
- No modifications. Manual verification across pages.

- [ ] **Step 1: Run final production build**

```powershell
cd C:\Users\USER\gt\new\qtassist5251\web-admin
npm run build
```

Expected: `? built in Ns`. Bundle sizes printed. Note them down for later comparison.

- [ ] **Step 2: Verify CSS bundle contains new tokens**

```powershell
Select-String -Path dist\assets\index-*.css -Pattern "8 22 28|45 212 191|Space Grotesk|JetBrains Mono"
```

Expected: at least 4 matching lines (one per pattern).

- [ ] **Step 3: Run dev server and visit each page manually**

```powershell
npm run dev
```

Open http://localhost:5173/. Login as admin (requires running bot to satisfy Discord OAuth). For each route below, navigate and verify:
- No unstyled elements / white flashes
- No layout broken by sharp corners
- StatusBadge appears with brutalist tone (warning/success/danger blocks)
- Tables show mono uppercase headers
- Modals open with sharp corners and navy backdrop

Routes to check:
- `/` (Dashboard) — KPI metrics, recent transactions
- `/transactions` — list + approve modal
- `/temproles` — list + extend modal
- `/products` — CRUD form
- `/users` — search + detail
- `/audit` — log table with date filter
- `/discord-post` — embed builder
- `/bot-status` — cron status panel
- `/backups` — backup list + manual trigger
- `/ib-settings` — config form (cookie field)
- `/ib-accounts` — list + reverify modal
- `/admin-roles` — picker modal
- `/daftar-ib` — user-facing IB submission

Note any visual issue (page-specific inline style fighting tokens, etc.) as TODOs for Phase 3 polish. Do NOT fix in this iteration unless the page is unusable.

- [ ] **Step 4: Verify keyboard nav focus rings**

In dev server, Tab through Login page. Tab through a Modal once open. Focus rings must be visible (2px teal outline + offset).

- [ ] **Step 5: Verify reduced-motion preference**

In Chrome DevTools, open Rendering tab ? "Emulate CSS media feature prefers-reduced-motion" ? "reduce". Reload page. Modal opens should be instant (no slide-up). Skeleton shimmer should be still.

- [ ] **Step 6: Verify Toast renders top-right with mono tone label**

In dev server, trigger a toast (e.g., approve a transaction in a fixture, or temporarily call `toast.success('Test')` from console). Toast appears top-right with tile + mono uppercase tone label like `SUCCESS`.

- [ ] **Step 7: Stop dev server**

Ctrl+C in the terminal running `npm run dev`.

- [ ] **Step 8: Final commit**

If any chart patches or page-specific inline-style fixes were made during smoke testing, commit them now:

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git status
```

If anything is staged or unstaged from this task that wasn't already committed:

```powershell
git add web-admin/src
git commit -m "web-admin: smoke-test fixes for brutalist redesign Phase 1"
```

Otherwise no commit needed.

- [ ] **Step 9: Push branch**

```powershell
cd C:\Users\USER\gt\new\qtassist5251
git status
git log --oneline -25
```

Verify all tasks landed. Push:

```powershell
git push origin main
```

(If working on a feature branch, replace `main` with the branch name. If `git push` fails because branch is not tracking remote, use `git push -u origin <branch>`.)

---

## Self-Review Notes

**Spec coverage:**
- ? Color tokens (Task 2) — all 23 tokens from spec
- ? Typography (Task 2 step 3-4) — Space Grotesk + JetBrains Mono via @fontsource
- ? Component re-skin (Tasks 10-19) — all 10 primitives covered
- ? Brutalist components (Tasks 5-9) — all 5 components from spec
- ? Layout rework (Tasks 20-21) — sidebar + topbar
- ? Dark default (Task 4) — index.html + theme.jsx
- ? Light variant fallback — preserved in :root (Task 2 step 1)
- ? Bahasa convention — StatusPill (Task 6) uses EN uppercase, StatusBadge (Task 13) keeps Indonesian; pages can choose. Sidebar nav, FormField labels, Modal titles untouched (still Indonesian as currently coded).
- ? Charts audit (Task 22)
- ? Smoke test (Task 23)

**Placeholder scan:**
- Task 22 step 3: "judge by eye whether the color reads OK". This is intentionally judgment-based because the actual chart files weren't pre-audited; the engineer has to make a call per color. Not a placeholder — the criterion is concrete (readability on `#08161c`).
- Task 23 step 3: "Note any visual issue ... as TODOs for Phase 3 polish". Concrete instruction; not a placeholder.

**Type consistency:**
- `<HazardStripe>` used in Modal (Task 15) and PageHeader (Task 18) and Layout (Task 20). All callers pass `color`, `height`, `density` — props match Task 5 definition.
- `<StatusPill>` (Task 6) is independent; not used by other components in this plan. Pages can adopt it later.
- `<KPIBlock>`, `<CommandBar>`, `<MonoTable>` — defined and exported via `index.js` (Task 9). Not consumed in this plan; available for Phase 3.

**Out-of-scope reminder:**
- Pages in `web-admin/src/pages/*.jsx` are NOT touched. They consume the re-skinned primitives automatically. If a page has a hard-coded `rounded-lg` or `bg-indigo-600` in inline styles, it will still render but may look slightly inconsistent. Document and defer to Phase 3.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-16-brutalist-redesign.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for catching issues early when each task is small.

**2. Inline Execution** — Execute tasks in this session using executing-plans. Batch execution with checkpoints for review.

Which approach?
