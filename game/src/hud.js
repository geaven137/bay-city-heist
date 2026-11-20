import { CITY, FONT, MISSIONS, PALETTE, VIEW } from './config.js';
import { HL } from './patchkit.js';
import { missionTarget } from './missions.js';
import { roadCentresX, roadCentresY } from './world.js';

const MINIMAP = { size: 176, margin: 16 };
const RANK_AT = [0, 2, 5, 8, 12];
const RANK_NAMES = ['UNKNOWN', 'WHEELMAN', 'FIXER', 'GHOST', 'LEGEND'];
const RADIO_SONGS = [
  'Midnight Drive — The Palms', 'Neon Skyline — Velvet Static',
  'Golden Hour — Marina Lights', 'Chrome Hearts — Bay City Kings',
  'Sunset Strip — The Voss Sisters',
];
const DIALOGUE = [
  'Kai. A singer needs a ride to the marina stage. Don’t scratch the paint — it isn’t yours.',
  'There’s an orange Comet parked uptown. Bring it to my garage. Quietly.',
  'A package at the safehouse. North docks. Fast. The cops change shifts at midnight.',
  'Make some noise at the bank, then vanish. I want zero stars on you.',
  'The vault crew is waiting. This is the one, Kai. Don’t get caught.',
  'The harbour lights are on. A crate needs to move before dawn.',
  'They took my cousin’s car. Get it back — and make them regret it.',
  'The crown job. The whole city is watching. Make it clean, make it ours.',
];

function text(ctx, value, x, y, size, color, align, bold) {
  ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}
function bar(ctx, x, y, w, h, ratio, color, back) {
  ctx.fillStyle = back || 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
}
function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(8,10,18,${alpha || 0.78})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(34,211,238,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

export function drawMinimap(ctx, state) {
  const size = MINIMAP.size, x0 = MINIMAP.margin, y0 = VIEW.height - size - MINIMAP.margin;
  const scale = size / Math.max(CITY.width, CITY.height);
  const cx = x0 + size / 2, cy = y0 + size / 2;
  ctx.fillStyle = 'rgba(10, 12, 20, 0.85)';
  ctx.beginPath(); ctx.arc(cx, cy, size / 2 + 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, size / 2 + 4, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x0, y0 + CITY.beachY * scale, size, size);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0, y0 + (CITY.beachY - 60) * scale, size, 60 * scale);
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = Math.max(1, CITY.road * scale);
  for (const rx of roadCentresX) {
    ctx.beginPath(); ctx.moveTo(x0 + rx * scale, y0); ctx.lineTo(x0 + rx * scale, y0 + size); ctx.stroke();
  }
  for (const ry of roadCentresY) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + ry * scale); ctx.lineTo(x0 + size, y0 + ry * scale); ctx.stroke();
  }
  ctx.fillStyle = '#8a7a5a';
  for (const b of state.city.buildings) {
    ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x0 + wx * scale, y0 + wy * scale, r || 3, 0, Math.PI * 2); ctx.fill();
  };
  const target = state.sideJob && !state.mission
    ? (state.sideJob.stage === 'pickup' ? state.sideJob.pickup : state.sideJob.drop)
    : (missionTarget(state) ? { x: missionTarget(state).x, y: missionTarget(state).y } : null);
  if (target) {
    ctx.fillStyle = PALETTE.neonYellow;
    ctx.save();
    ctx.translate(x0 + target.x * scale, y0 + target.y * scale);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  for (const car of state.cars) {
    if (car.kind === 'police') dot(car.x, car.y, '#ff5a5a', 3);
    else if (car.kind !== 'player') dot(car.x, car.y, '#e8ecf2', 2);
  }
  if (state.wanted >= 3) dot(state.player.x + 150, state.player.y - 100, '#ffd23f', 4);
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  ctx.save();
  ctx.translate(x0 + px * scale, y0 + py * scale);
  ctx.rotate(p.car ? p.car.angle : p.angle);
  ctx.fillStyle = PALETTE.neonCyan;
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  text(ctx, 'NEON BAY', x0, y0 - 8, 13, PALETTE.muted, 'left', true);
}

function drawDispatch(ctx, state) {
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const units = [];
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const d = Math.hypot(car.x - px, car.y - py);
    const tactic = car.roadblock ? 'ROADBLOCK' : (d < 160 && Math.abs(car.speed) > 120 ? 'RAMMING' : 'PURSUIT');
    units.push({ name: `UNIT ${String(car.id).padStart(2, '0')}`, d, tactic });
  }
  units.sort((a, b) => a.d - b.d);
  if (state.wanted >= 3) units.splice(1, 0, { name: 'AIR ONE', d: 180, tactic: 'SPOTLIGHT' });
  const list = units.slice(0, 4);
  if (list.length === 0) return;
  const x = VIEW.width - 268, y = 84;
  panel(ctx, x, y, 244, 24 + list.length * 22);
  text(ctx, 'BAYVIEW DISPATCH', x + 10, y + 17, 12, PALETTE.neonCyan, 'left', true);
  list.forEach((u, i) => {
    const yy = y + 40 + i * 22;
    text(ctx, u.name, x + 10, yy, 13, PALETTE.text, 'left', true);
    text(ctx, `${Math.round(u.d)}m`, x + 108, yy, 13, PALETTE.muted, 'left');
    text(ctx, u.tactic, x + 234, yy, 12, u.tactic === 'RAMMING' ? '#ff5a5a' : u.tactic === 'ROADBLOCK' ? '#ffd23f' : PALETTE.neonYellow, 'right', true);
  });
}

function drawWeapons(ctx, state, speedKmh) {
  const slots = ['FISTS', 'PISTOL', 'SMG', 'SHOTGUN', 'RIFLE'];
  const cur = HL.Weapons.drawn(state) ? 1 : 0;
  const x0 = VIEW.width - 268, y0 = VIEW.height - 96;
  slots.forEach((s, i) => {
    const x = x0 + i * 50;
    const live = i <= 1;
    panel(ctx, x, y0, 44, 34, i === cur ? 0.92 : 0.6);
    if (i === cur) { ctx.strokeStyle = PALETTE.neonCyan; ctx.lineWidth = 2; ctx.strokeRect(x, y0, 44, 34); }
    text(ctx, live ? s.slice(0, 4) : '—', x + 22, y0 + 22, 12, live ? PALETTE.text : 'rgba(170,178,197,0.4)', 'center', i === cur);
  });
  text(ctx, 'PISTOL', VIEW.width - 24, VIEW.height - 118, 13, PALETTE.muted, 'right', true);
  text(ctx, `${state.ammo}`, VIEW.width - 24, VIEW.height - 104, 22, state.ammo > 0 ? PALETTE.text : '#ff5a5a', 'right', true);
  if (speedKmh !== null) {
    text(ctx, `${Math.round(speedKmh)}`, VIEW.width - 24, VIEW.height - 168, 44, PALETTE.text, 'right', true);
    text(ctx, 'km/h', VIEW.width - 24, VIEW.height - 144, 15, PALETTE.muted, 'right');
  }
}

function drawCompass(ctx, state) {
  const stage = state.mission ? missionTarget(state) : null;
  const cx = VIEW.width / 2, cy = 96, half = 170;
  ctx.fillStyle = 'rgba(8,10,18,0.6)';
  ctx.fillRect(cx - half, cy - 13, half * 2, 26);
  const ang = state.camera.angle ?? -Math.PI / 2;
  const marks = [[0, 'E'], [Math.PI / 2, 'S'], [Math.PI, 'W'], [-Math.PI / 2, 'N']];
  for (const [b, label] of marks) {
    let d = b - ang;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const x = cx + (d / (Math.PI / 2)) * half;
    if (x < cx - half + 8 || x > cx + half - 8) continue;
    text(ctx, label, x, cy + 5, 14, Math.abs(d) < 0.15 ? PALETTE.neonYellow : PALETTE.muted, 'center', true);
  }
  if (stage) {
    const p = state.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    let d = Math.atan2(stage.y - py, stage.x - px) - ang;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const x = cx + Math.max(-1, Math.min(1, d / (Math.PI / 2))) * half;
    ctx.fillStyle = PALETTE.neonYellow;
    ctx.save(); ctx.translate(x, cy + 5); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore();
  }
}

let dlgIdx = -1;
let dlgUntil = 0;
function drawDialogue(ctx, state, time) {
  if (!state.mission) { dlgIdx = -1; return; }
  if (state.mission.index !== dlgIdx) {
    dlgIdx = state.mission.index;
    dlgUntil = time + 6;
  }
  if (time > dlgUntil) return;
  const giver = state.mission.def.giver;
  const initials = giver === 'Mara Voss' ? 'MV' : 'R';
  const color = giver === 'Mara Voss' ? PALETTE.neonPink : '#e67e22';
  const line = DIALOGUE[state.mission.index] || '';
  const x = 24, y = VIEW.height - 268;
  panel(ctx, x, y, 420, 64);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x + 32, y + 32, 22, 0, Math.PI * 2); ctx.fill();
  text(ctx, initials, x + 32, y + 39, 16, '#ffffff', 'center', true);
  text(ctx, giver, x + 64, y + 24, 14, PALETTE.neonYellow, 'left', true);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `15px ${FONT}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const words = line.split(' ');
  let row = '', yy = y + 44;
  for (const w of words) {
    if ((row + ' ' + w).length > 52) { ctx.fillText(row, x + 64, yy); row = w; yy += 17; }
    else row = row ? row + ' ' + w : w;
  }
  if (row) ctx.fillText(row, x + 64, yy);
}

export function drawHud(ctx, state, speedKmh) {
  text(ctx, `$${state.money}`, 24, 44, 34, PALETTE.money, 'left', true);
  bar(ctx, 24, 56, 220, 14, state.health / 100, state.health > 30 ? '#7ee787' : '#ff5a5a');
  text(ctx, `HP ${Math.ceil(state.health)}`, 24, 92, 15, PALETTE.text, 'left');
  const tier = HL.Profile.tier();
  const score = HL.Profile.score;
  const cur = RANK_AT[tier];
  const nxt = RANK_AT[tier + 1];
  const prog = nxt === undefined ? 1 : (score - cur) / (nxt - cur);
  text(ctx, `RANK: ${HL.Profile.name().toUpperCase()}`, 24, 114, 14, PALETTE.neonCyan, 'left', true);
  bar(ctx, 24, 122, 220, 8, prog, PALETTE.neonCyan);
  text(ctx, nxt === undefined ? 'MAX RANK' : `${score}/${nxt} rep to ${RANK_NAMES[tier + 1]}`, 24, 148, 12, PALETTE.muted, 'left');
  text(ctx, `JOBS ${state.missionsDone}/${MISSIONS.length}`, 24, 168, 12, PALETTE.muted, 'left', true);
  const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
  text(ctx, stars, VIEW.width - 24, 44, 30, state.wanted > 0 ? '#ff5a5a' : 'rgba(244,246,250,0.35)', 'right', true);
  text(ctx, state.wanted > 0 ? 'WANTED' : 'CLEAN', VIEW.width - 24, 70, 14, state.wanted > 0 ? '#ff5a5a' : PALETTE.muted, 'right', true);
  drawDispatch(ctx, state);
  const stage = state.mission ? missionTarget(state) : null;
  if (stage) {
    const remain = Math.max(0, Math.ceil(state.mission.timer));
    text(ctx, `JOB ${state.mission.index + 1}/${MISSIONS.length} — ${state.mission.text}`, VIEW.width / 2, 40, 20, PALETTE.neonYellow, 'center', true);
    text(ctx, `${stage.label}  •  ${remain}s`, VIEW.width / 2, 66, 16, PALETTE.text, 'center');
    drawCompass(ctx, state);
  } else if (state.sideJob) {
    const job = state.sideJob;
    text(ctx, `Taxi fare — $${job.fare}`, VIEW.width / 2, 40, 20, PALETTE.neonYellow, 'center', true);
    text(ctx, job.stage === 'pickup' ? 'Pick up the rider' : 'Drop the rider off', VIEW.width / 2, 66, 16, PALETTE.text, 'center');
  } else if (state.storyDone) {
    text(ctx, 'Free roam — taxi fares keep coming, the city is yours', VIEW.width / 2, 40, 16, PALETTE.muted, 'center');
  } else {
    text(ctx, 'New job waiting at the Marina Safehouse — drive there', VIEW.width / 2, 40, 16, PALETTE.muted, 'center');
  }
  if (state._hlRetry) text(ctx, 'Job failed — press R to retry from the checkpoint', VIEW.width / 2, 92, 16, PALETTE.neonYellow, 'center', true);
  const song = RADIO_SONGS[Math.floor(state.time / 25) % RADIO_SONGS.length];
  text(ctx, `NEON FM 88.5  •  ${song}`, VIEW.width / 2, VIEW.height - 16, 13, PALETTE.muted, 'center');
  if (speedKmh !== null) {
    text(ctx, 'W/S gas • A/D steer • SHIFT handbrake • E exit', VIEW.width / 2, VIEW.height - 40, 14, PALETTE.muted, 'center');
  } else {
    text(ctx, 'WASD move • MOUSE look • RIGHT-CLICK aim • CLICK shoot • Q swap shoulder • E steal car', VIEW.width / 2, VIEW.height - 40, 14, PALETTE.muted, 'center');
  }
  drawWeapons(ctx, state, speedKmh);
  drawMinimap(ctx, state);
  drawDialogue(ctx, state, state.time);
  if (stage) {
    const p = state.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    const dx = stage.x - px, dy = stage.y - py, dist = Math.hypot(dx, dy);
    if (dist > 420) {
      const ang = Math.atan2(dy, dx);
      const cx = Math.max(70, Math.min(VIEW.width - 70, VIEW.width / 2 + Math.cos(ang) * 180));
      const cy = Math.max(112, 120 + Math.sin(ang) * 80);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = PALETTE.neonYellow;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
      text(ctx, `${Math.round(dist)}m`, cx, cy + 26, 13, PALETTE.neonYellow, 'center', true);
    }
  }
  if (state.banner && state.banner.timer > 0) {
    const alpha = Math.min(1, state.banner.timer);
    const measure = (value, size) => (typeof ctx.measureText === 'function'
      ? ctx.measureText(value).width
      : value.length * size * 0.58);
    ctx.font = `700 44px ${FONT}`;
    const wTitle = measure(state.banner.text, 44);
    let wSub = 0;
    if (state.banner.sub) {
      ctx.font = `22px ${FONT}`;
      wSub = measure(state.banner.sub, 22);
    }
    const bw = Math.ceil(Math.max(wTitle, wSub)) + 56;
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = 'rgba(8,10,18,0.78)';
    ctx.fillRect(VIEW.width / 2 - bw / 2, 232, bw, 102);
    ctx.globalAlpha = alpha;
    text(ctx, state.banner.text, VIEW.width / 2, 278, 44, PALETTE.text, 'center', true);
    if (state.banner.sub) text(ctx, state.banner.sub, VIEW.width / 2, 314, 22, PALETTE.neonYellow, 'center');
    ctx.globalAlpha = 1;
  }
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 40, 40, ${state.flash * 0.25})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}

export function drawCrosshair(ctx, state) {
  const p = state.player;
  if (!p.onFoot) return;
  const cx = VIEW.width / 2, cy = VIEW.height / 2;
  const spread = 6 + (p.shootTimer > 0 ? 14 : 0) + (p.moving ? 5 : 0) - (p.assist ? 2 : 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = state.ammo > 0 ? '#f4f6fa' : '#ff5a5a';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
  if (!p.aiming) return;
  ctx.strokeStyle = p.assist ? PALETTE.neonYellow : '#f4f6fa';
  ctx.lineWidth = 2;
  const arm = 9;
  ctx.beginPath();
  ctx.moveTo(cx - spread - arm, cy); ctx.lineTo(cx - spread, cy);
  ctx.moveTo(cx + spread, cy); ctx.lineTo(cx + spread + arm, cy);
  ctx.moveTo(cx, cy - spread - arm); ctx.lineTo(cx, cy - spread);
  ctx.moveTo(cx, cy + spread); ctx.lineTo(cx, cy + spread + arm);
  ctx.stroke();
}
