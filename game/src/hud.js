// NEON BAY — the HUD and the minimap.
// Readable at a glance when shrunk: cash top-left, health under it, wanted
// stars top-right, mission text top-centre, speed bottom-left while driving,
// and a square minimap bottom-right with roads, the player, police, traffic
// and the mission marker. A compass arrow points at the mission target.
import { CITY, FONT, PALETTE, VIEW } from './config.js';
import { missionTarget } from './missions.js';
import { roadCentresX, roadCentresY } from './world.js';

const MINIMAP = { size: 196, margin: 16 };

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

/** Draw the minimap: the whole city shrunk, with the player at its centre. */
export function drawMinimap(ctx, state) {
  const size = MINIMAP.size;
  const x0 = VIEW.width - size - MINIMAP.margin;
  const y0 = VIEW.height - size - MINIMAP.margin;
  const scale = size / Math.max(CITY.width, CITY.height);
  ctx.fillStyle = 'rgba(10, 12, 20, 0.85)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // Water + sand along the south edge.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x0, y0 + CITY.beachY * scale, size, size);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0, y0 + (CITY.beachY - 60) * scale, size, 60 * scale);
  // Roads.
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = Math.max(1, CITY.road * scale);
  for (const cx of roadCentresX) {
    ctx.beginPath(); ctx.moveTo(x0 + cx * scale, y0); ctx.lineTo(x0 + cx * scale, y0 + size); ctx.stroke();
  }
  for (const cy of roadCentresY) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + cy * scale); ctx.lineTo(x0 + size, y0 + cy * scale); ctx.stroke();
  }
  // Buildings as dots.
  ctx.fillStyle = '#8a7a5a';
  for (const b of state.city.buildings) {
    ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x0 + wx * scale, y0 + wy * scale, r || 3, 0, Math.PI * 2); ctx.fill();
  };
  // Mission marker (yellow diamond).
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
  // The player: a cyan triangle pointing where they face.
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

/** The full HUD over the world view. `speedKmh` is shown only while driving. */
export function drawHud(ctx, state, speedKmh) {
  // Cash + health, top-left.
  text(ctx, `$${state.money}`, 24, 44, 34, PALETTE.money, 'left', true);
  bar(ctx, 24, 56, 220, 14, state.health / 100, state.health > 30 ? '#7ee787' : '#ff5a5a');
  text(ctx, `HP ${Math.ceil(state.health)}`, 24, 92, 15, PALETTE.text, 'left');
  text(ctx, `AMMO ${state.ammo}`, 24, 112, 15, PALETTE.text, 'left');
  // Wanted stars, top-right.
  const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
  text(ctx, stars, VIEW.width - 24, 44, 30, state.wanted > 0 ? '#ff5a5a' : 'rgba(244,246,250,0.35)', 'right', true);
  text(ctx, state.wanted > 0 ? 'WANTED' : 'CLEAN', VIEW.width - 24, 70, 14, state.wanted > 0 ? '#ff5a5a' : PALETTE.muted, 'right', true);
  // Mission line, top-centre.
  const stage = state.mission ? missionTarget(state) : null;
  if (stage) {
    const remain = Math.max(0, Math.ceil(state.mission.timer));
    text(ctx, state.mission.text, VIEW.width / 2, 40, 20, PALETTE.neonYellow, 'center', true);
    text(ctx, `${stage.label}  •  ${remain}s`, VIEW.width / 2, 66, 16, PALETTE.text, 'center');
  } else if (state.sideJob) {
    const job = state.sideJob;
    text(ctx, `Taxi fare — $${job.fare}`, VIEW.width / 2, 40, 20, PALETTE.neonYellow, 'center', true);
    text(ctx, job.stage === 'pickup' ? 'Pick up the rider' : 'Drop the rider off', VIEW.width / 2, 66, 16, PALETTE.text, 'center');
  } else if (state.storyDone) {
    text(ctx, 'Free roam — taxi fares keep coming, the city is yours', VIEW.width / 2, 40, 16, PALETTE.muted, 'center');
  } else {
    text(ctx, 'New job waiting at the Marina Safehouse — drive there', VIEW.width / 2, 40, 16, PALETTE.muted, 'center');
  }
  // Speed, bottom-left, while driving.
  if (speedKmh !== null) {
    text(ctx, `${Math.round(speedKmh)}`, 24, VIEW.height - 52, 44, PALETTE.text, 'left', true);
    text(ctx, 'km/h', 24, VIEW.height - 28, 15, PALETTE.muted, 'left');
    text(ctx, 'W/S gas • A/D steer • SHIFT handbrake • E exit', 24, VIEW.height - 96, 14, PALETTE.muted, 'left');
  } else {
    text(ctx, 'WASD move • SHIFT run • SPACE punch • CLICK shoot • E steal car', 24, VIEW.height - 28, 14, PALETTE.muted, 'left');
  }
  drawMinimap(ctx, state);
  // Mission compass arrow at the screen edge.
  if (stage) {
    const p = state.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    const dx = stage.x - px;
    const dy = stage.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist > 420) {
      const ang = Math.atan2(dy, dx);
      // Orbit around the mission line — but never inside the mission-text
      // band (title y=40, subtitle y=66): when the target is north, the
      // raw orbit puts the arrow and the "NNNm" label right on top of the
      // objective text. Clamp below the band, so the label can never cover it.
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
  // Big centre banner (mission start, WANTED, WASTED, CLEAN…).
  if (state.banner && state.banner.timer > 0) {
    const alpha = Math.min(1, state.banner.timer);
    ctx.globalAlpha = alpha;
    text(ctx, state.banner.text, VIEW.width / 2, VIEW.height / 2 - 40, 52, PALETTE.text, 'center', true);
    if (state.banner.sub) text(ctx, state.banner.sub, VIEW.width / 2, VIEW.height / 2, 22, PALETTE.neonYellow, 'center');
    ctx.globalAlpha = 1;
  }
  // Red damage flash.
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 40, 40, ${state.flash * 0.25})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}
