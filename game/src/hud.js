// Neon Bay — the heads-up display, drawn on a 2D canvas over
// the WebGL view. Everything is laid out in a 1280 by 666
// space and scaled to the real canvas, so the HUD reads the
// same at any window size. The dialogue box sits right of the
// minimap on purpose: the minimap ends near x=196, the box
// starts at x=220, so they never overlap.

import { MISSIONS, RANKS, SHOP_ITEMS } from './config.js';
import { dispatchBoard } from './police.js';

const W = 1280;
const H = 666;

function starRow(ctx, x, y, count, size) {
  ctx.font = 'bold ' + size + 'px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < count ? '#ff3b30' : 'rgba(255,255,255,0.28)';
    ctx.fillText('\u2605', x + i * (size + 2), y);
  }
}

function bar(ctx, x, y, w, h, frac, fill, back) {
  ctx.fillStyle = back || 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = 'rgba(8,12,20,' + (alpha ?? 0.72) + ')';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(120,220,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function drawHud(ctx, state, cw, ch) {
  ctx.save();
  ctx.clearRect(0, 0, cw, ch);
  ctx.scale(cw / W, ch / H);
  if (state.mode === 'title') {
    drawTitle(ctx, state);
    ctx.restore();
    return;
  }
  if (state.mode === 'end') {
    drawEnd(ctx, state);
    ctx.restore();
    return;
  }
  drawPlay(ctx, state);
  ctx.restore();
}

function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(6,8,18,0.45)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, 360, 130, 560, 330, 0.82);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('NEON BAY', 640, 190);
  ctx.fillStyle = '#ffd23f';
  ctx.font = '22px sans-serif';
  ctx.fillText('A sun-soaked city after dark. You are Kai Reyes,', 640, 232);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('a driver with no money and a fast car to steal.', 640, 260);
  ctx.fillText('Mara Voss has work for you — if you can lose the cops.', 640, 288);
  ctx.fillStyle = '#c8d2e0';
  ctx.font = '19px sans-serif';
  ctx.fillText('Best haul yet: $' + (state.stats.bestHaul || 0), 640, 330);
  ctx.fillText('WASD move  •  MOUSE look  •  RIGHT-CLICK aim  •  CLICK shoot', 640, 360);
  ctx.fillText('E steal car  •  Q swap shoulder  •  P pause', 640, 386);
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText('Press Space or click to start', 640, 428);
}

function drawEnd(ctx, state) {
  ctx.fillStyle = 'rgba(4,6,12,0.55)';
  ctx.fillRect(0, 0, W, H);
  const end = state.end || { kind: 'busted', kept: 0, haul: 0 };
  const title = end.kind === 'busted' ? 'BUSTED' : 'WASTED';
  panel(ctx, 360, 150, 560, 220, 0.88);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(title, 640, 205);
  ctx.fillStyle = '#ffd23f';
  ctx.font = '23px sans-serif';
  ctx.fillText(
    end.kind === 'busted' ? 'The Bayview police took you in.' : 'St. Marina Hospital patched you up.',
    640, 248
  );
  ctx.fillStyle = '#ffffff';
  ctx.fillText('They kept $' + end.kept + ' of your money.', 640, 280);
  ctx.fillText('Haul so far: $' + end.haul, 640, 312);
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText('Press Space or click to play again', 640, 348);
}

function drawPlay(ctx, state) {
  const p = state.player;
  // ---- top-left: money, health, rank ----
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#7CFC00';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('$' + state.money, 72, 52);
  bar(ctx, 72, 62, 200, 12, state.health / 100, '#7CFC00');
  ctx.fillStyle = '#e8eef4';
  ctx.font = '16px sans-serif';
  ctx.fillText('HP ' + Math.round(state.health), 72, 98);
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('RANK: ' + RANKS[state.rankIndex], 72, 122);
  bar(ctx, 72, 130, 200, 8, (state.rep % 2) / 2, '#22d3ee');
  ctx.fillStyle = '#c8d2e0';
  ctx.font = '15px sans-serif';
  ctx.fillText((state.rep % 2) + '/2 rep to ' + (RANKS[state.rankIndex + 1] || 'NEON CROWN'), 72, 158);
  ctx.fillText('JOBS ' + state.jobsDone + '/8', 72, 180);

  // ---- top-centre: mission + compass ----
  const idx = state.missionIndex;
  if (idx >= 0 && idx < MISSIONS.length) {
    const def = MISSIONS[idx];
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('JOB ' + (idx + 1) + '/8 — ' + def.name + ' — ' + def.giver, 640, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = '19px sans-serif';
    const secs = Math.max(0, Math.ceil(state.missionTimer));
    ctx.fillText(def.goal + '  •  ' + secs + 's', 640, 64);
    // Compass strip.
    panel(ctx, 500, 78, 280, 34, 0.6);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 18px sans-serif';
    const target = state.missionTarget;
    let dir = 'E';
    let dist = 0;
    if (target) {
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      const deg = ((a * 180) / Math.PI + 360) % 360;
      dir = deg < 22.5 || deg >= 337.5 ? 'E' : deg < 67.5 ? 'SE' : deg < 112.5 ? 'S' : deg < 157.5 ? 'SW' : deg < 202.5 ? 'W' : deg < 247.5 ? 'NW' : deg < 292.5 ? 'N' : 'NE';
      dist = Math.round(Math.hypot(target.x - p.x, target.y - p.y));
    }
    ctx.fillText('\u25C6', 545, 100);
    ctx.fillText(dir, 640, 100);
    ctx.fillText('\u25B2', 735, 100);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(dist + 'm', 700, 128);
  }

  // ---- top-right: wanted + dispatch ----
  ctx.textAlign = 'right';
  starRow(ctx, 1080, 34, state.wanted, 30);
  ctx.fillStyle = '#ff3b30';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('WANTED', 1208, 62);
  const rows = dispatchBoard(state);
  if (rows.length > 0) {
    const rh = 26;
    const ph = 30 + rows.length * rh + 8;
    panel(ctx, 980, 76, 228, ph, 0.72);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('BAYVIEW DISPATCH', 992, 100);
    ctx.font = '15px sans-serif';
    rows.forEach((r, i) => {
      const y = 122 + i * rh;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(r.label, 992, y);
      ctx.fillStyle = '#c8d2e0';
      ctx.fillText(r.dist + 'm', 1080, y);
      ctx.fillStyle = r.status === 'SPOTLIGHT' ? '#22d3ee' : '#ffd23f';
      ctx.fillText(r.status, 1140, y);
    });
  }

  // ---- bottom-left: minimap ----
  const mx = 116;
  const my = 556;
  const mr = 78;
  ctx.fillStyle = 'rgba(8,12,20,0.7)';
  ctx.beginPath();
  ctx.arc(mx, my, mr + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx, my, mr + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#16324a';
  ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  const scale = (mr * 2) / (WORLD_HALF * 2 + 900);
  const toMap = (x, y) => [mx + (x - 300) * scale, my + (y - 900) * scale];
  for (let k = -7; k <= 7; k++) {
    const x1 = k * 160;
    const [ax, ay] = toMap(x1, -1200);
    const [bx, by] = toMap(x1, 2100);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    const [cx, cy] = toMap(-1200, k * 160);
    const [dx, dy] = toMap(2100, k * 160);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(dx, dy);
    ctx.stroke();
  }
  // Sea strip on the minimap.
  ctx.fillStyle = '#0e4d5c';
  const [sx] = toMap(0, 2240);
  ctx.fillRect(mx - mr, sx - 8, mr * 2, 16);
  // Mission marker.
  if (state.missionTarget) {
    const [tx, ty] = toMap(state.missionTarget.x, state.missionTarget.y);
    ctx.fillStyle = '#ffd23f';
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  // Heli dot.
  if (state.heli) {
    const [hx, hy] = toMap(state.heli.x, state.heli.y);
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const [px2, py2] = toMap(p.x, p.y);
  ctx.fillStyle = '#22d3ee';
  ctx.save();
  ctx.translate(px2, py2);
  ctx.rotate(p.angle);
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#c8d2e0';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NEON BAY', 58, my - mr - 14);

  // ---- bottom-right: speed + weapons ----
  const spd = Math.round(Math.abs(p.onFoot ? p.speed : (p.car ? p.car.speed : 0)) * 2.6);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText(String(spd), 1208, 560);
  ctx.fillStyle = '#c8d2e0';
  ctx.font = '18px sans-serif';
  ctx.fillText('km/h', 1208, 588);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(state.weapon === 1 ? 'PISTOL' : 'FIST', 1208, 616);
  if (state.weapon === 1) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(String(state.ammo), 1208, 640);
  }
  // Weapon slots.
  const slots = ['FIST', 'PIST', '—', '—', '—'];
  let sx = 1000;
  slots.forEach((s, i) => {
    const sel = (i === 0 && state.weapon === 0) || (i === 1 && state.weapon === 1);
    ctx.fillStyle = sel ? 'rgba(34,211,238,0.9)' : 'rgba(8,12,20,0.7)';
    ctx.fillRect(sx, 618, 44, 34);
    ctx.strokeStyle = sel ? '#22d3ee' : 'rgba(255,255,255,0.3)';
    ctx.strokeRect(sx + 0.5, 618.5, 43, 33);
    ctx.fillStyle = sel ? '#06202a' : '#e8eef4';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s, sx + 22, 640);
    sx += 48;
  });

  // ---- bottom-centre: controls + radio ----
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '16px sans-serif';
  ctx.fillText('W/S gas  •  A/D steer  •  SHIFT handbrake  •  E exit', 640, 632);
  ctx.fillStyle = '#c8d2e0';
  ctx.fillText('NEON FM 88.5  •  Midnight Drive — The Palms', 640, 654);

  // ---- banner (centre) ----
  if (state.banner) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(state.banner.text, 640, 300);
    if (state.banner.sub) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = '22px sans-serif';
      ctx.fillText(state.banner.sub, 640, 332);
    }
  }

  // ---- dialogue (right of the minimap) ----
  if (state.talk) {
    const dx = 220;
    const dy = 452;
    panel(ctx, dx, dy, 420, 64, 0.8);
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath();
    ctx.arc(dx + 30, dy + 32, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MV', dx + 30, dy + 37);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(state.talk.name, dx + 60, dy + 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    wrapText(ctx, state.talk.text, dx + 60, dy + 46, 348, 20);
  }

  // ---- shop panel ----
  if (state.shopOpen) {
    panel(ctx, 440, 180, 400, 210, 0.88);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText("RICO'S GARAGE", 640, 214);
    ctx.textAlign = 'left';
    ctx.font = '17px sans-serif';
    SHOP_ITEMS.forEach((item, i) => {
      const y = 248 + i * 34;
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(item.key, 470, y);
      ctx.fillStyle = '#ffffff';
      ctx.font = '17px sans-serif';
      ctx.fillText(item.label + ' — ' + item.detail, 495, y);
      ctx.fillStyle = '#7CFC00';
      ctx.textAlign = 'right';
      ctx.fillText('$' + item.price, 810, y);
      ctx.textAlign = 'left';
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c8d2e0';
    ctx.font = '15px sans-serif';
    ctx.fillText('Press 1-4 to buy. Walk away to close.', 640, 372);
  }

  // ---- hurt flash ----
  if (state.flash > 0) {
    ctx.fillStyle = 'rgba(255,30,30,' + (state.flash * 0.22) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

const WORLD_HALF = 1200;

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
