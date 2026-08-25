# UI/UX Specification
## SETU Registry — Centralised CCTV Registry & GIS Foundation

**Version:** 1.0
**Companion document to:** PRD_SETU_Registry.md
**Purpose:** This document defines the exact visual language, layout rules, and interaction patterns for the build. Follow it precisely — do not substitute your own default styling, component library defaults, or "modern SaaS" visual clichés.

---

## 1. Design Intent (read this first)

This is **internal government operations software**, used daily by police and department officers to track physical infrastructure. It is not a startup landing page, not a marketing site, and not a consumer app. The tone should read as:

- **Functional and plain**, like a municipal records system or a logistics dashboard — closer to something like a hospital admin panel, an airline ops board, or a utility company's asset management tool.
- **Data-dense but organised**, not sparse or "airy." Officers need to see numbers and status at a glance, not scroll through generous whitespace.
- **Boring on purpose.** Nothing should animate, glow, or draw attention to itself unless it is communicating a real status change (e.g., a camera going offline).

### Explicitly avoid these patterns (common "AI-generated" tells)
- Do **not** use a warm cream/off-white background with a large serif display headline and a terracotta/orange accent color. This is a generic AI-design default — avoid it entirely.
- Do **not** use a near-black background with a single neon/acid-green or violet glow accent.
- Do **not** add gradient backgrounds, glassmorphism/blur panels, floating cards with heavy drop shadows, or animated gradient blobs.
- Do **not** use rounded pill-shaped buttons everywhere, oversized hero sections, or large centered marketing-style headlines.
- Do **not** use emoji as icons or section markers.
- Do **not** add motion/animation beyond simple hover states and status-change transitions (no page-load animations, no scroll-triggered reveals, no bouncing/pulsing decorative elements).
- Do **not** invent a numbered-step design (01 / 02 / 03) unless the content is genuinely sequential (it is not, here).

If in doubt, favour the plainer, more utilitarian choice over the more decorative one.

## 2. Visual System

### 2.1 Colour palette

Use a **light, plain, low-saturation palette** — this is a departure from "dark mode dashboard" defaults, and is deliberately chosen to read as an official/government tool rather than a tech startup product.

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#F4F5F7` | Page background |
| `--surface` | `#FFFFFF` | Cards, panels, table backgrounds |
| `--surface-alt` | `#EEF0F3` | Subtle section dividers, table header background |
| `--border` | `#D8DCE2` | All borders, dividers |
| `--text-primary` | `#1E2530` | Body text, headings |
| `--text-secondary` | `#5C6675` | Labels, captions, muted text |
| `--text-tertiary` | `#8A93A3` | Placeholder text, disabled state |
| `--accent` | `#245C8C` | Primary actions, links, active nav state (a plain administrative blue — not a bright SaaS blue) |
| `--accent-hover` | `#1B4A72` | Hover state for accent elements |
| `--status-online` | `#2E7D5B` | Status: online/success (muted green, not neon) |
| `--status-warning` | `#B5792B` | Status: maintenance/warning (muted amber/ochre) |
| `--status-offline` | `#A23B33` | Status: offline/critical (muted brick red) |

Do not use pure black (`#000`) or pure white (`#FFF`) as primary text/background — use the tokens above, which are softened.

### 2.2 Typography

Use **system-native / plain UI fonts** — not a "characterful" display face. This should look like enterprise software, not a brand site.

- **Primary UI font:** `Inter` or, failing that, the OS system font stack (`-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`).
- **Monospace (for IDs, coordinates, timestamps, table data that benefits from alignment):** `"IBM Plex Mono"`, `"Roboto Mono"`, or `ui-monospace`.
- Do **not** use a serif display font anywhere.
- Font weights: use only 400 (regular), 500 (medium), and 600 (semibold). Avoid 700+/black weights except possibly for the single largest stat number on the dashboard.
- Base body size: 14px. Table/dense data: 13px. Section headings: 15–16px, semibold, not oversized.

### 2.3 Spacing & layout grid

- Base spacing unit: 4px. Use multiples of 4 (4, 8, 12, 16, 20, 24, 32) consistently.
- Keep padding inside cards/panels modest (12–16px), not the generous 32px+ padding typical of marketing sites.
- Border radius: small and consistent — **4px** for buttons, inputs, and cards. Do not use large rounded corners (12px+) or fully pill-shaped buttons.
- Borders over shadows: prefer a 1px `--border` line to separate sections/cards rather than drop shadows. Use shadow only sparingly for modals/popovers (a small, tight shadow — not a large soft glow).

### 2.4 Iconography

- Use a plain, single-weight line-icon set (e.g., Lucide, Feather, or Heroicons outline) at a consistent stroke width (1.5–2px).
- Icons are functional labels, not decoration — every icon should be paired with a text label in navigation (no icon-only nav items).

## 3. Layout Structure

### 3.1 App shell (applies to every page)

```
┌─────────────┬──────────────────────────────────────────┐
│   Logo /    │   Top bar: page title + live stat strip    │
│   Org name  │   + primary action button + user menu      │
├─────────────┼──────────────────────────────────────────┤
│             │                                            │
│  Left nav   │              Main content area              │
│  (fixed,    │              (scrollable)                   │
│  ~220px)    │                                            │
│             │                                            │
└─────────────┴──────────────────────────────────────────┘
```

- Left navigation is fixed-width (~220px), always visible on desktop, collapses to a hamburger/off-canvas menu below 900px.
- Nav items grouped under plain section labels: **Overview**, **Registry**, **System** (matches the site's actual information architecture — do not invent extra groupings).
- Active nav item: a **left border accent** (3px, `--accent` colour) plus a slightly darker background (`--surface-alt`). No glow, no icon color change beyond a subtle darkening.
- Top bar stays consistent across all pages: shows a compact live stat strip (numbers only, small labels beneath, separated by thin vertical dividers) — not large stat cards.

### 3.2 Pages required (match PRD Section 7)

1. **GIS Dashboard** — map (left/main) + summary panel (right): gap alerts, department breakdown, recent activity.
2. **Camera Registry** — full-width data table with filter bar above it, row-click detail panel.
3. **Onboarding Queue** — status-grouped list (Pending / Validation / Approved / Rejected) with an "Add Camera" action opening the onboarding form.
4. **Gap Analysis** — list of gap cards + optional small district map/heatmap.
5. **Departments** — grid or list of department summary cards, click-through to filtered registry.
6. **Health Monitor** — flagged-camera list + a simple trend chart (plain line/bar, no 3D or decorative chart styling).
7. **Audit Trail** — plain chronological table, filterable.
8. **Registry API** — documentation layout: left-side endpoint list, right-side detail with sample request/response in monospace code blocks.
9. **Settings** — form-based layout: role list, user table, system preference fields.

### 3.3 Data tables (used across Registry, Audit Trail, Onboarding Queue)

- Sticky header row, `--surface-alt` background, uppercase small labels (11px, letterspaced slightly), `--text-secondary` colour.
- Row height: compact (36–40px), not the generously padded rows typical of consumer apps.
- Zebra striping is optional; a 1px bottom border on each row is sufficient and preferred for a plainer feel.
- Status shown as a small coloured dot + text label (not a large pill/badge) — e.g. `● Online` in `--status-online` colour, plain text weight.
- Sort indicators: simple up/down chevron on column header click, no animation.

### 3.4 Forms (Onboarding, Settings)

- Standard vertical form layout, label above input, 1 or 2 fields per row maximum.
- Inputs: 1px border (`--border`), 4px radius, `--surface` background, `--accent` border on focus (no glow/shadow on focus — just the border colour change).
- Primary action button: solid `--accent` background, white text, 4px radius, no icon unless functionally necessary (e.g., an upload icon on the CSV upload button).
- Secondary/cancel button: outline style, `--border` colour border, `--text-primary` text, transparent background.

### 3.5 Map (GIS Dashboard, Gap Analysis)

- Use a **plain, light-toned map tile layer** (e.g., CartoDB Positron / OpenStreetMap standard) — not a dark/night map style, to stay consistent with the overall light, plain theme.
- Markers: small circular dots colour-coded by status (same status colours as tables). No pulsing/glow animation on markers — a plain filled circle with a thin white border is sufficient to make it legible against the map.
- Marker popups: plain white card, 1px border, no shadow beyond a minimal 2px soft shadow for legibility above the map.

## 4. Interaction Rules

- **Loading states**: simple text ("Loading…") or a plain spinner — no skeleton shimmer animations required, though a simple grey skeleton block is acceptable if it doesn't animate/shimmer.
- **Empty states**: plain text explaining what's missing and the action to take (e.g., "No cameras match these filters. Try adjusting department or status."). No illustrations.
- **Confirmations**: destructive actions (delete, reject) require a plain confirm dialog — a simple modal with the action restated in plain language, not a toast-only confirmation.
- **Transitions**: keep all transitions under 150ms and limited to opacity/colour changes. No slide-in panels with easing curves longer than that, no bounce/spring physics.
- **Responsiveness**: must work down to tablet width (≥768px) at minimum for this submission. Mobile is a bonus, not required, given this is an internal ops tool typically used on desktop/tablet in a control room or field setting.

## 5. Content & Copy Style

- Write labels and messages in **plain, direct language** — describe what the system does, not what it "empowers" the user to do. E.g., "Add camera" not "Effortlessly onboard your infrastructure."
- No marketing language anywhere in the product (no "seamless," "powerful," "next-generation," etc.)
- Error messages state what happened and what to do next, plainly: "Row 14 rejected: latitude out of range. Expected -90 to 90." — not vague ("Something went wrong").
- Button labels are verbs describing the exact action: "Add Camera," "Approve," "Reject," "Export CSV" — not generic labels like "Submit" or "Go."

## 6. What "Done" Looks Like

A developer or AI coding agent should be able to look at any two pages of the finished product and immediately tell they belong to the same, deliberately plain internal tool — consistent typography, consistent status colours, consistent table and form patterns — with **no page** looking like a generated landing page, a dark "hacker" dashboard, or a consumer SaaS product demo.
