// Neon Bay — tuning constants, palette, missions and shop.
// One place for every number the game balances on, so a tweak
// here ripples through the whole city without touching logic.

export const WORLD = {
  size: 2400,
  half: 1200,
  roadGap: 160,
  roadWidth: 26,
  beachY: 2080,
  beachX0: 480,
  beachX1: 2100,
  seaY: 2240,
  buildingCount: 68,
  parkCount: 9,
  palmCount: 64,
  lampCount: 70,
  pedCount: 24,
  trafficCount: 14,
};

export const PALETTE = {
  skyTop: 0x2a1245,
  skyMid: 0x7c2d5e,
  skyLow: 0xff8c42,
  fog: 0x4a2358,
  ground: 0x1d3a24,
  asphalt: 0x23232b,
  sand: 0xc2a165,
  sea: 0x0e4d5c,
  roofPastel: [0xe2725b, 0xf2a65a, 0x7fb069, 0x6a8caf, 0xd989b5, 0x9b7ede, 0xe8c468],
  wallWarm: [0xc96f4a, 0xd9a05b, 0x8a9a5b, 0x7d8ca3, 0xb56576, 0x6d6875],
  neonPink: 0xff2e88,
  neonCyan: 0x22d3ee,
  neonAmber: 0xffb703,
};

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 260,
  driveAccel: 620,
  driveTop: 62,
  brake: 900,
  turnRate: 2.4,
  health: 100,
  punchReach: 34,
  punchCool: 0.45,
  pistolCool: 0.22,
  bulletSpeed: 900,
  bulletRange: 420,
  pistolDamage: 34,
  startMoney: 60,
  startAmmo: 24,
};

export const WANTED = {
  max: 5,
  heliAt: 3,
  decayPerSec: 0.05,
  hidePerSec: 0.35,
  punchHeat: 1,
  shootHeat: 1,
  stealHeat: 1,
  ramHeat: 1,
};

export const CARS = {
  playerColor: 0xff7a1a,
  policeColor: 0x10131a,
  policeRoof: 0xf4f6f8,
  civilianColors: [0x2ec4b6, 0xe71d73, 0xffd166, 0x4cc9f0, 0x80b918, 0xef476f, 0x9b5de5],
  trafficTop: 34,
  policeTop: 52,
  ramDamage: 12,
  wreckAt: 0,
};

export const MISSIONS = [
  { name: 'First Fare', giver: 'Mara Voss', goal: 'Pick up the singer at Hotel Palmera', seconds: 100, pay: 120 },
  { name: 'Hot Wheels', giver: 'Mara Voss', goal: 'Lift the coupe from Bayview Precinct', seconds: 110, pay: 180 },
  { name: 'Lose the Heat', giver: 'Mara Voss', goal: 'Make noise at Bay Trust Bank, then vanish', seconds: 150, pay: 220 },
  { name: 'Silent Partner', giver: 'Rico', goal: 'Deliver the package to the marina stage', seconds: 120, pay: 260 },
  { name: 'Bay Trust', giver: 'Mara Voss', goal: 'Crack the vault door at Bay Trust Bank', seconds: 160, pay: 320 },
  { name: 'Harbour Lights', giver: 'Rico', goal: 'Light the harbour beacons before dawn', seconds: 140, pay: 300 },
  { name: 'Payback', giver: 'Mara Voss', goal: 'Settle the score at Hotel Palmera', seconds: 170, pay: 380 },
  { name: 'Neon Crown', giver: 'Mara Voss', goal: 'Take the crown run along the beach road', seconds: 180, pay: 500 },
];

export const RANKS = ['UNKNOWN', 'WHEELMAN', 'DRIVER', 'HUSTLER', 'KINGPIN', 'NEON CROWN'];

export const SHOP_ITEMS = [
  { key: '1', label: 'Ammo +24', detail: 'Pistol rounds', price: 50 },
  { key: '2', label: 'Medkit', detail: 'Restore health', price: 60 },
  { key: '3', label: 'Repair', detail: 'Fix your car', price: 80 },
  { key: '4', label: 'Clean record', detail: 'Lose one star', price: 200 },
];

export const SHOP_POS = { x: 420, y: 1560, radius: 150 };

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  brake: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  shoulder: ['KeyQ'],
  pause: ['KeyP'],
  buy1: ['Digit1'],
  buy2: ['Digit2'],
  buy3: ['Digit3'],
  buy4: ['Digit4'],
};

export const SHOT_NAMES = ['start', 'play', 'chase', 'end'];
// Round 9: NEON BAY design pack integration point (see src/designs.js).
if (typeof window !== 'undefined') { (window.__NEON_POINTS__ = window.__NEON_POINTS__ || []).push('config.js'); }
