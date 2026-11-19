// NEON BAY — drawing only: the world state and the current screen in,
// pixels out. Third-person view: a raycast city (walls as textured
// vertical strips, floor-cast streets, billboard sprites), the player
// seen from behind at the bottom of the frame, over-the-shoulder when
// aiming. The simulation stays top-down 2D; only the camera changed.
// Flat procedural shapes only, no assets, no network.
import { CITY, FONT, PALETTE, VIEW } from './config.js';
import { drawCrosshair, drawHud } from './hud.js';
import { missionTarget } from './missions.js';
import { isOnRoad, nearestCentre, roadCentresX, roadCentresY } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

// The 3D scene is painted small (640x360) and upscaled; the HUD stays
// crisp at 1280x720 on top of it.
const RW = 640;
const RH = 360;
const COLS = 160; // wall columns across the scene
const CELL = 32; // wall-grid cell, world units
const EYE = 30; // camera height above the street, world units
const WALL = 2.4; // building height multiplier: top-down heights read short
const FOG = '13,15,26'; // dusk fog colour (rgb triplet for rgba strings)

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scene = document.createElement('canvas');
  scene.width = RW;
  scene.height = RH;
  const sctx = scene.getContext('2d');

  // Wall grid for the raycaster: cell -> building index + 1 (0 = open).
  // Rebuilt only when the city object changes.
  let gridCity = null;
  let grid = null;
  let gridW = 0;
  let gridH = 0;
  function wallGrid(city) {
    if (city === gridCity) return;
    gridCity = city;
    gridW = Math.ceil(CITY.width / CELL);
    gridH = Math.ceil(CITY.height / CELL);
    grid = new Uint16Array(gridW * gridH);
    for (let i = 0; i < city.buildings.length; i += 1) {
      const b = city.buildings[i];
      const x0 = Math.max(0, Math.floor(b.x / CELL));
      const x1 = Math.min(gridW - 1, Math.floor((b.x + b.w) / CELL));
      const y0 = Math.max(0, Math.floor(b.y / CELL));
      const y1 = Math.min(gridH - 1, Math.floor((b.y + b.h) / CELL));
      for (let gy = y0; gy <= y1; gy += 1) {
        for (let gx = x0; gx <= x1; gx += 1) grid[gy * gridW + gx] = i + 1;
      }
    }
  }

  // Procedural sprite canvases, cached by look. Drawn at 2x so a sprite
  // close to the camera stays sharp instead of a blurry blow-up.
  const sprites = new Map();
  function sprite(key, w, h, draw) {
    if (!sprites.has(key)) {
      const c = document.createElement('canvas');
      c.width = w * 2;
      c.height = h * 2;
      const g = c.getContext('2d');
      g.scale(2, 2);
      draw(g, w, h);
      sprites.set(key, c);
    }
    return sprites.get(key);
  }

  // Wall-face texture per building look: lit windows on the wall colour,
  // a neon band near the top for neon buildings, roof colour at the cap.
  const wallTex = new Map();
  function textureFor(b) {
    const key = `${b.color}|${b.roof}|${b.neon ? 1 : 0}`;
    if (wallTex.has(key)) return wallTex.get(key);
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = b.color;
    g.fillRect(0, 0, 48, 96);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let r = 0; r < 6; r += 1) {
      for (let col = 0; col < 3; col += 1) {
        if (((r * 3 + col) * 37 + b.x) % 5 < 2) continue; // some windows dark
        g.fillStyle = (r + col) % 3 === 0 ? 'rgba(255,214,120,0.85)' : 'rgba(20,26,44,0.8)';
        g.fillRect(5 + col * 14, 12 + r * 13, 9, 8);
      }
    }
    if (b.neon) {
      g.fillStyle = (b.x + b.y) % 2 === 0 ? PALETTE.neonPink : PALETTE.neonCyan;
      g.fillRect(0, 6, 48, 4);
    }
    g.fillStyle = b.roof;
    g.fillRect(0, 0, 48, 5);
    wallTex.set(key, c);
    return c;
  }

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

  /** Ground colour at a world point: water, sand, road, sidewalk, park, grass.
   * The centre line is solid and only in the near field: dashes alias
   * into wide yellow bands when the road runs diagonally across the view,
   * and far away the floor samples are wider than any marking. */
  function floorColor(city, wx, wy, near) {
    if (wy >= CITY.beachY) return PALETTE.water;
    if (wy >= CITY.beachY - 60) return PALETTE.sand;
    if (isOnRoad(wx, wy)) {
      if (near
        && (Math.abs(wx - nearestCentre(roadCentresX, wx)) < 2
          || Math.abs(wy - nearestCentre(roadCentresY, wy)) < 2)) return PALETTE.roadLine;
      return PALETTE.asphalt;
    }
    if (Math.abs(wx - nearestCentre(roadCentresX, wx)) <= CITY.road / 2 + 10
      || Math.abs(wy - nearestCentre(roadCentresY, wy)) <= CITY.road / 2 + 10) {
      return PALETTE.sidewalk;
    }
    for (const park of city.parks) {
      if (wx >= park.x && wx <= park.x + park.w && wy >= park.y && wy <= park.y + park.h) return PALETTE.park;
    }
    return PALETTE.grass;
  }

  function drawSky(camAngle, fov, horizon, time) {
    const g = sctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, '#160f38');
    g.addColorStop(0.6, '#4a2158');
    g.addColorStop(1, '#ff8a5c');
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, RW, horizon + 1);
    // Stars in the upper sky: fixed positions from an index hash.
    sctx.fillStyle = '#f4f6fa';
    for (let i = 0; i < 42; i += 1) {
      const sx = (i * 97 + 31) % RW;
      const sy = (i * 53 + 11) % 110;
      sctx.globalAlpha = 0.25 + ((i * 13) % 10) / 18;
      sctx.fillRect(sx, sy, 2, 2);
    }
    sctx.globalAlpha = 1;
    // Low sun, fixed to the west: it slides across the sky as you turn.
    const tanHalf = Math.tan(fov / 2);
    const sunA = wrapAngle(Math.PI * 0.75 - camAngle);
    if (Math.abs(sunA) < fov / 2 + 0.25) {
      const sunX = RW / 2 + (Math.tan(sunA) / tanHalf) * (RW / 2);
      const sunY = horizon - 26;
      const glow = sctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
      glow.addColorStop(0, 'rgba(255,190,120,0.75)');
      glow.addColorStop(1, 'rgba(255,190,120,0)');
      sctx.fillStyle = glow;
      sctx.fillRect(sunX - 90, sunY - 90, 180, 180);
      sctx.fillStyle = '#ffd9a0';
      sctx.beginPath();
      sctx.arc(sunX, sunY, 15, 0, Math.PI * 2);
      sctx.fill();
    }
    // Haze band on the horizon.
    const haze = sctx.createLinearGradient(0, horizon - 14, 0, horizon + 6);
    haze.addColorStop(0, 'rgba(255,138,92,0)');
    haze.addColorStop(1, 'rgba(255,138,92,0.35)');
    sctx.fillStyle = haze;
    sctx.fillRect(0, horizon - 14, RW, 20);
  }

  /** One DDA raycast; returns the hit building, distance and wall fraction. */
  function castRay(cam, rx, ry) {
    const rdx = rx / CELL;
    const rdy = ry / CELL;
    let mapX = Math.floor(cam.x / CELL);
    let mapY = Math.floor(cam.y / CELL);
    const dDX = Math.abs(rdx) < 1e-9 ? 1e9 : Math.abs(1 / rdx);
    const dDY = Math.abs(rdy) < 1e-9 ? 1e9 : Math.abs(1 / rdy);
    const stepX = rdx < 0 ? -1 : 1;
    const stepY = rdy < 0 ? -1 : 1;
    let sideX = rdx < 0 ? (cam.x / CELL - mapX) * dDX : (mapX + 1 - cam.x / CELL) * dDX;
    let sideY = rdy < 0 ? (cam.y / CELL - mapY) * dDY : (mapY + 1 - cam.y / CELL) * dDY;
    let side = 0;
    let dist = 0;
    for (let i = 0; i < 128; i += 1) {
      if (sideX < sideY) { sideX += dDX; mapX += stepX; side = 0; dist = sideX - dDX; }
      else { sideY += dDY; mapY += stepY; side = 1; dist = sideY - dDY; }
      if (mapX < 0 || mapY < 0 || mapX >= gridW || mapY >= gridH) return null;
      const hit = grid[mapY * gridW + mapX];
      if (hit) {
        const worldDist = dist * CELL;
        const rayLen = Math.hypot(rx, ry);
        const perp = worldDist * (rx * Math.cos(cam.angle) + ry * Math.sin(cam.angle)) / rayLen;
        const along = side === 0
          ? (cam.y + worldDist * ry / rayLen) / CELL
          : (cam.x + worldDist * rx / rayLen) / CELL;
        return { building: gridCity.buildings[hit - 1], perp, side, frac: along - Math.floor(along) };
      }
    }
    return null;
  }

  function drawWalls(state, cam, dirX, dirY, planeX, planeY, proj, horizon, zbuf, colBldg) {
    const colW = RW / COLS;
    for (let c = 0; c < COLS; c += 1) {
      const camX = (2 * c) / COLS - 1;
      const rx = dirX + planeX * camX;
      const ry = dirY + planeY * camX;
      const hit = castRay(cam, rx, ry);
      if (!hit || hit.perp < 4) { zbuf[c] = 1e9; colBldg[c] = null; continue; }
      zbuf[c] = hit.perp;
      colBldg[c] = hit.building;
      const b = hit.building;
      const hWorld = b.height * WALL;
      const y0 = horizon - ((hWorld - EYE) * proj) / hit.perp;
      const y1 = horizon + (EYE * proj) / hit.perp;
      const tex = textureFor(b);
      const sx = Math.floor(hit.frac * tex.width);
      sctx.drawImage(tex, sx, 0, 1, tex.height, c * colW, y0, colW + 0.5, y1 - y0);
      // Side shading + distance fog.
      const fog = Math.min(0.5, hit.perp / 950);
      sctx.fillStyle = hit.side === 1 ? `rgba(${FOG},${(fog + 0.1).toFixed(3)})` : `rgba(${FOG},${fog.toFixed(3)})`;
      sctx.fillRect(c * colW, y0, colW + 0.5, y1 - y0);
    }
  }

  function drawFloor(state, cam, dirX, dirY, planeX, planeY, proj, horizon) {
    sctx.fillStyle = PALETTE.grass;
    sctx.fillRect(0, horizon, RW, RH - horizon);
    const leftX = dirX - planeX;
    const leftY = dirY - planeY;
    const rightX = dirX + planeX;
    const rightY = dirY + planeY;
    const SAMPLES = 80;
    const stepX = (rightX - leftX) / SAMPLES;
    const stepY = (rightY - leftY) / SAMPLES;
    const sw = RW / SAMPLES;
    for (let y = horizon + 2; y < RH; y += 2) {
      const p = y - horizon;
      let rowDist = (EYE * proj) / p;
      if (rowDist > 900) rowDist = 900;
      let fx = cam.x + leftX * rowDist;
      let fy = cam.y + leftY * rowDist;
      const dx = rowDist * stepX;
      const dy = rowDist * stepY;
      for (let s = 0; s < SAMPLES; s += 1) {
        sctx.fillStyle = floorColor(state.city, fx, fy, rowDist < 380);
        sctx.fillRect(s * sw, y, sw + 0.5, 2);
        fx += dx;
        fy += dy;
      }
      // Fog grows toward the horizon.
      const fog = Math.min(0.55, rowDist / 900) * 0.55;
      if (fog > 0.02) {
        sctx.fillStyle = `rgba(${FOG},${fog.toFixed(3)})`;
        sctx.fillRect(0, y, RW, 2);
      }
    }
  }

  /** Project a world point to screen space; null when behind the camera
   * or so close the sprite would be a giant blur (near-plane clip). */
  function project(cam, dirX, dirY, planeX, planeY, proj, horizon, x, y, lift, worldH, aspect) {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const depth = dx * dirX + dy * dirY;
    if (depth < 40) return null;
    const lat = dx * planeX + dy * planeY;
    const sx = (RW / 2) * (1 + lat / depth);
    if (sx < -160 || sx > RW + 160) return null;
    const bottom = horizon + ((EYE - lift) * proj) / depth;
    const h = (worldH * proj) / depth;
    return { sx, bottom, h, w: h * aspect, depth };
  }

  function drawSpriteEntry(entry, zbuf) {
    const { canvas: img, sx, bottom, h, w, depth } = entry;
    // A sprite close to the camera and near a frame edge is a trunk or
    // a bumper at arm's length, half out of shot: clip it out instead
    // of painting a giant blur at the edge. A sprite centred in front
    // of the player stays (that is how close things look — and it is
    // the one you are about to punch or shoot).
    if (depth < 75 && (sx < RW * 0.2 || sx > RW * 0.8)) return;
    const x0 = Math.round(sx - w / 2);
    const x1 = Math.round(sx + w / 2);
    const y0 = Math.round(bottom - h);
    if (x1 < 0 || x0 >= RW || y0 >= RH) return;
    let occluded = false;
    for (let cx = Math.max(0, x0); cx < Math.min(RW, x1); cx += 1) {
      if (depth >= zbuf[Math.floor((cx / RW) * COLS)]) { occluded = true; break; }
    }
    if (!occluded) {
      sctx.drawImage(img, x0, y0, w, h);
      return;
    }
    const srcW = Math.max(1, img.width / w);
    for (let cx = Math.max(0, x0); cx < Math.min(RW, x1); cx += 1) {
      if (depth < zbuf[Math.floor((cx / RW) * COLS)]) {
        const srcX = ((cx - x0) / w) * img.width;
        sctx.drawImage(img, srcX, 0, srcW, img.height, cx, y0, 1, h);
      }
    }
  }

  function carSprite(color, police) {
    return sprite(`car-${police ? 'cop' : color}`, 96, 72, (g, w, h) => {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(w / 2, h - 8, 42, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = color;
      g.beginPath(); g.roundRect(6, 26, 84, 34, 8); g.fill();
      g.fillStyle = color;
      g.beginPath(); g.roundRect(18, 10, 60, 24, 8); g.fill();
      g.fillStyle = 'rgba(20,26,38,0.9)';
      g.beginPath(); g.roundRect(24, 14, 48, 16, 4); g.fill();
      g.fillStyle = '#ff2e2e';
      g.fillRect(8, 40, 10, 6);
      g.fillRect(78, 40, 10, 6);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(30, 30, 36, 4);
      if (police) {
        g.fillStyle = '#ff2e2e';
        g.fillRect(38, 6, 10, 6);
        g.fillStyle = '#2e6bff';
        g.fillRect(50, 6, 10, 6);
      }
    });
  }

  function pedSprite(color) {
    return sprite(`ped-${color}`, 48, 96, (g, w, h) => {
      g.fillStyle = '#1e2a3a';
      g.fillRect(16, 58, 7, 34);
      g.fillRect(25, 58, 7, 34);
      g.fillStyle = color;
      g.beginPath(); g.roundRect(12, 26, 24, 36, 8); g.fill();
      g.fillStyle = '#e8b890';
      g.beginPath(); g.arc(24, 16, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1e2a3a';
      g.beginPath(); g.arc(24, 12, 10, Math.PI, 0); g.fill();
    });
  }

  function palmSprite() {
    return sprite('palm', 64, 96, (g, w, h) => {
      g.strokeStyle = '#6b4a2f';
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(32, 94); g.lineTo(29, 58); g.lineTo(34, 26); g.stroke();
      g.fillStyle = '#1f7a37';
      for (let f = 0; f < 6; f += 1) {
        const a = (f / 6) * Math.PI * 2 - 0.6;
        g.beginPath();
        g.ellipse(34 + Math.cos(a) * 18, 26 + Math.sin(a) * 10, 20, 6, a, 0, Math.PI * 2);
        g.fill();
      }
    });
  }

  function treeSprite() {
    return sprite('tree', 64, 64, (g, w, h) => {
      g.fillStyle = '#5a4028';
      g.fillRect(28, 40, 8, 22);
      g.fillStyle = '#2a7a3a';
      g.beginPath(); g.arc(32, 26, 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3f9a4f';
      g.beginPath(); g.arc(24, 20, 12, 0, Math.PI * 2); g.fill();
    });
  }

  function markerSprite() {
    return sprite('marker', 48, 48, (g, w, h) => {
      g.fillStyle = 'rgba(255,210,63,0.35)';
      g.beginPath(); g.arc(24, 24, 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = PALETTE.neonYellow;
      g.save();
      g.translate(24, 24);
      g.rotate(Math.PI / 4);
      g.fillRect(-10, -10, 20, 20);
      g.restore();
    });
  }

  function playerSprite(aiming) {
    return sprite(`player-${aiming ? 'aim' : 'walk'}`, 96, 128, (g, w, h) => {
      g.fillStyle = '#1e2a3a'; // legs
      g.fillRect(36, 84, 10, 40);
      g.fillRect(50, 84, 10, 40);
      g.fillStyle = PALETTE.player; // jacket, seen from behind
      g.beginPath(); g.roundRect(28, 44, 40, 44, 10); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(28, 44, 40, 6);
      if (aiming) {
        g.fillStyle = '#e8b890'; // arm raised, pistol forward (up, away)
        g.fillRect(58, 30, 8, 22);
        g.fillStyle = '#22262e';
        g.fillRect(60, 18, 5, 16);
        g.fillStyle = '#ffd23f';
        g.fillRect(60, 16, 5, 3);
      } else {
        g.fillStyle = '#e8b890';
        g.fillRect(24, 48, 7, 26);
        g.fillRect(65, 48, 7, 26);
      }
      g.fillStyle = '#e8b890'; // head + hair
      g.beginPath(); g.arc(48, 30, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#14181f';
      g.beginPath(); g.arc(48, 26, 13, Math.PI, 0); g.fill();
    });
  }

  function playerCarSprite(color) {
    return sprite(`rear-${color}`, 160, 110, (g, w, h) => {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.beginPath(); g.ellipse(w / 2, h - 6, 72, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = color;
      g.beginPath(); g.roundRect(10, 52, 140, 44, 10); g.fill();
      g.beginPath(); g.roundRect(30, 22, 100, 36, 10); g.fill();
      g.fillStyle = 'rgba(20,26,38,0.92)';
      g.beginPath(); g.roundRect(38, 26, 84, 26, 6); g.fill();
      g.fillStyle = '#ff2e2e';
      g.fillRect(14, 62, 18, 8);
      g.fillRect(128, 62, 18, 8);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(56, 56, 48, 4);
      g.fillStyle = '#c8ccd4';
      g.fillRect(66, 84, 28, 8);
    });
  }

  function drawSprites(state, cam, dirX, dirY, planeX, planeY, proj, horizon, zbuf, time) {
    const entries = [];
    const p = state.player;
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      const e = project(cam, dirX, dirY, planeX, planeY, proj, horizon, car.x, car.y, 0, 46, 1.33);
      if (e) entries.push({ ...e, canvas: carSprite(car.color, car.kind === 'police') });
    }
    for (const ped of state.peds) {
      if (ped.down) continue;
      const e = project(cam, dirX, dirY, planeX, planeY, proj, horizon, ped.x, ped.y, 0, 46, 0.5);
      if (e) entries.push({ ...e, canvas: pedSprite(ped.color) });
    }
    for (const palm of state.city.palms) {
      const e = project(cam, dirX, dirY, planeX, planeY, proj, horizon, palm.x, palm.y, 0, 90, 0.67);
      if (e) entries.push({ ...e, canvas: palmSprite() });
    }
    for (const park of state.city.parks) {
      for (const t of park.trees) {
        const e = project(cam, dirX, dirY, planeX, planeY, proj, horizon, t.x, t.y, 0, 60, 1);
        if (e) entries.push({ ...e, canvas: treeSprite() });
      }
    }
    // Mission marker: a beam of light plus a floating diamond.
    const target = missionTarget(state);
    const job = state.sideJob && !state.mission
      ? (state.sideJob.stage === 'pickup' ? state.sideJob.pickup : state.sideJob.drop) : null;
    const mark = target ? { x: target.x, y: target.y } : job;
    if (mark) {
      const e = project(cam, dirX, dirY, planeX, planeY, proj, horizon, mark.x, mark.y, 70, 44, 1);
      if (e) entries.push({ ...e, canvas: markerSprite() });
      const base = project(cam, dirX, dirY, planeX, planeY, proj, horizon, mark.x, mark.y, 0, 10, 1);
      if (base) {
        const beamW = Math.max(2, 260 / base.depth);
        sctx.fillStyle = 'rgba(255,210,63,0.10)';
        sctx.fillRect(base.sx - beamW / 2, horizon - 160, beamW, 160);
      }
    }
    for (const b of state.bullets) {
      const e = project(cam, dirX, dirY, planeX, planeY, proj, horizon, b.x, b.y, 20, 10, 0.4);
      if (e) {
        sctx.fillStyle = '#ffd23f';
        sctx.fillRect(e.sx - 1, e.bottom - e.h, 2, e.h);
      }
    }
    for (const pt of state.particles) {
      const e = project(cam, dirX, dirY, planeX, planeY, proj, horizon, pt.x, pt.y, 6, pt.size * 2, 1);
      if (e) {
        sctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        sctx.fillStyle = pt.color;
        sctx.fillRect(e.sx - e.w / 2, e.bottom - e.h, Math.max(1, e.w), Math.max(1, e.h));
      }
    }
    sctx.globalAlpha = 1;
    entries.sort((a, b) => b.depth - a.depth);
    for (const e of entries) drawSpriteEntry(e, zbuf);
  }

  /** The player from behind (on foot) or their car from behind (driving). */
  function drawSelf(state, cam, time) {
    const p = state.player;
    if (p.onFoot) {
      const bob = p.moving ? Math.sin(time * 10) * 2 : 0;
      const img = playerSprite(!!p.aiming);
      const w = 150;
      const h = 200;
      const x = RW / 2 - w / 2 + cam.shoulder;
      sctx.drawImage(img, x, RH - h - 4 + bob, w, h);
    } else if (p.car) {
      const img = playerCarSprite(p.car.color);
      const w = 300;
      const h = 200;
      sctx.drawImage(img, RW / 2 - w / 2, RH - h - 2, w, h);
    }
  }

  /** Neon signs (HOTEL / BAR / TACOS) painted on the wall that carries them. */
  function drawSigns(state, cam, dirX, dirY, planeX, planeY, proj, horizon, zbuf, colBldg) {
    const seen = new Set();
    for (let c = 0; c < COLS; c += 1) {
      const b = colBldg[c];
      if (!b || !b.sign || seen.has(b)) continue;
      seen.add(b);
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const e = project(cam, dirX, dirY, planeX, planeY, proj, horizon, cx, cy, b.height * WALL * 0.85, 20, 4);
      if (!e || e.depth >= zbuf[Math.floor((e.sx / RW) * COLS)]) continue;
      sctx.font = `700 ${Math.max(10, Math.round(e.h))}px ${FONT}`;
      sctx.textAlign = 'center';
      sctx.fillStyle = (b.x + b.y) % 2 === 0 ? PALETTE.neonPink : PALETTE.neonCyan;
      sctx.globalAlpha = 0.65 + 0.35 * Math.sin(state.time * 3 + b.x * 0.7);
      sctx.fillText(b.sign, e.sx, e.bottom);
      sctx.globalAlpha = 1;
    }
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

  /** Paint one frame: the raycast world, then HUD or a panel. */
  function draw(state, screen, best, time) {
    const cam = state.camera;
    const shakeA = cam.shake ? (Math.random() - 0.5) * cam.shake * 0.004 : 0;
    const angle = (cam.angle ?? -Math.PI / 2) + shakeA;
    const fov = cam.fov ?? 1.15;
    const horizon = RH / 2 + (cam.shake ? (Math.random() - 0.5) * cam.shake * 0.5 : 0);
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const tanHalf = Math.tan(fov / 2);
    const planeX = -dirY * tanHalf;
    const planeY = dirX * tanHalf;
    const proj = (RW / 2) / tanHalf;
    wallGrid(state.city);
    const zbuf = new Array(COLS).fill(1e9);
    const colBldg = new Array(COLS).fill(null);
    // Scene, small.
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    drawSky(angle, fov, horizon, time);
    drawFloor(state, cam, dirX, dirY, planeX, planeY, proj, horizon);
    drawWalls(state, cam, dirX, dirY, planeX, planeY, proj, horizon, zbuf, colBldg);
    drawSprites(state, cam, dirX, dirY, planeX, planeY, proj, horizon, zbuf, time);
    drawSigns(state, cam, dirX, dirY, planeX, planeY, proj, horizon, zbuf, colBldg);
    // The player / their car only on the play screen: on the title and
    // end panels they would show through the panel and below it.
    if (screen === SCREEN_PLAY) drawSelf(state, cam, time);
    // Upscale onto the main canvas, then dusk + vignette.
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.drawImage(scene, 0, 0, VIEW.width, VIEW.height);
    const v = context.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.45, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.38)');
    context.fillStyle = v;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      drawPanel('NEON BAY', [
        'A sun-soaked city after dark. You are Kai Reyes,',
        'a driver with no money and a fast car to steal.',
        'Mara Voss has work for you — if you can lose the cops.',
        '',
        `Best haul yet: $${best}`,
        'WASD move • MOUSE look • RIGHT-CLICK aim • CLICK shoot',
        'E steal car • Q swap shoulder • P pause',
      ], 'Press Space or click to start');
      return;
    }
    const speedKmh = state.player.car ? Math.abs(state.player.car.speed) * 0.36 : null;
    drawHud(context, state, speedKmh);
    if (screen === SCREEN_PLAY) drawCrosshair(context, state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', '', 'Progress saves when a job ends.'], 'Press P to resume • S to save now');
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', ['You woke up at St. Marina Hospital.', 'The doctors kept $100.', `Haul so far: $${state.money}`], 'Press Space or click to play again');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Bayview police took you in.', 'They kept $100 of your money.', `Haul so far: $${state.money}`], 'Press Space or click to play again');
    }
  }

  /** Screen pixels (clientX/Y) → a world point along that screen ray. */
  function toWorld(clientX, clientY, cam) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const vx = (clientX * ratio - view.x) / view.scale;
    const vy = (clientY * ratio - view.y) / view.scale;
    const fov = cam.fov ?? 1.15;
    const tanHalf = Math.tan(fov / 2);
    const angle = cam.angle ?? -Math.PI / 2;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const planeX = -dirY * tanHalf;
    const planeY = dirX * tanHalf;
    const camX = (vx / VIEW.width) * 2 - 1;
    const rx = dirX + planeX * camX;
    const ry = dirY + planeY * camX;
    const len = Math.hypot(rx, ry) || 1;
    const d = 460;
    return { x: cam.x + (rx / len) * d, y: cam.y + (ry / len) * d };
  }

  /** World point → screen pixels (centre-ray projection), for the HUD. */
  function toScreen(wx, wy, cam) {
    const angle = cam.angle ?? -Math.PI / 2;
    const fov = cam.fov ?? 1.15;
    const tanHalf = Math.tan(fov / 2);
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const planeX = -dirY * tanHalf;
    const planeY = dirX * tanHalf;
    const dx = wx - cam.x;
    const dy = wy - cam.y;
    const depth = dx * dirX + dy * dirY;
    const lat = dx * planeX + dy * planeY;
    return {
      x: (VIEW.width / 2) * (1 + lat / Math.max(1, depth)),
      y: VIEW.height / 2,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toScreen, toWorld };
}
