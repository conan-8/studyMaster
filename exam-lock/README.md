# Exam Lock Animation

Self-contained recreation of a tablet "exam mode" locking animation in a single HTML file — no dependencies, no build step.

## What it does

1. A **Start** button sits on a recreated tablet home screen (status bar, clock, calendar widget, app grid, dock).
2. Clicking it triggers the lock sequence: a glowing padlock fades in small at center and scales up while the home screen blurs behind it; the shackle snaps shut mid-grow, then the whole lock zooms past the camera with a soft light wash.
3. The screen settles into a locked state (dimmed blur) showing a lock icon, "Device locked · Exam mode", and the **Start Exam** button. A **↺ Replay** button restarts the sequence.

## Usage

Open `index.html` in any modern browser. Everything (markup, styles, icons, animation) lives in the one file.

## Tuning

- Animation timing: `lockIn` / `shackleShut` / `flashFx` keyframes (all 1.35s) and the `setTimeout` reveal delay (1250ms).
- Shackle motion: `translateY` stops in `shackleShut` (`-22px` open, `-12px` closed/flush).
- Flash intensity: peak opacity in `flashFx` and the `#flash` gradient stops.
