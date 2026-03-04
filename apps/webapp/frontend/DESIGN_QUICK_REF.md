# DNA Pulse Design System - Quick Reference

Fast reference guide for developers. For complete documentation, see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

---

## Colors (Tailwind Classes)

### Primary Brand

```jsx
className = 'bg-primary-400'; // DNA Green
className = 'text-primary-400';
className = 'border-primary-400';
className = 'hover:bg-primary-500';
```

### Accent Colors

```jsx
className = 'bg-insight-400'; // Orange - Alerts/Warnings
className = 'bg-data-400'; // Blue - Data/Info
className = 'bg-correlation-500'; // Violet - AI/ML
```

### Semantic

```jsx
className = 'bg-success'; // #4CAF7A
className = 'bg-warning'; // #FFA726
className = 'bg-error'; // #EF5350
className = 'bg-info'; // #42A5F5
```

### Text

```jsx
className = 'text-dark-700 dark:text-white'; // Primary text
className = 'text-gray-600 dark:text-gray-400'; // Secondary text
```

---

## Typography (Tailwind Classes)

```jsx
className = 'text-h1'; // 32px/40px, Semibold
className = 'text-h2'; // 24px/32px, Semibold
className = 'text-h3'; // 20px/28px, Medium
className = 'text-h4'; // 16px/24px, Medium
className = 'text-body-lg'; // 15px/22px, Regular
className = 'text-body'; // 14px/20px, Regular (default)
className = 'text-body-sm'; // 13px/18px, Regular
className = 'text-label'; // 12px/16px, Medium
className = 'text-caption'; // 11px/14px, Regular
```

### Font Weights

```jsx
className = 'font-normal'; // 400
className = 'font-medium'; // 500
className = 'font-semibold'; // 600
className = 'font-bold'; // 700
```

---

## CSS Variables

### Colors

```css
var(--color-primary-400)
var(--color-insight-400)
var(--color-data-400)
var(--color-correlation-500)
var(--color-success)
var(--color-warning)
var(--color-error)
var(--color-info)
```

### Neutrals (adapt to theme)

```css
var(--color-background)     // Page background
var(--color-surface)        // Card surfaces
var(--color-border)         // Borders
var(--color-text-muted)     // Secondary text
var(--color-text-primary)   // Primary text
```

### Typography

```css
var(--font-size-h1)
var(--font-size-body)
var(--line-height-body)
var(--font-weight-medium)
```

### Spacing

```css
var(--spacing-xs)   // 4px
var(--spacing-sm)   // 8px
var(--spacing-md)   // 16px
var(--spacing-lg)   // 24px
var(--spacing-xl)   // 32px
var(--spacing-2xl)  // 48px
```

### Effects

```css
var(--radius-md)    // 8px
var(--shadow-md)    // Medium shadow
```

---

## Common Patterns

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
                border border-gray-200 dark:border-gray-700
                p-6 shadow-md"
>
  <h3 className="text-h3 mb-2">Title</h3>
  <p className="text-body text-gray-600">Content</p>
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

### Status Indicator

```jsx
<div className="flex items-center space-x-2">
  <div className="h-2 w-2 rounded-full bg-success" />
  <span className="text-body-sm text-gray-600">Online</span>
</div>
```

### Input

```jsx
<input
  className="w-full px-3 py-2 border border-gray-300
                  dark:border-gray-600 rounded-lg
                  focus:outline-none focus:ring-2
                  focus:ring-primary-500
                  dark:bg-gray-700 dark:text-white"
/>
```

---

## Status Colors

| Status             | Color  | Tailwind Class                   |
| ------------------ | ------ | -------------------------------- |
| Success / Active   | Green  | `bg-success` or `bg-primary-400` |
| Warning / Degraded | Orange | `bg-warning` or `bg-insight-400` |
| Error / Critical   | Red    | `bg-error`                       |
| Info / Neutral     | Blue   | `bg-info` or `bg-data-400`       |
| Unknown / Disabled | Gray   | `bg-gray-400`                    |

---

## Spacing Scale

| Token | Size | Use                            |
| ----- | ---- | ------------------------------ |
| xs    | 4px  | Icon-text gap, tight spacing   |
| sm    | 8px  | Compact spacing                |
| md    | 16px | Standard spacing (most common) |
| lg    | 24px | Section padding                |
| xl    | 32px | Container padding              |
| 2xl   | 48px | Major section separation       |

**Tailwind:** `p-4` (16px), `m-6` (24px), `gap-2` (8px)

---

## Border Radius

| Token | Size   | Use                     |
| ----- | ------ | ----------------------- |
| sm    | 4px    | Buttons, small elements |
| md    | 8px    | Cards, inputs (default) |
| lg    | 12px   | Large cards, modals     |
| xl    | 16px   | Hero sections           |
| full  | 9999px | Pills, badges, avatars  |

**Tailwind:** `rounded-md`, `rounded-lg`, `rounded-full`

---

## Shadows

```jsx
className = 'shadow-sm'; // Subtle
className = 'shadow-md'; // Cards (default)
className = 'shadow-lg'; // Modals
className = 'shadow-xl'; // Overlays
```

---

## Dark Mode

Automatically handled via `dark:` prefix:

```jsx
className="bg-white dark:bg-gray-800
           text-gray-900 dark:text-white
           border-gray-200 dark:border-gray-700"
```

---

## Accessibility

### Focus States

All interactive elements should have visible focus:

```jsx
className = 'focus:outline-none focus:ring-2 focus:ring-primary-500';
```

### Contrast

- Ensure 4.5:1 contrast for normal text
- Ensure 3:1 contrast for large text and UI components
- Test in both light and dark modes

---

## Do's and Don'ts

### ✅ DO

- Use primary green (#4CAF7A) for positive actions
- Use semantic colors appropriately
- Test in both light and dark modes
- Use the 8px spacing grid
- Maintain font weight consistency

### ❌ DON'T

- Don't use random colors - stick to the palette
- Don't mix too many accent colors in one view
- Don't use neon or overly saturated colors
- Don't ignore dark mode
- Don't use red for non-error states

---

## Resources

- **Full Documentation:** [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- **Color Reference:** [COLOR_PALETTE.md](./COLOR_PALETTE.md)
- **Design Tokens:** [design-tokens.json](./design-tokens.json)
- **Tailwind Config:** [tailwind.config.js](./tailwind.config.js)
- **CSS Variables:** [src/index.css](./src/index.css)

---

**Design System Version:** 1.0.0
