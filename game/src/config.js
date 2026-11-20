// NEON BAY — every tuning number and design token in one place.
// Design tokens (design-frontend-backend §1): one palette, one type scale,
// 8px spacing. Dusk "golden hour turning to neon night": warm buildings,
// cool asphalt, neon pink/cyan accents. The viewport is a fixed 1280x720
// logical area; the world is much bigger and the camera follows the player.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The city: a grid of blocks. Roads are ROAD_W wide, blocks BLOCK apart. */
export const CITY = {
  width: 3200,
  height: 2400,
  pitch: 320, // road centre to road centre
  road: 64,
  block: 256,
  hospital: { x: 2880, y: 2080, name: 'St. Marina Hospital' },
  precinct: { x: 320, y: 320, name: 'Bayview Precinct' },
  safehouse: { x: 1600, y: 2080, name: 'Marina Safehouse' },
  garage: { x: 2560, y: 320, name: 'Rico’s Garage' },
  hotel: { x: 1600, y: 320, name: 'Hotel Palmera' },
  bank: { x: 1600, y: 1120, name: 'Bay Trust Bank' },
  beachY: 2240, // sand + water strip along the south edge
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 190,
  runSpeed: 280,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  punchCooldown: 0.35,
  pistolDamage: 34,
  pistolCooldown: 0.28,
  bulletSpeed: 760,
  bulletRange: 460,
  startAmmo: 24,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 160,
  turnRate: 2.6,
  handbrakeTurn: 3.6,
  drag: 0.55,
  trafficSpeed: 150,
  policeSpeed: 560,
  health: 100,
};

/** Aim feel (from the aim-settings video's principles, adapted to mouse): a small dead zone kills jitter, hip-fire turns faster than aiming, a */
export const AIM = {
  deadZone: 1.5, // px of mouse travel per frame ignored (jitter)
  hipSens: 0.0026, // rad per px, hip-fire (was 0.0022: too slow to track)
  aimSens: 0.0016, // rad per px, aiming (precision)
  curve: 1.12, // response-curve exponent on the look delta
  assistCone: 0.14, // rad (~8 deg) half-cone around the crosshair ray
  assistRange: 460, // world units, same as bullet range
  assistRate: 0.5, // rad/s max pull toward the target
};

export const WANTED = {
  maxStars: 5,
  stealCar: 1,
  hitPedestrian: 1,
  shoot: 1,
  killPedestrian: 2,
  decaySeconds: 9, // unseen this long: lose one star
  maxCops: 6,
  heliStars: 3, // Air One joins the chase at three stars
};

/** Eight story jobs (JOB 1/8 … JOB 8/8). The first five keep their order
 * and pay, so the patch kit's economy gate (job 5 needs $500) still lands. */
export const MISSIONS = [
  { id: 'fare', title: 'First Fare', giver: 'Mara Voss', reward: 150, time: 100 },
  { id: 'hotwheels', title: 'Hot Wheels', giver: 'Rico', reward: 300, time: 120 },
  { id: 'midnight', title: 'Midnight Run', giver: 'Mara Voss', reward: 250, time: 80 },
  { id: 'heat', title: 'Lose the Heat', giver: 'Mara Voss', reward: 400, time: 150 },
  { id: 'score', title: 'The Big Score', giver: 'Mara Voss', reward: 800, time: 240 },
  { id: 'harbour', title: 'Harbour Lights', giver: 'Mara Voss', reward: 500, time: 150 },
  { id: 'payback', title: 'Payback', giver: 'Rico', reward: 600, time: 180 },
  { id: 'crown', title: 'Neon Crown', giver: 'Mara Voss', reward: 1000, time: 300 },
];

/** Third-person camera heights (world units) for the 3D renderer. */
export const CAM3D = {
  eyeDrive: 52, eyeFoot: 40, eyeAim: 36,
  lookDrive: 12, lookFoot: 28, lookAim: 30,
  heliHeight: 170,
};

export const PALETTE = {
  backdrop: '#0d0f1a',
  grass: '#2e5d3f',
  park: '#356b47',
  sand: '#c2a878',
  water: '#1d4e6e',
  asphalt: '#2b2f3a',
  roadLine: '#d8c25a',
  sidewalk: '#5d6270',
  curb: '#7a7f8c',
  building: ['#e8a87c', '#d97b6c', '#7fb3d5', '#f2d492', '#9b7fb3', '#6b8e7a', '#e07a5f', '#81b29a'],
  roof: ['#8a5a44', '#6e4a5a', '#4a6a8a', '#8a7a4a', '#5a4a7a', '#4a6a5a'],
  pastel: ['#f7a8b8', '#a8e6cf', '#ffd3b6', '#a8d8ea', '#f9e79f'],
  neonPink: '#ff2e88',
  neonCyan: '#22d3ee',
  neonYellow: '#ffd23f',
  player: '#22d3ee',
  playerPants: '#1e2a3a',
  police: '#e8ecf2',
  policeDark: '#1a2a4a',
  traffic: ['#c0392b', '#2e86c1', '#f1c40f', '#7d3c98', '#16a085', '#e67e22', '#95a5a6', '#34495e'],
  ped: ['#f39c12', '#8e44ad', '#2ecc71', '#e74c3c', '#3498db', '#f1c40f', '#1abc9c', '#d35400'],
  text: '#f4f6fa',
  muted: '#aab2c5',
  money: '#7ee787',
  danger: '#ff5a5a',
  panel: 'rgba(13, 16, 28, 0.88)',
  panelEdge: '#22d3ee',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives (this browser only). */
export const SAVE_KEY = 'neon-bay.save.v1';
export const BEST_KEY = 'neon-bay.best.v1';
