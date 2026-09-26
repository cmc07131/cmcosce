# OSCE Gym

Phone-first pixel bay for HKCEM IEEM Part 2 OSCE revision. You walk the room, pick up the kit, and perform the station. The gold-standard words live in JSON packs. The engine does not know the medicine.

## Run

```bash
npm install
npm run dev
```

Dev server listens on `0.0.0.0:8080`. `startup.sh` starts the same command.

## Controls

Game Boy Color layout. Phone first; desktop works with the keyboard.

| Button | Phone | Keyboard |
| --- | --- | --- |
| Move | D-pad, or tap a tile to walk there | Arrows / WASD |
| A: talk, use, choose | A | Z / Enter / Space |
| B: back, close | B | X / Esc |
| START: bag, notes, hint, marks, sound, leave | START | M |
| SELECT: show NPC names | SELECT | Shift |

Sound is off by default. Turn it on from the title screen or the START menu.

## Look

The bay is drawn on a canvas at 16 px per tile and scaled up in whole steps. All art is original and drawn in code (`src/game/pixel/art.ts`). Hands-on procedures open in a battle-style frame.

Pack lines that start with `You:` or a cast name (`Nurse Wong: …`) show that speaker in the text box. Lines with no prefix are narration.

## The world map

`/world` is the overworld. The title screen's PLAY · CMC goes there.

- **CMC** is the starting town. CMC Hall is the gym board: badges earned, stations not done, and a teleport to any gym. The Shop is closed for now; coins are saved for it.
- **Gyms** follow the source document's framework: ATLS, ACLS/PALS, O&T, Medical, Surgical, O&G, Paedi, Counsel/History, Psychi, Disaster/Triage. A gym with no stations shows as under construction and lists the topics that will go there. Walk through a gym door to pick a station. Clearing every station in a gym earns its badge (a station clears when you claim its badge after the debrief).
- **Tall grass** starts a wild encounter on about one step in eight. A creature asks one single-best-answer flashcard. Right: coins (10, plus 5 per answer already in your streak, up to 30). Wrong: the answer, why, and the source. RUN always works. No hearts.
- **Saving** is in this browser's localStorage: coins, streak, cards seen, creatures beaten, stations cleared, where you stood.

The map is `content/world/world.json`, a text grid with a legend (`scripts/make-world.mjs` generated it; edit either). Tall-grass letters pick the deck: `a` ATLS, `c` ACLS/PALS, `o` O&G, `x` mixed. Decks are `content/cards/<deck>.json`: creatures, and cards with four options, the right one's index, why, and a source. Options are shuffled every time a card is shown. Cards you got wrong come back more often.

To add a station to a gym, put its packId in that gym's `packs` in world.json.

## Hands-on benches

A `perform` option opens a bench. Simple benches (`lift`, `cover`, …) grant the option's marks when the gesture is done. The IO bench (`perform: "io"`, `src/game/io/`) scores itself: it never blocks a mistake, grants only the marks earned at the bench, and saves each mistake to the session. The debrief lists them under PROCEDURE NOTES.

Each run gets a `seed`, so the randomised case (which leg is out, soft-tissue depth, marrow on aspiration, calf swelling) stays the same across reloads. The anatomy card and the leg are original drawings: `src/game/io/art.tsx`.

## Add a pack

Copy `content/packs/gym-1` to `content/packs/gym-2`. Change `packId`, then fill `marks`, `actions`, `goldPath`, and `sequenceRules`. Reload `/gym`. No engine change unless a new non-clinical field is required.

## Scoring

Doing an action that maps to a mark grants that mark immediately, even if the order is "wrong". The toast shows the examiner line (first clause if it is long) and the mark id. The strip keeps every earned id. The same id never toasts twice. Traps give a flavour line and score nothing. The clock is flavour: `00:00` does not end the station. Leave, the door handover, or an action with `endStation` goes to the debrief.

## Hint, gold path, sequence

`goldPath` is hint order only. START → HINT shows the `hint` string of the first gold-path action whose marks are not all earned. Nothing is painted on the map. When every gold-path mark is in, the hint is "Handover / leave when you are ready."

`sequenceRules` run on the debrief against the action log. Missing steps are missed marks, not sequence fails. A bad order is Pass or Caution. It never blocks the badge.

## Loot

Trolley and shelf actions are `kind: "kit"`. Confirm puts `grantsItems` into the inventory. An action or option with `requiresItems` stays grey until those items are in hand. A nurse line can grant the same items, so you are not stuck if you ask for the trolley instead of walking to it.

## Later gyms

Replace or add pack JSON only. Do not rewrite the engine unless the schema needs a new non-clinical field.
