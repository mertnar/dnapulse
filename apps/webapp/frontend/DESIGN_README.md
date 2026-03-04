# DNA Pulse Design System

Complete visual design system for the DNA Pulse enterprise telemetry and intelligence platform.

---

## Overview

DNA Pulse's design system provides a cohesive visual language built on **calm professionalism**, **data intelligence**, and **modern enterprise aesthetics**. The system uses a DNA Green primary color (#4CAF7A) to represent life and system health, paired with intelligent dark tones and purposeful accent colors.

**Key Principles:**

- Professional and trustworthy
- Modern and intelligent
- Calm, not flashy
- Enterprise-grade credibility
- Security-focused aesthetics

---

## Quick Start

### For Developers

Use Tailwind classes in your components:

```jsx
// Primary button
<button className="bg-primary-400 hover:bg-primary-500 text-white
                   font-medium px-4 py-2 rounded-md">
  Primary Action
</button>

// Card with proper theming
<div className="bg-white dark:bg-gray-800 rounded-lg p-6
                border border-gray-200 dark:border-gray-700">
  <h3 className="text-h3 text-dark-700 dark:text-white">Title</h3>
  <p className="text-body text-gray-600 dark:text-gray-400">Content</p>
</div>

// Status badge
<span className="bg-success/10 text-success px-2.5 py-0.5
                 rounded-full text-label font-medium">
  Active
</span>
```

### For Designers

Open `.bolt/design-system-preview.html` in your browser for a visual reference of all colors, typography, and components.

---

## Documentation Files

### Primary Documentation

- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** - Complete design system documentation with usage guidelines
- **[COLOR_PALETTE.md](./COLOR_PALETTE.md)** - Detailed color palette reference with hex codes and usage
- **[DESIGN_QUICK_REF.md](./DESIGN_QUICK_REF.md)** - Quick reference for developers

### Design Tokens

- **[design-tokens.json](./design-tokens.json)** - Machine-readable design tokens
- **[tailwind.config.js](./tailwind.config.js)** - Tailwind configuration with full color palette
- **[src/index.css](./src/index.css)** - CSS custom properties for all tokens

### Visual Reference

- **[.bolt/design-system-preview.html](./.bolt/design-system-preview.html)** - Visual preview of colors and typography

---

## Color System

### Primary Colors

#### DNA Green (#4CAF7A)

The primary brand color representing life, growth, and system health.

**Use for:**

- Primary CTAs and action buttons
- Success states and health indicators
- Active navigation items
- Positive metrics in data visualization

#### Pulse Dark (#1E2B2F)

Deep, intelligent color for text and structural elements.

**Use for:**

- Primary text (light mode)
- Headers and important labels
- Dark backgrounds and navigation

### Accent Colors

#### Insight Orange (#FFA726)

For alerts, warnings, and actionable insights.

#### Data Blue (#42A5F5)

For connectivity, data flow, and information.

#### Correlation Violet (#7E57C2)

For AI features, ML models, and relationships.

### Semantic Colors

- **Success:** #4CAF7A (Green)
- **Warning:** #FFA726 (Orange)
- **Error:** #EF5350 (Red)
- **Info:** #42A5F5 (Blue)

---

## Typography

### Font Family

**Inter** - Modern, readable, professional sans-serif

```css
font-family:
  'Inter',
  system-ui,
  -apple-system,
  sans-serif;
```

### Type Scale

| Element | Size      | Weight   | Usage             |
| ------- | --------- | -------- | ----------------- |
| H1      | 32px/40px | Semibold | Page titles       |
| H2      | 24px/32px | Semibold | Section headings  |
| H3      | 20px/28px | Medium   | Subsections       |
| H4      | 16px/24px | Medium   | Component headers |
| Body    | 14px/20px | Regular  | Primary text      |
| Label   | 12px/16px | Medium   | Form labels       |
| Caption | 11px/14px | Regular  | Metadata          |

---

## Spacing System

Based on an **8px grid** for consistent rhythm:

| Token | Size | Usage                      |
| ----- | ---- | -------------------------- |
| xs    | 4px  | Tight spacing              |
| sm    | 8px  | Compact spacing            |
| md    | 16px | Standard spacing (default) |
| lg    | 24px | Section padding            |
| xl    | 32px | Container padding          |
| 2xl   | 48px | Major section separation   |

---

## How to Use

### Tailwind Classes (Recommended)

```jsx
// Colors
className = 'bg-primary-400';
className = 'text-insight-400';
className = 'border-data-400';

// Typography
className = 'text-h1';
className = 'text-body';
className = 'font-semibold';

// Spacing
className = 'p-6 m-4 gap-2';

// Dark mode
className = 'bg-white dark:bg-gray-800';
```

### CSS Variables

```css
.custom-component {
  background-color: var(--color-primary-400);
  color: var(--color-text-primary);
  font-size: var(--font-size-body);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}
```

---

## Dark Mode Support

All colors and components automatically adapt to dark mode:

**Light Mode:**

- Background: #F8FAFB
- Surface: #FFFFFF
- Text: #1E2B2F

**Dark Mode:**

- Background: #0F172A
- Surface: #162235
- Text: #F8FAFB

Toggle dark mode with:

```jsx
document.documentElement.classList.toggle('dark');
```

---

## Design Principles

### ✅ DO

- Use DNA Green (#4CAF7A) for positive actions
- Apply accent colors intentionally with specific meaning
- Maintain high contrast (WCAG AA minimum)
- Test all designs in both light and dark modes
- Use the 8px spacing grid
- Follow the typography scale

### ❌ DON'T

- Don't use purple/indigo (except correlation violet)
- Don't mix multiple accent colors in one component
- Don't use neon or overly saturated colors
- Don't create arbitrary spacing values
- Don't ignore dark mode
- Don't use red for non-error states

---

## Accessibility

### Contrast Standards

All color combinations meet **WCAG AA** requirements:

- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- UI components: 3:1 minimum

### Focus States

All interactive elements include visible focus indicators:

```jsx
className = 'focus:outline-none focus:ring-2 focus:ring-primary-500';
```

---

## Component Patterns

### Button

```jsx
<button
  className="bg-primary-400 hover:bg-primary-500 text-white
                   font-medium text-body px-4 py-2 rounded-md
                   shadow-sm transition-colors"
>
  Button Text
</button>
```

### Card

```jsx
<div
  className="bg-white dark:bg-gray-800 rounded-lg
                border border-gray-200 dark:border-gray-700 p-6 shadow-md"
>
  {children}
</div>
```

### Badge

```jsx
<span
  className="inline-flex items-center px-2.5 py-0.5
                 rounded-full text-label font-medium
                 bg-success/10 text-success"
>
  Active
</span>
```

---

## File Structure

```
DNA-Pulse/
├── DESIGN_README.md              # This file
├── DESIGN_SYSTEM.md              # Complete documentation
├── COLOR_PALETTE.md              # Color reference
├── DESIGN_QUICK_REF.md           # Quick reference
├── design-tokens.json            # Design tokens (JSON)
├── tailwind.config.js            # Tailwind config
├── src/
│   └── index.css                 # CSS variables
└── .bolt/
    └── design-system-preview.html # Visual preview
```

---

## Version

**Design System Version:** 1.0.0
**Created:** January 2026
**Platform:** DNA Pulse Enterprise Telemetry Platform

---

## Support

For questions, suggestions, or contributions to the design system:

- Review the full documentation in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- Check quick reference in [DESIGN_QUICK_REF.md](./DESIGN_QUICK_REF.md)
- View color swatches in [COLOR_PALETTE.md](./COLOR_PALETTE.md)
- Open visual preview: `.bolt/design-system-preview.html`

---

**Built with:** Tailwind CSS, Inter Font, CSS Custom Properties
**Compatible with:** React, TypeScript, Vite
