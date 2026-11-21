// Neon Bay — eight story jobs from Mara Voss and Rico.
// Each job is a drive: reach the marker before the clock runs
// out. Finishing one pays, builds reputation and opens the next.
// Lose the Heat is the exception: it ends when the stars do.

import { MISSIONS, RANKS } from './config.js';
import { showBanner } from './police.js';

const SPOTS = [
  { x: 640, y: 1180, label: 'Hotel Palmera' },
  { x: -720, y: -420, label: 'Bayview Precinct' },
  { x: 880, y: -640, label: 'Bay Trust Bank' },
  { x: 1560, y: 2080, label: 'Marina Stage' },
  { x: 880, y: -640, label: 'Bay Trust Bank' },
  { x: 1880, y: 2080, label: 'Harbour Beacons' },
  { x: 640, y: 1180, label: 'Hotel Palmera' },
  { x: 1980, y: 2080, label: 'Beach Road East' },
];

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return;
  state.missionIndex = index;
  state.missionTimer = def.seconds;
  state.missionTarget = SPOTS[index];
  state.missionStage = 0;
  showBanner(state, 'JOB ' + (index + 1) + '/8 — ' + def.name, def.giver + ': ' + def.goal);
  state.talk = {
    name: 'Mara Voss',
    text: missionBrief(index),
    timer: 6,
  };
}

function missionBrief(index) {
  const lines = [
    'Kai. A singer needs a ride to the marina stage. Don\u2019t scratch the paint — it isn\u2019t yours.',
    'There\u2019s a coupe parked behind the precinct. Take it. Quietly.',
    'Make some noise at the bank, then vanish. I want zero stars on you.',
    'The package goes to the marina stage. No stops, no questions.',
    'The vault door at Bay Trust. You know what to do.',
    'Light the harbour beacons before dawn, or the whole run is blind.',
    'They took what was ours at the Palmera. Go and settle it.',
    'One last run down the beach road. Take the crown, Kai.',
  ];
  return lines[index] || 'Drive.';
}

export function stepMissions(state, dt) {
  if (state.missionIndex < 0 || state.missionIndex >= MISSIONS.length) return;
  if (state.end) return;
  const def = MISSIONS[state.missionIndex];
  state.missionTimer -= dt;
  if (state.missionTimer <= 0) {
    failMission(state);
    return;
  }
  const p = state.player;
  const t = state.missionTarget;
  if (!t) return;
  // Lose the Heat completes when the wanted level clears.
  if (state.missionIndex === 2) {
    if (state.wanted === 0 && state.heat <= 0.01) {
      completeMission(state);
    }
    return;
  }
  const d = Math.hypot(p.x - t.x, p.y - t.y);
  state.missionDist = Math.round(d);
  if (d < 46) {
    completeMission(state);
  }
}

function completeMission(state) {
  const def = MISSIONS[state.missionIndex];
  state.money += def.pay;
  state.rep += 1;
  state.jobsDone += 1;
  const rankAt = Math.min(RANKS.length - 1, Math.floor(state.rep / 2));
  state.rankIndex = rankAt;
  showBanner(state, 'JOB DONE — ' + def.name, '+$' + def.pay + '  •  ' + RANKS[rankAt]);
  state.stats.missionsDone += 1;
  const next = state.missionIndex + 1;
  if (next < MISSIONS.length) {
    state.missionIndex = next;
    state.missionTimer = MISSIONS[next].seconds;
    state.missionTarget = SPOTS[next];
    state.talk = { name: 'Mara Voss', text: missionBrief(next), timer: 6 };
  } else {
    state.missionIndex = MISSIONS.length;
    state.missionTarget = null;
    state.talk = { name: 'Mara Voss', text: 'That\u2019s the whole set, Kai. Neon Bay is yours.', timer: 8 };
  }
}

function failMission(state) {
  showBanner(state, 'JOB FAILED', 'The clock ran out. Try again.');
  startMission(state, state.missionIndex);
}

export function missionMarker(state) {
  if (!state.missionTarget) return null;
  return state.missionTarget;
}
// Round 9: NEON BAY design pack integration point (see src/designs.js).
if (typeof window !== 'undefined') { (window.__NEON_POINTS__ = window.__NEON_POINTS__ || []).push('missions.js'); }
