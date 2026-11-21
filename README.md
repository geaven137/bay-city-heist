# NEON BAY

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/geaven137/bay-city-heist/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/geaven137/bay-city-heist/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game that runs offline in a desktop browser. You are Kai Reyes, a driver with no money and a fast car to steal, working jobs for Mara Voss across St. Marina — a sun-soaked coastal city after dark.

## Play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static server, e.g. `node serve.ts` and visit http://localhost:8080). No network needed; everything is local.

- **On foot:** WASD to move, mouse to look, E to steal a car, click to punch or shoot, F to swap weapon, Q to swap shoulder, right-click to aim.
- **Driving:** W/S gas and brake, A/D steer, SHIFT handbrake, E to get out.
- **Wanted:** crimes seen by a witness raise the stars. Police chase you; at three stars the helicopter Air One comes up with a spotlight.
- **Missions:** eight story jobs from Mara Voss and Rico, from First Fare to Neon Crown. Finishing jobs pays and builds your rank.
- **Shop:** walk into Rico's Garage to buy ammo, a medkit, a repair or a clean record (keys 1–4).

## What is inside

- A procedural 3D city: grid streets, a beach road along the sea, pastel-roofed towers, palms, lamps, parks and a beach airstrip.
- The Palmera fleet: three planes on flyovers, four fire trucks, an ambulance and three motorcycles as traffic.
- A dense HUD: money, health, rank and reputation, mission and compass, wanted stars with a Bayview Dispatch board, a round minimap, speed and weapon slots, radio NEON FM 88.5.
- Save and load in the browser, procedural audio, particles, and screenshot staging for the four cover shots.

## Build

The game is plain static files under `game/` (Three.js r158 vendored as `game/vendor/three.min.js`). `main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.

Entry for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

## Round 9 — NEON BAY design pack
98 designs (20 vehicles, 10 characters, 7 NPCs, 34 buildings, 27 weapons) in `game/src/designs*.js`; view each at `game/designs.html?design=<id>`.
