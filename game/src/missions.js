import { CITY, MISSIONS } from './config.js';
import { HL } from './patchkit.js';
import { makeCar } from './vehicles.js';
import { randomRoadPoint, randomSidewalkPoint } from './world.js';

HL.Economy.gate[7] = 1500;

export const STAGE_GOTO = 'goto';
export const STAGE_PICKUP = 'pickup';
export const STAGE_DELIVER = 'deliver';
export const STAGE_ESCAPE = 'escape';
export const STAGE_WAIT = 'wait';

export function missionStages(random, index) {
  const H = CITY.hotel, G = CITY.garage, B = CITY.bank, S = CITY.safehouse;
  switch (index) {
    case 0: return [
      { type: STAGE_PICKUP, x: H.x, y: H.y + 160, label: 'Pick up the singer at Hotel Palmera', radius: 46 },
      { type: STAGE_DELIVER, x: 480, y: 1760, label: 'Drop her at the marina stage', radius: 46 },
    ];
    case 1: {
      const carSpot = randomRoadPoint(random, CITY.garage.x, CITY.garage.y, 200, 500);
      return [
        { type: STAGE_GOTO, x: carSpot.x, y: carSpot.y, label: 'Find the orange Comet parked uptown', radius: 60, specialCar: true },
        { type: STAGE_DELIVER, x: G.x, y: G.y + 150, label: 'Bring the Comet to Rico’s Garage', radius: 56, needsCar: true },
      ];
    }
    case 2: return [
      { type: STAGE_PICKUP, x: S.x, y: S.y + 120, label: 'Collect the package at the safehouse', radius: 46 },
      { type: STAGE_DELIVER, x: 2880, y: 480, label: 'Deliver it to the north docks — fast', radius: 46 },
    ];
    case 3: return [
      { type: STAGE_GOTO, x: B.x, y: B.y + 160, label: 'Make some noise at Bay Trust Bank', radius: 60, makeNoise: true },
      { type: STAGE_ESCAPE, x: 0, y: 0, label: 'Lose the cops — get to zero stars', radius: 0 },
    ];
    case 4: return [
      { type: STAGE_PICKUP, x: 480, y: 480, label: 'Pick up the crew at the precinct corner', radius: 46 },
      { type: STAGE_GOTO, x: B.x, y: B.y + 160, label: 'Drive the crew to Bay Trust Bank', radius: 56, needsCar: true },
      { type: STAGE_WAIT, x: B.x, y: B.y + 160, label: 'Hold the street while they work — 20s', radius: 80, wait: 20 },
      { type: STAGE_DELIVER, x: S.x, y: S.y + 120, label: 'Get the crew home to the safehouse', radius: 56, needsCar: true },
    ];
    case 5: return [
      { type: STAGE_PICKUP, x: 480, y: 1760, label: 'Collect the crate at the marina stage', radius: 46 },
      { type: STAGE_DELIVER, x: 2560, y: 2080, label: 'Deliver it to the beach bar before dawn', radius: 46 },
    ];
    case 6: return [
      { type: STAGE_PICKUP, x: 480, y: 480, label: 'Pick up Rico’s cousin at the precinct corner', radius: 46 },
      { type: STAGE_GOTO, x: B.x, y: B.y + 160, label: 'Drive him to Bay Trust Bank', radius: 56, needsCar: true },
      { type: STAGE_WAIT, x: B.x, y: B.y + 160, label: 'Hold the street while he settles it — 15s', radius: 80, wait: 15 },
      { type: STAGE_DELIVER, x: G.x, y: G.y + 150, label: 'Drop him at Rico’s Garage', radius: 56, needsCar: true },
    ];
    case 7: return [
      { type: STAGE_PICKUP, x: S.x, y: S.y + 120, label: 'Pick up the crew at the safehouse', radius: 46 },
      { type: STAGE_GOTO, x: B.x, y: B.y + 160, label: 'Drive the crew to Bay Trust Bank', radius: 56, needsCar: true },
      { type: STAGE_WAIT, x: B.x, y: B.y + 160, label: 'Hold the street while they work — 20s', radius: 80, wait: 20 },
      { type: STAGE_DELIVER, x: H.x, y: H.y + 160, label: 'Get the crew to Hotel Palmera', radius: 56, needsCar: true },
      { type: STAGE_ESCAPE, x: 0, y: 0, label: 'Lose the cops — get to zero stars', radius: 0 },
    ];
    default: return [];
  }
}

export function startMission(state, random, index) {
  const def = MISSIONS[index];
  state.mission = {
    index, def, stages: missionStages(random, index), stageIndex: 0, timer: def.time,
    text: `${def.title} — ${def.giver}`,
    specialCar: null, waitTimer: 0, started: false,
  };
  state.banner = { text: def.title, sub: `New job from ${def.giver} — $${def.reward}`, timer: 3 };
  return state.mission;
}

export function currentStage(state) {
  if (!state.mission) return null;
  return state.mission.stages[state.mission.stageIndex] || null;
}

export function missionTarget(state) {
  const stage = currentStage(state);
  if (!stage) return null;
  return { x: stage.x, y: stage.y, label: stage.label };
}

export function startSideJob(state, random) {
  const pickup = randomSidewalkPoint(random, state.player.x, state.player.y, 700);
  const drop = randomSidewalkPoint(random, pickup.x, pickup.y, 900);
  const fare = 40 + Math.floor(random() * 80);
  state.sideJob = { pickup, drop, fare, stage: 'pickup', timer: 120 };
  state.banner = { text: 'Taxi fare', sub: `Pick up a rider — $${fare}`, timer: 2.5 };
  return state.sideJob;
}

function completeMission(state) {
  const m = state.mission;
  const reward = Math.round(m.def.reward * HL.Profile.rewardMult());
  state.money += reward;
  state.missionsDone += 1;
  state.stats.missionsDone += 1;
  state.banner = { text: 'JOB DONE', sub: `+$${reward} — ${m.def.title}`, timer: 3 };
  state.mission = null;
  if (state.missionsDone >= MISSIONS.length) {
    state.storyDone = true;
    state.banner = { text: 'NEON BAY — STORY COMPLETE', sub: HL.Profile.ending(), timer: 4 };
  }
}

function failMission(state, reason) {
  state.mission = null;
  state.banner = { text: 'JOB FAILED', sub: reason, timer: 3 };
}

export function updateMission(state, dt, random, addWanted) {
  const m = state.mission;
  if (!m) return;
  m.timer -= dt;
  if (m.timer <= 0) { failMission(state, 'Out of time'); return; }
  const stage = currentStage(state);
  if (!stage) { completeMission(state); return; }
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;

  if (!m.started) {
    m.started = true;
    if (stage.specialCar) {
      const car = makeCar(random, stage.x, stage.y, 0, 'traffic', '#e67e22');
      car.targetSpeed = 0;
      car.special = true;
      state.cars.push(car);
      m.specialCar = car;
    }
    if (stage.makeNoise) addWanted(2, px, py, 'alarm');
  }

  const dist = Math.hypot(px - stage.x, py - stage.y);
  if (stage.type === STAGE_WAIT) {
    if (dist < stage.radius) {
      m.waitTimer += dt;
      if (m.waitTimer >= stage.wait) {
        m.stageIndex += 1;
        m.waitTimer = 0;
        state.banner = { text: 'Go!', sub: 'Get out of there', timer: 2 };
      }
    } else m.waitTimer = 0;
    return;
  }
  if (stage.type === STAGE_ESCAPE) {
    if (state.wanted === 0) {
      m.stageIndex += 1;
      state.banner = { text: 'Clean', sub: 'They lost you', timer: 2 };
    }
    return;
  }
  if (stage.needsCar && p.onFoot) return;
  if (dist < stage.radius) {
    if (stage.type === STAGE_PICKUP || stage.type === STAGE_GOTO) {
      state.banner = { text: 'Picked up', sub: stage.label, timer: 1.6 };
    }
    m.stageIndex += 1;
    if (m.stageIndex >= m.stages.length) completeMission(state);
  }
}

export function nextMissionIndex(state) {
  return state.missionsDone < MISSIONS.length ? state.missionsDone : null;
}

export function tryStartNextMission(state, random) {
  const idx = nextMissionIndex(state);
  if (idx === null || state.mission) return false;
  if (!HL.Economy.canStart(idx, state.money)) {
    state.banner = { text: 'Need $' + HL.Economy.need(idx), sub: 'Fund the crew before this job', timer: 3 };
    return false;
  }
  startMission(state, random, idx);
  return true;
}
