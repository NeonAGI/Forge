# The Forge – UI & Style Guide

## 1  Theme DNA

* **Night-Sky Noir** – deep navy canvas with subtle starfield
* **Glass Cards** – frosted panels (backdrop-filter: blur(8px) brightness(1.2))
* **Ember Accents** – cyan (idle) ▶ orange (active) ▶ amber (speech)

## 2  Color Tokens

| Token              | Hex                   | Role         |
| ------------------ | --------------------- | ------------ |
| `--color-bg`       | `#0E1524`             | base layer   |
| `--panel-bg`       | `rgba(14,21,36,0.55)` | card fill    |
| `--panel-border`   | `#1D5DF1` @ 20 %      | card outline |
| `--text-primary`   | `#FFFFFF`             | headings     |
| `--text-secondary` | `#A5B4CB`             | body         |
| `--ember-idle`     | `#00B3FF`             | mic idle     |
| `--ember-hot`      | `#FF6B00`             | listening    |
| `--ember-speak`    | `#FF9B38`             | TTS          |

## 3  Typography

| Weight                                            | Usage                             |
| ------------------------------------------------- | --------------------------------- |
| 700 – 800                                         | Dashboard title (`2.25rem / 600`) |
| 600                                               | Card heading (`1.125rem`)         |
| 400 – 500                                         | Body text (`1rem`)                |
| 300                                               | Minor labels (`0.875rem`)         |
| Font stack: **Inter, SF Pro Display, system-ui**. |                                   |

## 4  Layout Grid

* **Desktop / TV**: 12-col, 96 px gutters, max-width 1400 px
* **Tablet ≤ 1024 px**: 8-col, 24 px gutters
* **Mobile ≤ 640 px**: 4-col, 16 px gutters
* Cards snap to grid rows (min-height = 200 px) with 24 px radius.

## 5  Core Components

| Component         | Size                           | Props                            |        |        |
| ----------------- | ------------------------------ | -------------------------------- | ------ | ------ |
| `<ClockCard>`     | 3 × 2 cols                     | `locale`, `format`               |        |        |
| `<TaskList>`      | 3 × 2                          | `tasks[]`, `onAdd`, `onToggle`   |        |        |
| `<WorkoutLogger>` | 3 × 2                          | `sessionId`                      |        |        |
| `<GoalTracker>`   | 3 × 2                          | `goals[]`                        |        |        |
| `<VitalsCard>`    | 2 × 3 rows (right edge)        | `steps`, `calories`, `readiness` |        |        |
| `<EmberMic>`      | 96 px orb ▶ auto-centre bottom | `state` (idle                    | listen | speak) |

### Card Anatomy

1. **Border**: 1 px solid `var(--panel-border)`
2. **Fill**: `var(--panel-bg)` + blur
3. **Shadow**: `0 4px 24px rgba(0,0,0,0.25)`
4. **Padding**: 24 px inside

## 6  Ember Orb States

```
Idle       Listening        Speaking
 Cyan glow Orange glow      Wave-form bars
 low-poly   radial pulse     FFT bars height = dB
```

CSS custom property `--ember-progress` controls glow scale.

## 7  Motion & Animation

* **Cards**: `fade-in 450 ms cubic-bezier(.4,0,.2,1)` on mount.
* **Orb**: keyframe pulse (scale 1 ↔ 1.12, opacity .8 ↔ 1)
* **Wave-form**: CSS `clip-path` bars driven by realtime FFT.
* Use **Framer Motion** for route transitions.

## 8  Accessibility

* Color-contrast AAA on text > 18 pt.
* `prefers-reduced-motion` disables pulse & wave.
* All voice actions have matching keyboard shortcuts (⌥ F = focus mic, ⌘✔ = toggle task).

## 9  Responsive Patterns

* Below 1024 px: Cards stack 1-col, full-width.
* Orb shrinks to 64 px on mobile and docks bottom-centre.
* Background engine switches to static illustration on low-power.

## 10  Asset Library

* **Icons**: `phosphor-react` outline @ 24 px.
* **Illustrations**: SDXL prompts stored under `/assets/bg/…` with slug key `YYYY-MM-DD-HH`.
* **Sound**: `ember-wake.wav`, `ember-listen.wav`, `ember-speak.wav` (44.1 kHz, < 150 kB each).

---

**Version 0.3 – 2025-05-22**
