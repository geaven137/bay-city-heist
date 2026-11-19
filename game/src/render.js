// NEON BAY — drawing only: the world state and the current screen in,
// pixels out. Top-down 2.5D: buildings get a fake height (roof offset from
// the wall), the camera follows the player, and a dusk lighting layer cuts
// radial holes of light around street lamps, headlights and neon signs,
// with red-blue siren glow on police cars. Flat procedural shapes only.
import { CITY, FONT, PALETTE, VIEW } from './config.js';
import { drawHud } from './hud.js';
import { missionTarget } from './missions.js';
import { roadCentresX, roadCentresY } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const dark = document.createElement('canvas');
  dark.width = VIEW.width;
  dark.height = VIEW.height;
  const darkCtx = dark.getContext('2d');

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = (bold ? '700 ' : '') + fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  /** World → screen coordinates for the current camera. */
  function toScreen(wx, wy, cam) {
    return { x: wx - cam.x + VIEW.width / 2, y: wy - cam.y + VIEW.height / 2 };
  }

  function drawGround(state, cam, left, top, right, bottom) {
    context.fillStyle = PALETTE.grass;
    context.fillRect(left, top, right - left, bottom - top);
    // Beach + water along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(left, Math.max(top, CITY.beachY - 60), right - left, 60);
    context.fillStyle = PALETTE.water;
    context.fillRect(left, Math.max(top, CITY.beachY), right - left, bottom - Math.max(top, CITY.beachY));
    context.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = left - ((left / 90) % 1) * 90; x < right; x += 90) {
      context.fillRect(x, CITY.beachY + 14 + ((x / 90) % 3) * 8, 46, 3);
    }
    // Palms along the beach: a starburst of fronds, seen from above.
    for (const palm of state.city.palms) {
      if (palm.x < left || palm.x > right || palm.y < top || palm.y > bottom) continue;
      context.fillStyle = '#1f7a37';
      for (let f = 0; f < 6; f += 1) {
        const a = (f / 6) * Math.PI * 2 + palm.lean;
        context.beginPath();
        context.ellipse(palm.x + Math.cos(a) * 10, palm.y + Math.sin(a) * 10, 13, 5, a, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = '#6b4a2f';
      context.beginPath(); context.arc(palm.x, palm.y, 4, 0, Math.PI * 2); context.fill();
    }
    // Parks.
    for (const park of state.city.parks) {
      if (park.x > right || park.x + park.w < left || park.y > bottom || park.y + park.h < top) continue;
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
      for (const t of park.trees) {
        context.fillStyle = '#2a7a3a';
        context.beginPath(); context.arc(t.x, t.y, t.r, 0, Math.PI * 2); context.fill();
        context.fillStyle = '#3f9a4f';
        context.beginPath(); context.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); context.fill();
      }
    }
    // Sidewalks, then asphalt, then centre dashes.
    for (const cx of roadCentresX) {
      if (cx < left - 80 || cx > right + 80) continue;
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(cx - CITY.road / 2 - 10, top, CITY.road + 20, bottom - top);
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(cx - CITY.road / 2, top, CITY.road, bottom - top);
    }
    for (const cy of roadCentresY) {
      if (cy < top - 80 || cy > bottom + 80) continue;
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(left, cy - CITY.road / 2 - 10, right - left, CITY.road + 20);
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(left, cy - CITY.road / 2, right - left, CITY.road);
    }
    context.fillStyle = PALETTE.roadLine;
    for (const cx of roadCentresX) {
      if (cx < left - 80 || cx > right + 80) continue;
      for (let y = Math.floor(top / 48) * 48; y < bottom; y += 48) context.fillRect(cx - 2, y, 4, 22);
    }
    for (const cy of roadCentresY) {
      if (cy < top - 80 || cy > bottom + 80) continue;
      for (let x = Math.floor(left / 48) * 48; x < right; x += 48) context.fillRect(x, cy - 2, 22, 4);
    }
  }

  function drawBuilding(b, time) {
    const ox = -b.height * 0.32;
    const oy = -b.height * 0.85;
    // South + west walls (the fake 2.5D depth).
    context.fillStyle = 'rgba(0,0,0,0.28)';
    context.beginPath();
    context.moveTo(b.x, b.y + b.h); context.lineTo(b.x + b.w, b.y + b.h);
    context.lineTo(b.x + b.w + ox, b.y + b.h + oy); context.lineTo(b.x + ox, b.y + b.h + oy);
    context.closePath(); context.fill();
    context.fillStyle = 'rgba(0,0,0,0.18)';
    context.beginPath();
    context.moveTo(b.x, b.y); context.lineTo(b.x, b.y + b.h);
    context.lineTo(b.x + ox, b.y + b.h + oy); context.lineTo(b.x + ox, b.y + oy);
    context.closePath(); context.fill();
    // Roof.
    context.fillStyle = b.roof;
    context.fillRect(b.x + ox, b.y + oy, b.w, b.h);
    context.strokeStyle = 'rgba(255,255,255,0.14)';
    context.lineWidth = 2;
    context.strokeRect(b.x + ox, b.y + oy, b.w, b.h);
    // Rooftop details: vents, a pool on some roofs.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(b.x + ox + 14, b.y + oy + 14, 22, 16);
    context.fillRect(b.x + ox + b.w - 40, b.y + oy + b.h - 30, 26, 16);
    if (b.neon) {
      const flicker = 0.6 + 0.4 * Math.sin(time * 3 + b.x);
      context.globalAlpha = flicker;
      context.fillStyle = (b.x + b.y) % 2 === 0 ? PALETTE.neonPink : PALETTE.neonCyan;
      context.fillRect(b.x + ox + 8, b.y + oy + b.h - 10, b.w - 16, 5);
      context.globalAlpha = 1;
    }
    if (b.beachfront) {
      // Stepped art-deco parapet bands on the pastel roof edge.
      context.fillStyle = 'rgba(255,255,255,0.28)';
      context.fillRect(b.x + ox + 10, b.y + oy + 6, b.w - 20, 4);
      context.fillStyle = 'rgba(0,0,0,0.22)';
      context.fillRect(b.x + ox + b.w / 2 - 14, b.y + oy + 2, 28, 8);
    }
    if (b.sign) {
      // Generic neon sign on the roof: a plain word in pink or cyan. On a
      // named building it sits at the roof's top edge, clear of the name.
      const flicker = 0.65 + 0.35 * Math.sin(time * 3 + b.x * 0.7);
      context.globalAlpha = flicker;
      context.fillStyle = (b.x + b.y) % 2 === 0 ? PALETTE.neonPink : PALETTE.neonCyan;
      context.font = `700 14px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(b.sign, b.x + b.w / 2 + ox, b.y + oy + (b.name ? 18 : b.h / 2));
      context.globalAlpha = 1;
    }
    if (b.name) {
      context.fillStyle = PALETTE.text;
      context.font = `700 15px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(b.name, b.x + b.w / 2 + ox, b.y + oy + b.h / 2);
    }
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.beginPath(); context.ellipse(2, 4, 30, 16, car.angle, 0, Math.PI * 2); context.fill();
    context.rotate(car.angle);
    context.fillStyle = car.wrecked ? '#2a2d33' : car.color;
    context.beginPath();
    context.roundRect(-27, -13, 54, 26, 7);
    context.fill();
    context.fillStyle = car.wrecked ? '#1a1c20' : 'rgba(20,26,38,0.85)';
    context.beginPath(); context.roundRect(-8, -11, 18, 22, 4); context.fill();
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(6, -11, 4, 22);
    // Headlights.
    context.fillStyle = '#ffe9a8';
    context.fillRect(25, -10, 3, 5);
    context.fillRect(25, 5, 3, 5);
    if (car.kind === 'police') {
      const phase = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
      context.fillRect(-4, -13, 8, 5);
      context.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
      context.fillRect(-4, 8, 8, 5);
      // Siren glow on the ground.
      context.restore();
      context.save();
      context.globalCompositeOperation = 'lighter';
      const glow = context.createRadialGradient(car.x, car.y, 4, car.x, car.y, 90);
      glow.addColorStop(0, phase ? 'rgba(255,46,46,0.30)' : 'rgba(46,107,255,0.30)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = glow;
      context.beginPath(); context.arc(car.x, car.y, 90, 0, Math.PI * 2); context.fill();
      context.restore();
      context.save();
      context.translate(car.x, car.y);
      context.rotate(car.angle);
    }
    if (car.kind === 'player') {
      context.strokeStyle = PALETTE.neonCyan;
      context.lineWidth = 2;
      context.beginPath(); context.roundRect(-29, -15, 58, 30, 8); context.stroke();
    }
    context.restore();
  }

  function drawPed(ped) {
    context.save();
    context.translate(ped.x, ped.y);
    if (ped.down) {
      context.rotate(ped.angle + Math.PI / 2);
      context.fillStyle = ped.color;
      context.fillRect(-12, -5, 24, 10);
      context.fillStyle = '#e8b890';
      context.beginPath(); context.arc(14, 0, 6, 0, Math.PI * 2); context.fill();
    } else {
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.beginPath(); context.ellipse(1, 3, 10, 6, 0, 0, Math.PI * 2); context.fill();
      context.fillStyle = ped.color;
      context.beginPath(); context.arc(0, 0, 9, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#e8b890';
      context.beginPath(); context.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2); context.fill();
    }
    context.restore();
  }

  function drawPlayer(state, time) {
    const p = state.player;
    if (!p.onFoot) return;
    context.save();
    context.translate(p.x, p.y);
    const blink = p.hurtTimer > 0 && Math.floor(time * 12) % 2 === 0;
    if (!blink) {
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath(); context.ellipse(1, 4, 12, 7, 0, 0, Math.PI * 2); context.fill();
      context.rotate(p.angle);
      context.fillStyle = PALETTE.player;
      context.beginPath(); context.arc(0, 0, 12, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#e8b890';
      context.beginPath(); context.arc(6, 0, 6, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#1e2a3a';
      context.fillRect(-12, -4, 8, 8);
    }
    context.restore();
  }

  function drawMarkers(state, time) {
    const target = missionTarget(state);
    const job = state.sideJob && !state.mission
      ? (state.sideJob.stage === 'pickup' ? state.sideJob.pickup : state.sideJob.drop) : null;
    const mark = target ? { x: target.x, y: target.y } : job;
    if (!mark) return;
    const pulse = 1 + 0.25 * Math.sin(time * 4);
    context.strokeStyle = PALETTE.neonYellow;
    context.lineWidth = 4;
    context.beginPath(); context.arc(mark.x, mark.y, 34 * pulse, 0, Math.PI * 2); context.stroke();
    context.fillStyle = 'rgba(255,210,63,0.25)';
    context.beginPath(); context.arc(mark.x, mark.y, 34 * pulse, 0, Math.PI * 2); context.fill();
    // A beam of light so the target reads from far away.
    context.fillStyle = 'rgba(255,210,63,0.10)';
    context.fillRect(mark.x - 6, mark.y - 320, 12, 320);
  }

  /** Dusk lighting: darken the world, then punch holes of light back in. */
  function drawLighting(state, cam, time) {
    darkCtx.setTransform(1, 0, 0, 1, 0, 0);
    darkCtx.clearRect(0, 0, VIEW.width, VIEW.height);
    darkCtx.fillStyle = 'rgba(10, 12, 30, 0.42)';
    darkCtx.fillRect(0, 0, VIEW.width, VIEW.height);
    darkCtx.globalCompositeOperation = 'destination-out';
    const hole = (wx, wy, radius, strength) => {
      const s = toScreen(wx, wy, cam);
      if (s.x < -radius || s.x > VIEW.width + radius || s.y < -radius || s.y > VIEW.height + radius) return;
      const g = darkCtx.createRadialGradient(s.x, s.y, 4, s.x, s.y, radius);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      darkCtx.fillStyle = g;
      darkCtx.beginPath(); darkCtx.arc(s.x, s.y, radius, 0, Math.PI * 2); darkCtx.fill();
    };
    const p = state.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    hole(px, py, 170, 0.9);
    for (const cx of roadCentresX) {
      for (const cy of roadCentresY) hole(cx, cy, 110, 0.75);
    }
    for (const car of state.cars) {
      if (car.wrecked) continue;
      const hx = car.x + Math.cos(car.angle) * 40;
      const hy = car.y + Math.sin(car.angle) * 40;
      hole(hx, hy, 70, 0.6);
    }
    for (const b of state.city.buildings) {
      if (b.neon) hole(b.x + b.w / 2, b.y + b.h / 2, 90, 0.5);
    }
    darkCtx.globalCompositeOperation = 'source-over';
    context.drawImage(dark, 0, 0);
    // Vignette.
    const v = context.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.45, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.38)');
    context.fillStyle = v;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    text(title, VIEW.width / 2, y + 78, 46, PALETTE.text, 'center', true);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 22, PALETTE.neonYellow, 'center', true);
  }

  /** Paint one frame: the world through the camera, then HUD or a panel. */
  function draw(state, screen, best, time) {
    const cam = state.camera;
    const shakeX = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
    const shakeY = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
    const camX = cam.x + shakeX;
    const camY = cam.y + shakeY;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Camera space: the viewport is 1280x720 around the camera centre.
    context.save();
    context.translate(-camX + VIEW.width / 2, -camY + VIEW.height / 2);
    const left = camX - VIEW.width / 2 - 80;
    const top = camY - VIEW.height / 2 - 80;
    const right = camX + VIEW.width / 2 + 80;
    const bottom = camY + VIEW.height / 2 + 80;
    drawGround(state, { x: camX, y: camY }, left, top, right, bottom);
    const visible = state.city.buildings.filter((b) => b.x + b.w > left && b.x < right && b.y + b.h > top && b.y < bottom);
    visible.sort((a, b) => (a.y + a.h) - (b.y + b.h));
    for (const b of visible) drawBuilding(b, time);
    drawMarkers(state, time);
    const cars = state.cars.filter((c) => c.x > left && c.x < right && c.y > top && c.y < bottom);
    cars.sort((a, b) => a.y - b.y);
    for (const car of cars) drawCar(car, time);
    for (const ped of state.peds) {
      if (ped.x > left && ped.x < right && ped.y > top && ped.y < bottom) drawPed(ped);
    }
    drawPlayer(state, time);
    for (const b of state.bullets) {
      context.strokeStyle = '#ffd23f';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    context.globalAlpha = 1;
    context.restore();
    drawLighting(state, { x: camX, y: camY }, time);
    if (screen === SCREEN_TITLE) {
      drawPanel('NEON BAY', [
        'A sun-soaked city after dark. You are Kai Reyes,',
        'a driver with no money and a fast car to steal.',
        'Mara Voss has work for you — if you can lose the cops.',
        '',
        `Best haul yet: $${best}`,
        'WASD move / drive • E steal car • SPACE punch • CLICK shoot • P pause',
      ], 'Press Space or click to start');
      return;
    }
    const speedKmh = state.player.car ? Math.abs(state.player.car.speed) * 0.36 : null;
    drawHud(context, state, speedKmh);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', '', 'Progress saves when a job ends.'], 'Press P to resume • S to save now');
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', [`You woke up at St. Marina Hospital.`, `The doctors kept $100.`, `Haul so far: $${state.money}`], 'Press Space or click to play again');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [`The Bayview police took you in.`, `They kept $100 of your money.`, `Haul so far: $${state.money}`], 'Press Space or click to play again');
    }
  }

  /** Screen pixels (clientX/Y) → world coordinates, for mouse aiming. */
  function toWorld(clientX, clientY, cam) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const vx = (clientX * ratio - view.x) / view.scale;
    const vy = (clientY * ratio - view.y) / view.scale;
    return { x: vx - VIEW.width / 2 + cam.x, y: vy - VIEW.height / 2 + cam.y };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toScreen, toWorld };
}
