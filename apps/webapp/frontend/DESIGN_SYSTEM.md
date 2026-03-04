# DNA Pulse Design System

A comprehensive design system for the DNA Pulse enterprise telemetry and intelligence platform.

---

## Brand Philosophy

DNA Pulse represents the convergence of biological intelligence and technological monitoring. The visual identity embodies:

- **Professional** – Enterprise-grade credibility
- **Trustworthy** – Security-first confidence
- **Intelligent** – Data-driven sophistication
- **Modern** – Contemporary technology aesthetic
- **Calm** – Measured, deliberate, not flashy

---

## Color Palette

### Primary Brand Colors

#### DNA Green

The primary brand color represents life, growth, system health, and positive outcomes.

```css
--color-primary-400: #4caf7a /* Main brand green */ --color-primary-300: #6bcf9b /* Light variant */
  --color-primary-500: #3cb371 /* Dark variant */;
```

**Usage:**

- Primary CTAs and action buttons
- System health indicators
- Success states
- Active navigation items
- Logo and brand elements
- Data visualization for positive metrics

#### Pulse Dark

Deep, intelligent color representing data depth, system intelligence, and structural elements.

```css
--color-dark-700: #1e2b2f /* Main structural color */ --color-dark-600: #26363b /* Light variant */
  --color-dark-500: #34484e /* Lighter variant */;
```

**Usage:**

- Primary text color (light mode)
- Headers and important labels
- Dark backgrounds
- Structural UI elements
- Navigation backgrounds

---

### Accent Colors

Use accent colors intentionally and sparingly to draw attention to specific functions.

#### Insight Orange

Represents alerts, warnings, and actionable insights.

```css
--color-insight-400: #ffa726 /* Primary insight */ --color-insight-300: #ffb74d /* Light variant */;
```

**Usage:**

- Alert notifications
- Warning states
- Insight highlights
- Attention-grabbing elements
- Anomaly indicators

#### Data Blue

Represents connectivity, data flow, and information processing.

```css
--color-data-400: #42a5f5 /* Primary data blue */ --color-data-300: #64b5f6 /* Light variant */;
```

**Usage:**

- Data connections
- Information badges
- Link states
- Data source indicators
- Information panels

#### Correlation Violet

Represents relationships, AI processing, and pattern recognition.

```css
--color-correlation-500: #7e57c2 /* Primary correlation */ --color-correlation-400: #9575cd
  /* Light variant */;
```

**Usage:**

- ML model indicators
- Relationship visualizations
- AI-powered features
- Correlation graphs
- Pattern detection UI

---

### Semantic Colors

#### Success

```css
--color-success: #4caf7a;
```

**Usage:** Successful operations, healthy systems, positive confirmations

#### Warning

```css
--color-warning: #ffa726;
```

**Usage:** Warnings, medium-priority alerts, caution states

#### Error

```css
--color-error: #ef5350;
```

**Usage:** Errors, critical alerts, destructive actions, failed states

#### Info

```css
--color-info: #42a5f5;
```

**Usage:** Informational messages, tips, neutral notifications

---

### Neutral Colors

#### Light Mode

```css
--color-background: #f8fafb /* Page background */ --color-surface: #ffffff /* Card/panel surfaces */
  --color-border: #e5e7eb /* Borders and dividers */ --color-text-muted: #6b7280
  /* Secondary text */ --color-text-primary: #1e2b2f /* Primary text */ --color-text-secondary:
  #34484e /* Secondary headings */;
```

#### Dark Mode

```css
--color-background: #0f172a /* Page background */ --color-surface: #162235 /* Card/panel surfaces */
  --color-border: #24324a /* Borders and dividers */ --color-text-muted: #94a3b8
  /* Secondary text */ --color-text-primary: #f8fafb /* Primary text */ --color-text-secondary:
  #e8ebed /* Secondary headings */;
```

---

## Typography

### Font Family

**Primary Font:** Inter

- Clean, modern sans-serif
- Excellent readability at all sizes
- Professional enterprise aesthetic
- Optimized for UI design

```css
font-family:
  'Inter',
  system-ui,
  -apple-system,
  sans-serif;
```

### Font Weights

```css
--font-weight-regular: 400 /* Body text */ --font-weight-medium: 500 /* Labels, emphasis */
  --font-weight-semibold: 600 /* Headings, titles */ --font-weight-bold: 700 /* Strong emphasis */;
```

### Typography Scale

#### Headings

**H1 - Page Titles**

```css
font-size: 32px;
line-height: 40px;
font-weight: 600 (Semibold);
```

**Usage:** Main page titles, primary headlines

**H2 - Section Titles**

```css
font-size: 24px;
line-height: 32px;
font-weight: 600 (Semibold);
```

**Usage:** Section headings, card titles, major UI divisions

**H3 - Subsection Titles**

```css
font-size: 20px;
line-height: 28px;
font-weight: 500 (Medium);
```

**Usage:** Subsections, panel headers, secondary groupings

**H4 - Component Headers**

```css
font-size: 16px;
line-height: 24px;
font-weight: 500 (Medium);
```

**Usage:** Component headers, list section titles

#### Body Text

**Body Large**

```css
font-size: 15px;
line-height: 22px;
font-weight: 400 (Regular);
```

**Usage:** Emphasized body text, introductory paragraphs

**Body (Default)**

```css
font-size: 14px;
line-height: 20px;
font-weight: 400 (Regular);
```

**Usage:** Primary body text, table content, form inputs

**Body Small**

```css
font-size: 13px;
line-height: 18px;
font-weight: 400 (Regular);
```

**Usage:** Dense information, secondary descriptions

#### Labels & Meta

**Label**

```css
font-size: 12px;
line-height: 16px;
font-weight: 500 (Medium);
```

**Usage:** Form labels, data labels, UI element labels

**Caption**

```css
font-size: 11px;
line-height: 14px;
font-weight: 400 (Regular);
```

**Usage:** Timestamps, metadata, helper text, footnotes

---

## Spacing System

Based on an 8px grid for consistent rhythm and alignment.

```css
--spacing-xs: 4px /* Tight spacing */ --spacing-sm: 8px /* Small spacing */ --spacing-md: 16px
  /* Medium spacing (base) */ --spacing-lg: 24px /* Large spacing */ --spacing-xl: 32px
  /* Extra large spacing */ --spacing-2xl: 48px /* Section spacing */;
```

**Usage Guidelines:**

- Use `xs` (4px) for icon-text gaps, tight lists
- Use `sm` (8px) for compact component spacing
- Use `md` (16px) for standard component padding
- Use `lg` (24px) for section padding
- Use `xl` (32px) for card/container padding
- Use `2xl` (48px) for major section separation

---

## Border Radius

```css
--radius-sm: 4px /* Buttons, small elements */ --radius-md: 8px
  /* Cards, inputs, standard components */ --radius-lg: 12px /* Large cards, modals */ --radius-xl:
  16px /* Hero sections, major containers */ --radius-full: 9999px /* Pills, badges, avatars */;
```

---

## Shadows

### Light Mode

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
```

### Dark Mode

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
```

**Usage:**

- `sm` – Subtle elevation, hover states
- `md` – Cards, dropdown menus
- `lg` – Modals, important panels
- `xl` – Top-level overlays, drawers

---

## Design Tokens Access

### Tailwind Classes

Use predefined Tailwind classes for rapid development:

```jsx
// Primary green
<button className="bg-primary-400 hover:bg-primary-500">

// Text colors
<h1 className="text-dark-700 dark:text-neutral-surface">

// Accent colors
<Badge className="bg-insight-400">Alert</Badge>
<Badge className="bg-data-400">Data</Badge>
<Badge className="bg-correlation-500">AI</Badge>

// Typography
<h1 className="text-h1">Page Title</h1>
<p className="text-body">Content</p>
<span className="text-label">Label</span>
```

### CSS Custom Properties

Access design tokens directly via CSS variables:

```css
.custom-component {
  background-color: var(--color-primary-400);
  color: var(--color-text-primary);
  font-size: var(--font-size-body);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}
```

---

## Usage Guidelines

### DO's

✅ Use **primary green** (#4CAF7A) for positive actions and system health
✅ Use **accent colors intentionally** – each has specific meaning
✅ Maintain **high contrast** for accessibility (WCAG AA minimum)
✅ Use **Inter font** at specified weights for consistency
✅ Apply **8px spacing grid** for alignment
✅ Test designs in **both light and dark modes**
✅ Use **semantic colors** for their intended purpose

### DON'Ts

❌ Don't use purple/indigo unless using correlation violet
❌ Don't mix multiple accent colors in one component
❌ Don't use neon or overly saturated colors
❌ Don't use font weights outside the defined scale
❌ Don't create arbitrary spacing – use the system
❌ Don't ignore dark mode considerations
❌ Don't use red for non-error states

---

## Accessibility

### Contrast Ratios

All color combinations meet WCAG AA standards:

- **Normal text:** Minimum 4.5:1 contrast ratio
- **Large text:** Minimum 3:1 contrast ratio
- **UI components:** Minimum 3:1 contrast ratio

### Focus States

All interactive elements include visible focus indicators:

- 2px solid outline
- Primary color for positive actions
- Data blue for informational elements

---

## Implementation Examples

### Primary Button

```jsx
<button
  className="bg-primary-400 hover:bg-primary-500 text-white
                   font-medium text-body px-4 py-2 rounded-md
                   shadow-sm transition-colors"
>
  Primary Action
</button>
```

### Card Component

```jsx
<div
  className="bg-neutral-surface dark:bg-surface
                border border-neutral-border dark:border-border
                rounded-lg p-6 shadow-md"
>
  <h3 className="text-h3 text-dark-700 dark:text-neutral-surface mb-2">Card Title</h3>
  <p className="text-body text-text-muted">Card content goes here</p>
</div>
```

### Status Badge

```jsx
// Success
<span className="bg-success/10 text-success px-2.5 py-0.5
               rounded-full text-label font-medium">
  Active
</span>

// Warning
<span className="bg-warning/10 text-warning px-2.5 py-0.5
               rounded-full text-label font-medium">
  Warning
</span>

// Error
<span className="bg-error/10 text-error px-2.5 py-0.5
               rounded-full text-label font-medium">
  Error
</span>
```

---

## Version

**Design System Version:** 1.0.0
**Last Updated:** January 2026
**Platform:** DNA Pulse Enterprise Telemetry Platform

---

For questions or suggestions, contact the design team.
