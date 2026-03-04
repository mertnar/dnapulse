# DNA Pulse Color Palette Reference

Quick reference guide for DNA Pulse brand colors.

---

## Primary Colors

### DNA Green (Primary Brand)

Represents life, growth, and system health. Use for primary actions and positive states.

| Shade | Hex       | Use Case                                 |
| ----- | --------- | ---------------------------------------- |
| 50    | `#E8F5EE` | Lightest background, hover states        |
| 100   | `#C2E6D4` | Light background                         |
| 200   | `#99D7BA` | Subtle accents                           |
| 300   | `#6BCF9B` | **Light variant** – hover, active states |
| 400   | `#4CAF7A` | **PRIMARY** – main brand color, CTAs     |
| 500   | `#3CB371` | **Dark variant** – pressed states        |
| 600   | `#359F63` | Darker accent                            |
| 700   | `#2D8A54` | Text on light backgrounds                |
| 800   | `#257646` | Very dark accent                         |
| 900   | `#1D6238` | Darkest shade                            |

**CSS Variable:** `--color-primary-{shade}`
**Tailwind:** `bg-primary-400`, `text-primary-400`, etc.

---

### Pulse Dark (Structural)

Deep intelligent color for text, backgrounds, and structural elements.

| Shade | Hex       | Use Case                             |
| ----- | --------- | ------------------------------------ |
| 50    | `#F5F7F8` | Lightest gray                        |
| 100   | `#E8EBED` | Light surface                        |
| 200   | `#D1D7DB` | Dividers                             |
| 300   | `#A3B2BA` | Disabled text                        |
| 400   | `#758D99` | Secondary text                       |
| 500   | `#34484E` | **Light variant**                    |
| 600   | `#26363B` | **Medium dark**                      |
| 700   | `#1E2B2F` | **MAIN** – primary text (light mode) |
| 800   | `#171F22` | Dark backgrounds                     |
| 900   | `#0F1415` | Darkest backgrounds                  |

**CSS Variable:** `--color-dark-{shade}`
**Tailwind:** `bg-dark-700`, `text-dark-700`, etc.

---

## Accent Colors

### Insight Orange

Use for alerts, warnings, and actionable insights. Apply sparingly.

| Shade | Hex       | Use Case                         |
| ----- | --------- | -------------------------------- |
| 50    | `#FFF3E0` | Light background                 |
| 100   | `#FFE0B2` | Subtle background                |
| 200   | `#FFCC80` | Light accent                     |
| 300   | `#FFB74D` | **Light variant**                |
| 400   | `#FFA726` | **PRIMARY** – warnings, insights |
| 500   | `#FF9800` | Standard accent                  |
| 600   | `#FB8C00` | Darker accent                    |
| 700   | `#F57C00` | Text on light backgrounds        |
| 800   | `#EF6C00` | Deep accent                      |
| 900   | `#E65100` | Darkest shade                    |

**CSS Variable:** `--color-insight-{shade}`
**Tailwind:** `bg-insight-400`, `text-insight-400`, etc.

---

### Data Blue

Use for data connectivity, information flow, and links.

| Shade | Hex       | Use Case                      |
| ----- | --------- | ----------------------------- |
| 50    | `#E3F2FD` | Light background              |
| 100   | `#BBDEFB` | Subtle background             |
| 200   | `#90CAF9` | Light accent                  |
| 300   | `#64B5F6` | **Light variant**             |
| 400   | `#42A5F5` | **PRIMARY** – data indicators |
| 500   | `#2196F3` | Standard accent               |
| 600   | `#1E88E5` | Darker accent                 |
| 700   | `#1976D2` | Text on light backgrounds     |
| 800   | `#1565C0` | Deep accent                   |
| 900   | `#0D47A1` | Darkest shade                 |

**CSS Variable:** `--color-data-{shade}`
**Tailwind:** `bg-data-400`, `text-data-400`, etc.

---

### Correlation Violet

Use for AI features, ML models, and relationship visualization.

| Shade | Hex       | Use Case                       |
| ----- | --------- | ------------------------------ |
| 50    | `#F3E5F5` | Light background               |
| 100   | `#E1BEE7` | Subtle background              |
| 200   | `#CE93D8` | Light accent                   |
| 300   | `#BA68C8` | Medium accent                  |
| 400   | `#9575CD` | **Light variant**              |
| 500   | `#7E57C2` | **PRIMARY** – AI/ML indicators |
| 600   | `#7B1FA2` | Darker accent                  |
| 700   | `#6A1B9A` | Text on light backgrounds      |
| 800   | `#4A148C` | Deep accent                    |
| 900   | `#38006B` | Darkest shade                  |

**CSS Variable:** `--color-correlation-{shade}`
**Tailwind:** `bg-correlation-500`, `text-correlation-500`, etc.

---

## Semantic Colors

### Success (Green)

```
#4CAF7A
```

Use for: Successful operations, healthy systems, positive confirmations
**Tailwind:** `bg-success`, `text-success`

### Warning (Orange)

```
#FFA726
```

Use for: Warnings, medium-priority alerts, caution states
**Tailwind:** `bg-warning`, `text-warning`

### Error (Red)

```
#EF5350
```

Use for: Errors, critical alerts, destructive actions, failed states
**Tailwind:** `bg-error`, `text-error`

### Info (Blue)

```
#42A5F5
```

Use for: Informational messages, tips, neutral notifications
**Tailwind:** `bg-info`, `text-info`

---

## Neutral Colors

### Light Mode

| Token          | Hex       | Usage                |
| -------------- | --------- | -------------------- |
| Background     | `#F8FAFB` | Page background      |
| Surface        | `#FFFFFF` | Card/panel surfaces  |
| Border         | `#E5E7EB` | Borders and dividers |
| Text Muted     | `#6B7280` | Secondary text       |
| Text Primary   | `#1E2B2F` | Primary text         |
| Text Secondary | `#34484E` | Secondary headings   |

### Dark Mode

| Token          | Hex       | Usage                |
| -------------- | --------- | -------------------- |
| Background     | `#0F172A` | Page background      |
| Surface        | `#162235` | Card/panel surfaces  |
| Border         | `#24324A` | Borders and dividers |
| Text Muted     | `#94A3B8` | Secondary text       |
| Text Primary   | `#F8FAFB` | Primary text         |
| Text Secondary | `#E8EBED` | Secondary headings   |

**CSS Variables:**

```css
var(--color-background)
var(--color-surface)
var(--color-border)
var(--color-text-muted)
var(--color-text-primary)
var(--color-text-secondary)
```

---

## Color Usage Guidelines

### Primary Actions

✅ Use **DNA Green (primary-400)** for primary buttons, CTAs, and positive actions

### System Status

- **Green** – Healthy, active, online
- **Orange** – Warning, degraded, attention needed
- **Red** – Error, critical, offline
- **Blue** – Information, neutral status

### Data Visualization

- **Primary Green** – Positive metrics, growth
- **Data Blue** – Neutral data, connections
- **Insight Orange** – Anomalies, outliers
- **Correlation Violet** – AI predictions, patterns

### Text Hierarchy

1. **Primary Text** – Dark-700 (light mode), Surface (dark mode)
2. **Secondary Text** – Dark-500, Text-secondary
3. **Muted Text** – Text-muted
4. **Disabled** – Dark-300

---

## Accessibility Notes

All color combinations meet **WCAG AA** standards for contrast:

- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- UI components: 3:1 minimum

Test all colors in both light and dark modes for adequate contrast.

---

## Quick Copy

```css
/* Primary Green */
--primary-main: #4caf7a;
--primary-light: #6bcf9b;
--primary-dark: #3cb371;

/* Accent Colors */
--insight: #ffa726;
--data: #42a5f5;
--correlation: #7e57c2;

/* Semantic */
--success: #4caf7a;
--warning: #ffa726;
--error: #ef5350;
--info: #42a5f5;
```

---

For complete design system documentation, see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
