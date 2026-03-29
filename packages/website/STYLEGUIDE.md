# Frontiers Style Guide

## Design Philosophy

Frontiers should feel like a **forest clearing** — calm, grounded, readable. The palette is earth and forest: warm browns for surfaces, moss green for accents, water blue for types and info, with restrained warm tones for warnings and errors.

**Do:**

- Use brown neutrals for 95% of the UI
- Use green for interactive elements (buttons, links, active states)
- Use blue for informational elements (types, links, badges)
- Keep text high-contrast and warm

**Don't:**

- Use pure black (#000) or pure white (#FFF)
- Use accent colors for large backgrounds
- Combine green and blue in adjacent elements
- Use saturated colors for body text

---

## Color Palette

### Dark Theme (default)

| Role            | Name      | Hex       | Contrast | Usage                            |
| --------------- | --------- | --------- | -------- | -------------------------------- |
| Surface         | Loam      | `#1C1916` | —        | Main background                  |
| Surface Raised  | Bark      | `#272320` | —        | Panels, sidebars, headers        |
| Surface Overlay | Driftwood | `#353029` | —        | Dropdowns, tooltips, code blocks |
| Border          | —         | `#4A433B` | —        | Dividers, input borders          |
| Border Focus    | Fern      | `#5A8A42` | —        | Focused inputs                   |
| Text            | Birch     | `#E4DED4` | 13.1:1   | Primary text                     |
| Text Muted      | Dust      | `#A59D91` | 6.5:1    | Secondary text, labels           |
| Accent          | Fern      | `#6B9E50` | 5.5:1    | Buttons, links, active states    |
| Accent Hover    | Canopy    | `#7DB060` | —        | Hover states                     |
| Info            | Creek     | `#5B96B5` | 5.4:1    | Types, informational badges      |
| Success         | Sage      | `#7DA668` | 6.3:1    | Success badges, "up" status      |
| Error           | Clay      | `#D0654E` | 4.7:1    | Errors, destructive actions      |
| Warning         | Honey     | `#D4A04A` | 7.4:1    | Warnings, highlights             |

### Light Theme

| Role            | Name       | Hex       | Contrast | Usage                  |
| --------------- | ---------- | --------- | -------- | ---------------------- |
| Surface         | Linen      | `#F3EEE8` | —        | Main background        |
| Surface Raised  | Paper      | `#FAF8F5` | —        | Panels, headers        |
| Surface Overlay | Sand       | `#EAE4DB` | —        | Dropdowns, code blocks |
| Border          | —          | `#CFC7BB` | —        | Dividers               |
| Text            | Charcoal   | `#2A2520` | 13.2:1   | Primary text           |
| Text Muted      | Walnut     | `#6B6055` | 5.3:1    | Secondary text         |
| Accent          | Deep Fern  | `#3D6E28` | 5.3:1    | Buttons, links         |
| Info            | Deep Creek | `#2E6B85` | 5.1:1    | Types, info            |
| Success         | Deep Moss  | `#3D6A2C` | 5.5:1    | Success states         |
| Error           | Brick      | `#A04030` | 5.6:1    | Errors                 |
| Warning         | Amber      | `#A07830` | —        | Warnings               |

All text colors pass WCAG AA (4.5:1+) on their respective backgrounds.

### Button Text

Primary buttons use `text-surface` (dark bg color) on accent backgrounds — not white.
This gives 5.5:1 contrast on green, compared to 3.2:1 for white.

---

## Typography

**Font:** JetBrains Mono / Fira Code / ui-monospace

| Element             | Size | Weight            | Color             |
| ------------------- | ---- | ----------------- | ----------------- |
| Page title          | 18px | Bold              | Accent            |
| CLI prompt          | 14px | Normal            | Accent ($ symbol) |
| Editor              | 13px | Normal            | Monaco theme      |
| Tab/button labels   | 12px | Normal/Medium     | Muted or Accent   |
| File tree items     | 11px | Normal            | Muted or Accent   |
| CLI output / badges | 10px | Normal/Medium     | Muted             |
| Dir labels          | 9px  | Medium, uppercase | Muted             |

---

## Semantic Colors

| Meaning       | Dark            | Light                | Used For                     |
| ------------- | --------------- | -------------------- | ---------------------------- |
| Interactive   | Fern `#6B9E50`  | Deep Fern `#3D6E28`  | Buttons, active tabs, cursor |
| Informational | Creek `#5B96B5` | Deep Creek `#2E6B85` | Types, links, badges         |
| Positive      | Sage `#7DA668`  | Deep Moss `#3D6A2C`  | Success, "up" status         |
| Negative      | Clay `#D0654E`  | Brick `#A04030`      | Errors, destructive          |
| Caution       | Honey `#D4A04A` | Amber `#A07830`      | Warnings                     |

---

## Components

### Buttons

**Primary:** `bg-accent text-surface rounded px-3 py-1 text-xs font-medium`
**Secondary:** `border border-border text-text hover:border-accent hover:text-accent`
**Destructive:** `border border-border text-text-muted hover:border-error hover:text-error`
**Quick action:** `border border-border px-2 py-1 text-[10px] text-text-muted`

### Panels

- Main bg: implicit `bg-surface`
- Raised: `bg-surface-raised` (sidebars, headers)
- Overlay: `bg-surface-overlay` (dropdowns, code blocks)
- Borders: `border-border` (1px solid)

### Monaco Syntax

| Token     | Dark             | Light                |
| --------- | ---------------- | -------------------- |
| Keywords  | Fern `#6B9E50`   | Deep Fern `#3D6E28`  |
| Strings   | Honey `#D4A04A`  | Amber `#A07830`      |
| Numbers   | Honey `#D4A04A`  | Amber `#A07830`      |
| Types     | Creek `#5B96B5`  | Deep Creek `#2E6B85` |
| Comments  | `#756D62` italic | `#756D62` italic     |
| Variables | Birch `#E4DED4`  | Charcoal `#2A2520`   |

---

## Motion

- Splitter hover: opacity 0.15s
- Tab switch: transition-colors 150ms
- Spinner: `animate-spin border-accent border-t-transparent`
- No other animations

---

## Naming

Colors are named after natural elements — forest, earth, water:

- **Surfaces:** Loam, Bark, Driftwood, Linen, Paper, Sand
- **Text:** Birch, Dust, Charcoal, Walnut
- **Green:** Fern, Canopy, Sage, Moss
- **Blue:** Creek
- **Warm:** Honey, Clay, Brick, Amber
