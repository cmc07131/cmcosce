---
name: verify
description: Drive OSCE Gym's hands-on procedure benches (the battle-style screens a station opens with `perform`) in a real browser with Playwright, the way a player's finger does, and keep screenshots and the scored result as proof. Use after changing anything under src/game/<bench>/, src/game/bench/, or a station's perform option, and before saying a bench works.
---

# Verify a bench

The benches are where a player does a procedure by hand (the central line, the fascia iliaca block, the IO needle). A bench that typechecks and passes unit tests can still be unplayable: a step whose only control is an unlabelled drag, a button that never enables. This skill proves a bench by playing it.

## Launch

```bash
node scripts/verify/bench.mjs serve 8765
```

Ready when it prints `READY http://127.0.0.1:8765/`. Open `http://127.0.0.1:8765/?kind=<kind>`, where `<kind>` is a key of `PROCEDURES` in `src/game/procedures.ts` (`cvc`, `usblock`, `hare`, …). The page is one bench at phone width (400 px), built from the game's own components and stylesheet. The journeys below start and stop the harness themselves; set `VERIFY_URL` to reuse one that is already running, or `VERIFY_PORT` to change the port.

The harness exists because the full app (`npm run dev`, Vite and Tailwind) needs native binaries that some agent sandboxes cannot install. It stands in for Tailwind's utilities only (`scripts/verify/utilities.mjs`); everything else is the real code.

Teardown: the journeys stop the harness they start. If you started one by hand, stop that process (Ctrl-C, or kill its PID). Never kill node by name: the user may have `npm run dev` running.

## Doctor

```bash
node scripts/verify/bench.mjs doctor
```

Checks that `node_modules` is installed, esbuild runs on this platform, and Playwright resolves. Each failure prints its fix (`npm install`; `npm i -D playwright && npx playwright install chromium`).

## Drive

```bash
node scripts/verify/journeys/smoke.mjs          # every bench opens with no page error
node scripts/verify/journeys/central-line.mjs   # the central line done right, start to finish
```

Each prints `PASS` or `FAIL` and exits 0 or 1. Write a journey for a bench you change: copy `journeys/central-line.mjs`. `scripts/verify/lib.mjs` gives you `tap`, `drag`, `hold`, `swipe`, `twist` in a picture's own viewBox units, so coordinates come straight from the bench's SVG.

Rules for a journey:

- Act only through what a player can see: a labelled button (`data-testid`), a strip, a dial, or a picture. Never call a setter or reach into React state. If the journey needs a hidden gesture, the bench is wrong, not the journey.
- Where a bench has step checks (the central line's goals panel), a journey that does the step right must pass the check without the review opening. `central-line.mjs` records any stop as a failure.
- Assert the scored result (`window.__result.marks`), not just the last screen.

## Evidence

Each run writes `.verify/runs/<journey>-<time>/`: a screenshot per step and `result.json` (verdict, marks, faults, step-check stops, every page error). `.verify/` is git-ignored, so the evidence survives cleanup. Look at the screenshots, not only the verdict: a bench can score and still draw something wrong.

## Cleanup

`rm -rf .verify/bench` removes the build. Keep `.verify/runs/` until the user has seen what it proves.

## Feature map

See [features/README.md](features/README.md). The station side (walking to the manikin, the perform option opening the bench, marks reaching the debrief) is covered by `src/engine/playthrough.test.ts`, not by these journeys.
