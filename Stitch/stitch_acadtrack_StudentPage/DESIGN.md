---
name: Peach, Cream & Lilac Academic Narrative
colors:
  surface: '#fff7fe'
  surface-dim: '#e2d6e6'
  surface-bright: '#fff7fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fcf0ff'
  surface-container: '#f6eafa'
  surface-container-high: '#f0e4f4'
  surface-container-highest: '#ebdfef'
  on-surface: '#1f1924'
  on-surface-variant: '#494551'
  inverse-surface: '#352e3a'
  inverse-on-surface: '#f9edfd'
  outline: '#7a7583'
  outline-variant: '#cbc4d3'
  surface-tint: '#6a4cad'
  primary: '#674aab'
  on-primary: '#ffffff'
  primary-container: '#8163c5'
  on-primary-container: '#fffbff'
  inverse-primary: '#d1bcff'
  secondary: '#695c53'
  on-secondary: '#ffffff'
  secondary-container: '#f2dfd3'
  on-secondary-container: '#6f6258'
  tertiary: '#5f5873'
  on-tertiary: '#ffffff'
  tertiary-container: '#78718c'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d1bcff'
  on-primary-fixed: '#24005b'
  on-primary-fixed-variant: '#513394'
  secondary-fixed: '#f2dfd3'
  secondary-fixed-dim: '#d5c3b8'
  on-secondary-fixed: '#231a13'
  on-secondary-fixed-variant: '#51443c'
  tertiary-fixed: '#e8defe'
  tertiary-fixed-dim: '#cbc2e1'
  on-tertiary-fixed: '#1d182f'
  on-tertiary-fixed-variant: '#49435c'
  background: '#fff7fe'
  on-background: '#1f1924'
  surface-variant: '#ebdfef'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system establishes a tranquil, intellectually resonant environment tailored for modern higher-education administration, faculty, and student management. Rooted in an aesthetic balance of Warm Cream, Soft Peach, and Muted Lilac, it eschews institutional sterile grays and bureaucratic stiffness in favor of warm clarity, poise, and scholarly dignity.

The style unites **Modern Editorial Minimalism** with soft **Tonal Layering**. It delivers the structural density and rigorous layout logic necessary for high-density academic operations (gradebooks, course curricula, faculty tenures, audit trails) while using serene hues and generous breathing room to reduce cognitive exhaustion during extended administrative sessions. Visual hierarchy relies on tonal surfaces and delicate micro-borders rather than aggressive heavy elevation.

## Colors

The palette balances soft chromatic warmth with high legibility and precise status signals:

- **Base Canvas & Surfaces**:
  - `canvas-default`: `#FFFAF5` (Warm Cream base that reduces screen glare).
  - `surface-elevated`: `#FFFFFF` (Primary cards, modal dialogues, clean data surfaces).
  - `surface-tint-peach`: `#FBE8DC` (Warm highlight containers, contextual callouts, role indicators).
  - `surface-tint-lilac`: `#E9DFFF` (Selected navigation states, secondary metrics, quiet highlight fields).
- **Brand Accents**:
  - `accent-primary`: `#9274D8` (Active actions, key focus rings, primary brand badges).
  - `accent-hover`: `#7659BB` (Active interactions, pressed states).
- **Typography & Structural Contrast**:
  - `text-primary`: `#38313D` (Deep warm aubergine-slate; replaces harsh pure blacks).
  - `text-secondary`: `#786E7B` (Muted metadata, supporting timestamps, column headers).
  - `border-subtle`: `#EFE7E9` (Hairline dividers, structural grid outlines, quiet card boundaries).
- **Semantic Feedback**:
  - `feedback-success`: `#279B78` (Grade submission, active enrollment status, completions).
  - `feedback-warning`: `#D99A43` (Pending approvals, prerequisites alerts, schedule overlaps).
  - `feedback-danger`: `#D96F79` (Academic probation, course drops, validation errors).

## Typography

Typography prioritizes density, optical balance, and sustained reading endurance across complex academic datasets.

- **Display & Section Headers (`Geist`)**: Used for page headers, KPI statistics, and dialogue titles. Tight letter spacing (`-0.01em` to `-0.02em`) creates an authoritative, modern feel without geometric abstraction.
- **Body & Controls (`Inter`)**: Deployed for tabular records, syllabus documentation, inputs, and navigation elements. `Inter` provides high legibility at micro-scales (11px–13px) for dense grade matrices and credit tallies.
- **Tabular Numerals**: Numeric displays within data tables, GPA meters, and credit counters require `font-variant-numeric: tabular-nums` to maintain vertical decimal alignment.

## Layout & Spacing

The structural layout utilizes a responsive 12-column fluid grid system pinned to a maximum canvas container of `1440px`.

- **Breakpoints & Layout Behavior**:
  - **Desktop (1024px and above)**: 12-column grid, `1.5rem` gutters, and `2.5rem` outer page margins. Supports multi-pane configurations (collapsible administrative sidebar, master list, and contextual detail drawer).
  - **Tablet (768px – 1023px)**: 8-column grid, `1.25rem` gutters, `1.5rem` canvas margins. Detail drawers collapse into modal sheets.
  - **Mobile (below 768px)**: 4-column grid, `1rem` gutters, `1rem` canvas margins. Horizontal navigation switches to scrollable carousels; complex tabular matrices condense into stacked card summaries.
- **Spacing Principle**: Internal card padding matches `space-lg` (24px) for expansive analytical blocks and drops to `space-md` (16px) for compact data tables and inputs.

## Elevation & Depth

Visual hierarchy relies on **Tonal Layers** combined with **Restrained Ambient Shadows** and warm hairline outlines:

- **Elevation 0 (Base Canvas)**: Background `#FFFAF5`. Used exclusively for outer viewport space and structural sub-page backdrops.
- **Elevation 1 (Cards & Data Surfaces)**: Background `#FFFFFF`, encased with a crisp `1px solid #EFE7E9` border. No drop shadow is applied on static state; this retains clean borders across dense lists.
- **Elevation 2 (Floating Overlays & Popovers)**: Tinted shadow (`0 4px 16px -2px rgba(56, 49, 61, 0.06), 0 2px 6px -1px rgba(56, 49, 61, 0.04)`), paired with `#FFFFFF` background and `#EFE7E9` outline.
- **Elevation 3 (Compact Dialogues & Drawer Panels)**: Ambient diffuse shadow (`0 12px 32px -4px rgba(56, 49, 61, 0.12), 0 4px 12px -2px rgba(56, 49, 61, 0.04)`), accompanied by a 40% opacity aubergine backdrop blur (`backdrop-filter: blur(4px)`).

## Shapes

The design uses a refined curvature scale (`roundedness: 2`) that brings soft warmth without reducing information density:

- **Core Shapes (`rounded-md`, 8px / 0.5rem)**: Standard buttons, text inputs, role badges, horizontal sub-nav tab indicators, and tabular row selections.
- **Surface Enclosures (`rounded-lg`, 16px / 1rem)**: KPI cards, gradebook summary containers, and interactive modal dialogs.
- **Pill Shapes (`rounded-full`, 9999px)**: Avatars, circular state indicators, and tag filters.

## Components

### Buttons
- **Primary**: Background `#9274D8`, foreground `#FFFFFF`, border `transparent`. Hover transitions to `#7659BB`. `0.5rem` border radius, padding `0.625rem 1.25rem`.
- **Secondary / Soft Tint**: Background `#E9DFFF`, foreground `#7659BB`, border `1px solid transparent`. Hover shifts to `#FBE8DC` with `#38313D` text.
- **Ghost / Outline**: Background `transparent`, border `1px solid #EFE7E9`, text `#38313D`. Hover applies background `#FFFAF5`.

### Chips & Role Indicator Badges
- Compact geometry (`22px` height, `label-sm` font, `4px` horizontal padding).
- **Faculty / Admin**: Soft Peach background `#FBE8DC`, text `#38313D`.
- **Student**: Soft Lilac background `#E9DFFF`, text `#7659BB`.
- **Auditor / Guest**: Subtle gray-aubergine tint `#EFE7E9`, text `#786E7B`.

### Horizontal Sub-Navigation Tabs
- Positioned atop data panels and course rosters. Zero bottom border on the container.
- **Active State**: Solid `#FFFFFF` card tab or soft pill container with an inset shadow/border, text `#9274D8`, weight `600`.
- **Inactive State**: Text `#786E7B`, weight `500`. Hover state applies `#FBE8DC` at 50% opacity.

### KPI Cards
- Background `#FFFFFF`, outline `1px solid #EFE7E9`, radius `16px`, padding `1.25rem`.
- Stat value in `Geist` `32px` font weight `600`, colored `#38313D`.
- Supporting metadata labeled via `label-sm` in `#786E7B`. Accent indicator bar or metric trend icon utilizing `#279B78` or `#9274D8`.

### Tabular Data (Gradebooks & Registries)
- Table header: `#FFFAF5` surface, uppercase `label-sm`, tracking `0.04em`, text `#786E7B`, border bottom `1px solid #EFE7E9`.
- Table rows: Background `#FFFFFF`, height `48px`, border bottom `1px solid #EFE7E9`. Hover state shifts row tone to `#FFFAF5`.
- Active / Selected row: Background tint `#FBE8DC` at 35% opacity with an active `#9274D8` 2px left border accent.

### Input Fields & Controls
- Form controls display height `40px`, background `#FFFFFF`, border `1px solid #EFE7E9`, text `#38313D`, radius `8px`.
- Focus state: Border color `#9274D8`, with an outer focus aura `0 0 0 3px rgba(146, 116, 216, 0.18)`.
- Checkboxes & Radios: `#FFFFFF` base, unchecked outline `1px solid #786E7B`, checked fills with `#9274D8` containing a white checkmark.

### Compact Dialogs
- Maximum width `480px`, background `#FFFFFF`, border `1px solid #EFE7E9`, radius `16px`, padding `1.5rem`.
- Action footer arranged with primary button pinned to the right edge and cancel action using Ghost/Subtle treatment.