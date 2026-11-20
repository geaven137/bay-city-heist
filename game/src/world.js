import { CITY, PALETTE, PLAYER } from './config.js';

export const roadCentresX = [];
export const roadCentresY = [];
for (let x = CITY.pitch / 2; x < CITY.width; x += CITY.pitch) roadCentresX.push(x);
for (let y = CITY.pitch / 2; y < CITY.height; y += CITY.pitch) roadCentresY.push(y);

export function nearestCentre(list, value) {
  let best = list[0], bestD = Math.abs(value - best);
  for (const c of list) {
    const d = Math.abs(value - c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function isOnRoad(x, y) {
  return Math.abs(x - nearestCentre(roadCentresX, x)) <= CITY.road / 2
    || Math.abs(y - nearestCentre(roadCentresY, y)) <= CITY.road / 2;
}

export function isOnBeach(x, y) { return y >= CITY.beachY; }

export function atIntersection(x, y, radius = 46) {
  return Math.abs(x - nearestCentre(roadCentresX, x)) <= radius
    && Math.abs(y - nearestCentre(roadCentresY, y)) <= radius;
}

export function nearestIntersection(x, y) {
  return { x: nearestCentre(roadCentresX, x), y: nearestCentre(roadCentresY, y) };
}

export function laneOffset(axis, dir) {
  if (axis === 'x') return dir > 0 ? 16 : -16;
  return dir > 0 ? -16 : 16;
}

export function randomRoadPoint(random, x, y, minDist, maxDist) {
  for (let tries = 0; tries < 24; tries += 1) {
    const vertical = random() < 0.5;
    const cx = roadCentresX[Math.floor(random() * roadCentresX.length)];
    const cy = roadCentresY[Math.floor(random() * roadCentresY.length)];
    const px = vertical ? cx : random() * CITY.width;
    const py = vertical ? random() * CITY.height : cy;
    const d = Math.hypot(px - x, py - y);
    if (d >= minDist && d <= maxDist) return { x: px, y: py };
  }
  return { x: nearestCentre(roadCentresX, x), y: nearestCentre(roadCentresY, y) };
}

export function randomSidewalkPoint(random, x, y, radius = 500) {
  const cx = nearestCentre(roadCentresX, x + (random() - 0.5) * radius * 2);
  const cy = nearestCentre(roadCentresY, y + (random() - 0.5) * radius * 2);
  if (random() < 0.5) return { x: cx + CITY.road / 2 + 12, y: Math.max(40, Math.min(CITY.height - 40, y + (random() - 0.5) * radius)) };
  return { x: Math.max(40, Math.min(CITY.width - 40, x + (random() - 0.5) * radius)), y: cy + CITY.road / 2 + 12 };
}

function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export function resolveBuildingCollision(city, x, y, radius) {
  let px = x, py = y;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(px, b.x + b.w));
    const ny = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - nx, dy = py - ny, d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 === 0) { py = b.y - radius; continue; }
    const d = Math.sqrt(d2);
    px = nx + (dx / d) * radius;
    py = ny + (dy / d) * radius;
  }
  return { x: px, y: py };
}

export function hitsBuilding(city, x, y, radius) {
  return buildingAt(city, x, y) !== null
    || buildingAt(city, x - radius, y) !== null || buildingAt(city, x + radius, y) !== null
    || buildingAt(city, x, y - radius) !== null || buildingAt(city, x, y + radius) !== null;
}

function makeBuilding(random, bx, by, bw, bh, name) {
  const beachfront = by + bh >= CITY.beachY - 320;
  const color = PALETTE.building[Math.floor(random() * PALETTE.building.length)];
  const roof = beachfront
    ? PALETTE.pastel[Math.floor(random() * PALETTE.pastel.length)]
    : PALETTE.roof[Math.floor(random() * PALETTE.roof.length)];
  const hash = (bx * 31 + by * 17) % 100;
  return {
    x: bx + 14, y: by + 14, w: bw - 28, h: bh - 28,
    height: 22 + random() * 68, color, roof, name: name || null,
    neon: random() < 0.35, beachfront,
    facade: hash % 4, // 0 window grid, 1 shopfront, 2 strip, 3 balcony
    lit: 0.35 + (hash % 5) * 0.1, // fraction of windows lit at dusk
  };
}

export function createCity(random) {
  const buildings = [], parks = [];
  const named = [
    { key: 'hospital', w: 200, h: 140 }, { key: 'precinct', w: 180, h: 120 },
    { key: 'safehouse', w: 150, h: 110 }, { key: 'garage', w: 190, h: 120 },
    { key: 'hotel', w: 170, h: 130 }, { key: 'bank', w: 180, h: 120 },
  ];
  for (let j = 0; j < roadCentresY.length - 1; j += 1) {
    for (let i = 0; i < roadCentresX.length - 1; i += 1) {
      const bx = roadCentresX[i] + CITY.road / 2;
      const by = roadCentresY[j] + CITY.road / 2;
      const bw = CITY.block, bh = CITY.block;
      if (by + bh >= CITY.beachY) continue;
      const roll = random();
      if (roll < 0.14) {
        const trees = [];
        for (let t = 0; t < 7; t += 1) {
          trees.push({ x: bx + 24 + random() * (bw - 48), y: by + 24 + random() * (bh - 48), r: 12 + random() * 10 });
        }
        parks.push({ x: bx, y: by, w: bw, h: bh, trees });
        continue;
      }
      const spot = named.find((n) => {
        const c = CITY[n.key];
        return Math.abs(c.x - (bx + bw / 2)) < bw / 2 && Math.abs(c.y - (by + bh / 2)) < bh / 2;
      });
      if (spot) {
        const c = CITY[spot.key];
        const b = makeBuilding(random, bx, by, bw, bh, c.name);
        b.w = spot.w; b.h = spot.h;
        b.x = c.x - spot.w / 2; b.y = c.y - spot.h / 2;
        b.height = 46 + random() * 30;
        buildings.push(b);
        continue;
      }
      if (roll < 0.55) buildings.push(makeBuilding(random, bx, by, bw, bh, null));
      else {
        buildings.push(makeBuilding(random, bx, by, bw / 2 - 4, bh, null));
        buildings.push(makeBuilding(random, bx + bw / 2 + 4, by, bw / 2 - 4, bh, null));
      }
    }
  }
  const palms = [];
  for (let i = 0; i < 18; i += 1) {
    const h1 = ((i * 2654435761) % 1000) / 1000;
    const h2 = ((i * 40503) % 1000) / 1000;
    palms.push({ x: 120 + i * 170 + h1 * 60, y: CITY.beachY - 30 - h2 * 22, lean: h1 * Math.PI });
  }
  const hotel = buildings.find((b) => b.name === 'Hotel Palmera');
  if (hotel) { hotel.sign = 'HOTEL'; hotel.neon = true; }
  const downtown = buildings.filter((b) => !b.sign && b.neon && b.x > 900 && b.x < 2300 && b.y > 700 && b.y < 1700);
  if (downtown[0]) downtown[0].sign = 'BAR';
  if (downtown[1]) downtown[1].sign = 'TACOS';
  if (downtown[2]) downtown[2].sign = 'CAFE';
  if (downtown[3]) downtown[3].sign = 'PIZZA';
  const lamps = [];
  for (const cx of roadCentresX) {
    for (const cy of roadCentresY) {
      const h = ((cx * 13 + cy * 7) % 12) - 6;
      lamps.push({ x: cx + 38, y: cy + 38 + h });
    }
  }
  return { buildings, parks, palms, lamps, width: CITY.width, height: CITY.height };
}

export function createState(city, random) {
  return {
    city, time: 0, money: 60, health: PLAYER.health, ammo: PLAYER.startAmmo,
    wanted: 0, wantedPoints: 0, unseenTimer: 0,
    player: {
      x: CITY.safehouse.x, y: CITY.safehouse.y + 120, angle: -Math.PI / 2,
      onFoot: true, car: null, punchTimer: 0, shootTimer: 0,
      hurtTimer: 0, regenTimer: 0, moving: false, running: false,
    },
    cars: [], peds: [], bullets: [], particles: [],
    mission: null, missionsDone: 0, storyDone: false,
    camera: { x: CITY.safehouse.x, y: CITY.safehouse.y + 120, angle: -Math.PI / 2, fov: 1.15, shoulder: 0, shake: 0 },
    wasted: false, busted: false, endTimer: 0,
    stats: { carsStolen: 0, missionsDone: 0, shotsFired: 0, pedsDown: 0 },
    banner: null, // {text, sub, timer} — big centre message (mission, WASTED…)
    flash: 0, // red damage flash, 0..1
    sideJob: null, // repeatable taxi fare after the story
  };
}
