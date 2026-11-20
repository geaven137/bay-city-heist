# bay-city-heist

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/geaven137/bay-city-heist/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/geaven137/bay-city-heist/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

NEON BAY — an original open-world crime game that runs offline in a desktop browser. Real 3D (Three.js, low-poly, golden hour): drive a stolen car through a neon beach city, take 8 jobs from Mara Voss, lose the cops and the Air One helicopter, and survive the wanted level. Built with vanilla JavaScript + vendored Three.js — no network, no external assets. Box-built 3D cars (wheels spin, body leans), procedural 3D characters (MC, citizens, police, firefighter), a living city (varied facades, road markings, zebra crossings, streetlights, neon signs, beach + sea), and a dense HUD (rank, police dispatch, weapon slots, radio, dialogue, minimap).

Round 4 adds the Palmera fleet — three aircraft on flyovers above a beach airstrip, four fire trucks, an ambulance and three motorcycles, all drivable — and a shop at Rico's Garage (ammo, medkit, car repair, clean record) so mission money has somewhere to go.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

Controls: WASD move · mouse look · right-click aim · click shoot · E steal car · Q swap shoulder · P pause · 1-4 buy at Rico's Garage.

## How it is built

- `game/` — the game (static files, ES modules, seeded deterministic world)
- `game/src/` — world, vehicles, pedestrians, police, missions, combat, fleet, shop, 3D render, HUD
- `main.ts` — builds `dossier.json` for the make.fun entry
- `screenshots/` — the four entry screenshots (start, play, chase, end)

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
