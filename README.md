# bay-city-heist

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/geaven137/bay-city-heist/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/geaven137/bay-city-heist/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

NEON BAY — an original open-world crime game that runs offline in a desktop browser. A third-person shooter (TPS) raycaster: drive a stolen car through a neon beach city, take jobs from Mara Voss, lose the cops, and survive the wanted level. Built with vanilla JavaScript + Canvas 2D — no libraries, no network, no external assets. Realistic rear-view cars, aim with dead zone + response curve + light aim assist, 3D-reading characters (MC, citizens, police, firefighter), and a living city (varied facades, road markings, streetlights, neon signs).

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

Controls: WASD move · mouse look · right-click aim · click shoot · E steal car · Q swap shoulder · P pause.

## How it is built

- `game/` — the game (static files, ES modules, seeded deterministic world)
- `game/src/` — world, vehicles, pedestrians, police, missions, combat, raycaster render, HUD
- `main.ts` — builds `dossier.json` for the make.fun entry
- `screenshots/` — the four entry screenshots (start, play, chase, end)

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
