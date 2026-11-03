# Hip examination (station ot-hip, a focused 3D examination)

## Sub-features

Walk; Trendelenburg test (stands on the right leg, then the left); inspect; true and apparent leg lengths with a tape; temperature both hips; trochanter and groin; passive flexion; rotation at 90/90; abduction and adduction with the pelvis steadied; Thomas test; the knee, foot pulses, light touch.

## How to get to it (user POV)

Station `ot-hip` → Mr Ho → "Examine the hip". In the harness: `?exam=ot/ot-hip` (any station's exam step opens this way: `?exam=<gym>/<id>`).

## Driving it with Playwright

`node scripts/verify/journeys/exam.mjs ot/ot-hip`. Each manoeuvre is a button `exam3d-m-<focus entry>` (e.g. `exam3d-m-thomas@hip-R`); it is disabled while the animation plays. Items found reach `window.__picked`; the station's exam options are in `window.__options`. Two screenshots per manoeuvre, 0.9 s and 2 s in.

## Gotchas

- The 3D needs WebGL: `openExam` launches Chromium with SwiftShader.
- Build with `VERIFY_DEV=1 node scripts/verify/bench.mjs build` to get `window.__exam` (the ExamScene) for probing poses, joint angles and where things project on screen.
- The leg-length tape is laid over the skin by raycasting down onto the body: landmarks (`siteWorld`) sit on the bone, so anything drawn straight between them is hidden inside the leg.
- Standing on one leg, the camera swings to the side of the lifted leg; from straight in front the lifted knee points at you and cannot be seen.
