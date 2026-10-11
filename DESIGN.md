---
name: Kindera
description: Corporate volunteering, NGO partnerships and impact tracking in one shared, well-kept place.
colors:
  evergreen: "#0d3b26"
  pine: "#1a5c3a"
  fern: "#2e7d52"
  morning-mist: "#f0f7f3"
  paper: "#fafafa"
  surface: "#ffffff"
  ink: "#111827"
  ink-secondary: "#4b5563"
  ink-muted: "#6b7280"
  hairline: "#e5e7eb"
  signal-red: "#dc2626"
  navy: "#0A1A3B"
  navy-strong: "#1a2d59"
  certificate-lime: "#76A854"
  data-blue: "#3d5a99"
  data-indigo: "#6366f1"
  alert-rose: "#e11d48"
  header-ink: "#2c2c2c"
  header-ink-strong: "#1a1a1a"
typography:
  display:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "clamp(3rem, 7vw, 5.5rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.08em"
  nav-label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1
  menu-item:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.3
  field-mobile:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
  signature:
    fontFamily: "Great Vibes, cursive"
    fontSize: "3rem"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.evergreen}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.pine}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-cta-pill:
    backgroundColor: "{colors.evergreen}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "16px 40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "24px"
  chip-status:
    backgroundColor: "{colors.morning-mist}"
    textColor: "{colors.evergreen}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

# Design System: Kindera

## Overview

**Creative North Star: "The Evergreen Commons"**

Kindera is a shared, well-kept place where companies, NGOs and volunteers meet to get good work done. The interface behaves like a well-run community garden: calm, dependable and welcoming, with one deep forest green that signals "this is Kindera" and lots of quiet, warm off-white around it. Nothing shouts. Trust comes from consistency and legibility, not from spectacle.

Two registers share one palette. The public marketing pages (home, partners) are allowed a voice: large DM Serif Display headlines, full-bleed Evergreen sections, photography of real volunteering, and one authored motion moment (the opportunities carousel). The signed-in product (admin Control Centre, dashboards, attendance, reports, messages) is an operating tool: Inter throughout, dense tables, white cards on paper, and the green reserved for actions, current selection and brand marks.

**Key Characteristics:**
- One brand hue (Evergreen) carries identity, with Pine and Fern as its states and supports.
- Warm paper background with white surfaces on top. Depth comes from soft shadows, not borders alone.
- Serif display type only on marketing surfaces. The product UI is all Inter.
- Generous rounding (12–24px on containers, pills for primary marketing CTAs).
- Status colour (green, amber, red, blue) is semantic, never decorative.

## Colors

A restrained palette: a single deep forest green, its two supporting greens, and neutral greys on a warm paper ground.

### Primary
- **Evergreen**: the brand. Primary buttons, headings on marketing pages, the logo-adjacent brand surfaces (home hero, footer, CTA banners), active nav state, and the selected/checked state of controls. Exposed as `--brand` / `bg-brand` and as shadcn `--primary`.
- **Pine**: the pressed and hover state of Evergreen (`--brand-strong`). Never used as a resting colour on its own.

### Secondary
- **Fern**: secondary emphasis on light surfaces: links, small uppercase section labels, focus rings (`--brand-accent`, shadcn `--ring`), the scrollbar thumb on hover.

### Tertiary
- **Navy** (`bg-navy`, hover `bg-navy-strong`): the printable Certificate of Appreciation and the home carousel caption bars. It is the only non-green brand surface and must not spread into the product UI.
- **Certificate Lime** (`certificate-lime`): rules, seal and accent marks on the certificate only.

- **Data Blue, Data Indigo and Alert Rose**: categorical colours for KPI icon tiles and charts (alongside Fern), and the Messages card accent on the dashboard home. They label categories; they never fill banners or buttons.

### Named Rules
**The Category Strip Rule.** Dashboard shortcut cards carry a 4px gradient strip along their top edge, one hue per card category. The set lives in `src/lib/categoryStrips.js` (`CATEGORY_STRIPS`). Add a category there rather than writing a new gradient inline, and never widen a strip into a banner.

### Neutral
- **Header Ink / Header Ink Strong**: link and icon colour in the marketing header once it turns solid on scroll.
- **Paper**: the page background behind everything.
- **Surface**: cards, modals, tables, inputs.
- **Morning Mist**: tinted section backgrounds ("How it works") and success-tinted chips (`--brand-tint`).
- **Ink**: primary text (Tailwind `gray-900`).
- **Ink Secondary**: body copy that is not the main reading text (`gray-600`).
- **Ink Muted**: metadata, timestamps, helper text, placeholders (`gray-500`). This is the lightest grey allowed for text on white.
- **Hairline**: borders and dividers (`gray-200`, often at reduced opacity).
- **Signal Red**: destructive actions and errors only.

### Named Rules
**The One Green Voice Rule.** Evergreen is the only brand hue. Status colours (emerald/amber/red/blue chips) communicate state, and small tinted icon tiles may use them to tell metric categories apart. No other saturated hue (purple, indigo) becomes a gradient, a banner, or a decorative accent.

**The Gray-500 Floor Rule.** No text on a white or paper surface is lighter than Ink Muted (`gray-500`, 4.8:1). `gray-400` and lighter are for disabled states, borders and decorative icons only.

**The Token-First Rule.** Brand colours are written as tokens (`bg-brand`, `text-brand-accent`, `var(--brand)`), never as `[#0d3b26]` literals.

## Typography

**Display Font:** DM Serif Display (with Georgia, serif)
**Body Font:** Inter (with ui-sans-serif, system-ui)
**Signature Font:** Great Vibes, used only for the signature line on certificates

**Character:** A warm, bookish serif for the few moments that speak to visitors, paired with a neutral, highly legible sans for everything people operate.

### Hierarchy
- **Display** (400, 3rem to 5.5rem fluid, 1.1): marketing hero and section headlines only. Never inside the signed-in product.
- **Headline** (700, 1.875rem, 1.2): page titles in the product (`h1`, one per page).
- **Title** (600, 1.125rem, 1.4): card and modal titles, table section headers.
- **Body** (400, 0.875rem, 1.5): product body copy, table cells, form text. Marketing paragraphs step up to 1rem–1.125rem and stay within 65ch.
- **Label** (600, 0.75rem, 0.08em tracking, uppercase): section eyebrows on dashboards, stat captions, table headers. 12px is the minimum size for any text.
- **Nav label** (500, 13px): product and marketing navigation links. **Menu item** (500, 15px) is its size in the mobile menu.
- **Field (mobile)** (400, 16px): form fields below 768px, so iOS Safari does not zoom into focused inputs.

### Named Rules
**The 12px Floor Rule.** No text is set below 12px (`text-xs`). Arbitrary 9–11px sizes are not allowed, even for chart axes or badges. The one exception is the printed certificate, whose seal lettering and "Powered by" microtype are part of a print emblem rather than screen text.

**The Serif-Is-For-Visitors Rule.** DM Serif Display appears on public marketing surfaces, the certificate, and the status pages (404 and error pages, via `src/components/StatusPage.js`) only.

## Layout

Content sits in a centered container: `max-w-6xl` for product pages, `max-w-7xl` for marketing sections, with the app nav capped at 1200px. Product pages use a vertical stack of cards and tables with 24px gaps. Marketing sections use 96px vertical rhythm (`py-24`). Breakpoints follow Tailwind's defaults (sm 640, md 768, lg 1024). Navigation collapses into a full-screen menu below `md`, and data tables scroll horizontally inside their card rather than shrinking text.

## Elevation & Depth

Depth is soft and ambient: white surfaces float slightly above the paper background. Resting cards use a small shadow, hover raises them, and modals carry the deepest shadow over a dimmed, lightly blurred backdrop. Brand-coloured surfaces (Evergreen hero, footer, CTA banners) are flat.

### Shadow Vocabulary
- **Resting** (Tailwind `shadow-sm`): cards, inputs, table containers.
- **Hover lift** (`0 4px 24px -4px rgb(0 0 0 / 0.08), 0 2px 8px -2px rgb(0 0 0 / 0.04)`): shadcn cards on hover.
- **Overlay** (`shadow-2xl`): modals and the certificate.

### Named Rules
**The Flat-Brand Rule.** Evergreen surfaces never carry a drop shadow. Shadows belong to white surfaces on paper.

## Shapes

Friendly and rounded. Controls use 8px corners. Cards use 12–16px, feature panels and modals 16–24px. Primary marketing CTAs, chips and avatars are full pills or circles. Borders are hairline (1px) and low-contrast. Colour comes from fills, not thick strokes.

## Components

### Buttons
Calm and confident: solid Evergreen for the one main action, quiet outlines for the rest.
- **Shape:** gently rounded (8px) in the product, full pill on marketing CTAs.
- **Primary:** Evergreen fill, white text, 36px tall, `shadow-sm`. This is the shadcn `default` variant.
- **Hover / Focus / Active:** hover deepens toward Pine, focus shows a 3px Fern ring, and press scales to 0.97 (disabled under reduced motion).
- **Outline / Ghost:** white or transparent with hairline border, for secondary and tertiary actions. Destructive actions use Signal Red.
- **Icon-only buttons** always carry an `aria-label` and a hit area of at least 36px (44px on touch-first controls such as the mobile menu).

### Chips
- **Style:** pill-shaped, tinted background with the matching dark text (Morning Mist + Evergreen for success/approved, amber for pending, red for rejected, blue for informational).
- **State:** state chips are read-only labels, not buttons.

### Cards / Containers
- **Corner Style:** 12–16px.
- **Background:** Surface on Paper.
- **Shadow Strategy:** Resting, lifting on hover (see Elevation).
- **Border:** hairline `gray-100`/`gray-200`.
- **Internal Padding:** 24px (16px on dense dashboard tiles).

### Inputs / Fields
- **Style:** 36px tall, hairline border, 8px corners, white fill, 16px text on mobile (prevents iOS zoom) and 14px from `md`.
- **Focus:** Evergreen border with a 3px translucent Evergreen glow.
- **Error / Disabled:** red border and ring via `aria-invalid`. Disabled controls drop to 50% opacity.

### Navigation
- **Product nav:** fixed white 60px bar, logo left, text links with icons, and the active link tinted Evergreen. Below `md` a hamburger (44px target, `aria-expanded`) opens a full-screen menu that traps focus and closes on Escape.
- **Marketing header:** transparent over the Evergreen hero, turning solid on scroll, with an animated three-line menu icon.

### Dialogs
All modals use `useDialogA11y` (`src/hooks/useDialogA11y.js`): `role="dialog"` (or `alertdialog` for confirmations), labelled by their heading, focus moved inside and trapped, Escape and backdrop click to close, and focus returned to the opener.

### Opportunities Carousel (signature)
The home page's two counter-scrolling rows of occasion cards are the one authored motion moment. They pause on hover, keyboard focus, when off-screen, and via a visible Pause button. Under `prefers-reduced-motion` they stop and become a horizontally scrollable, snap-aligned row.

### Certificate of Appreciation (signature)
A print-first A4 landscape document in Certificate Navy with a Great Vibes signature line, opened in a dialog from the volunteer's impact page.

## Do's and Don'ts

### Do:
- **Do** use `bg-brand` / `text-brand` / `var(--brand)` for Evergreen and the shadcn `default` Button for primary actions, and `bg-paper`, `bg-navy`, `text-data-blue` for the other named colours.
- **Do** pass Cloudinary images through `cldImage(url, width)` (`src/lib/cloudinary.js`) so they're served at display size.
- **Do** keep text at `gray-500` or darker on white and paper, and at 12px or larger.
- **Do** give every icon-only control an `aria-label`, and every modal the shared dialog hook.
- **Do** keep motion to state feedback in the product (150–200ms), and provide a reduced-motion path for anything that moves on its own.
- **Do** wrap wide tables in a horizontal scroll container inside their card.

### Don't:
- **Don't** write brand hex literals (`[#0d3b26]`) in class names. Use the tokens.
- **Don't** introduce new accent hues (purple, indigo) or gradient text.
- **Don't** use thick coloured left/right borders as card accents.
- **Don't** set DM Serif Display inside the signed-in product UI.
- **Don't** use `gray-400` or lighter for readable text.
- **Don't** load fonts with `@import` inside components. Fonts come from `next/font` in `src/app/layout.js`.
