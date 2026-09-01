# Looseleaf — design-language mockup

Full-product interactive mockup of the Looseleaf app (SAT + AP study system). One papery design language — sticky-note stats, washi-taped ruled panels, red-margin flashcards — applied across the whole target structure. All data is fake; everything is clickable.

## Files

- `index.html` — the app mockup. Views: Today, Practice, Zen mode, Simulator (SAT + AP with score reports), Decks, Mistakes & Saved, Skills & mastery, Stats, Exams. Deep-linkable via hash (`index.html#sim`, `#zen`, …). Three modes via the tabs top-right: Off-white / Warm black / Blueprint.
- `landing.html` — animated landing page (count-up 1400 → struck through → 1,600, AP 5, floating sticky notes). Links into `index.html`.

## Running

No build step — just open `index.html` in a browser (only external dependency is Google Fonts).

The "Launch simulator" buttons point at `bluebook-practice-test.html` beside `index.html`. That bundle already lives in this repo under `simulator/` and `bluebook-mockup/` — copy it next to `index.html` when running locally.
