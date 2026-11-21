// Neon Bay — the city of St. Marina.
// generateCity is pure math: it lays out blocks, buildings,
// palms, lamps and parks from a seed, so the city is identical
// every run of that seed. buildCityMeshes turns that data into
// Three.js objects, and only runs in the browser.

import { WORLD, PALETTE } from './config.js';

export function generateCity(rng) {
  const gap = WORLD.roadGap;
  const half = WORLD.half;
  const blocks = [];
  for (let gx = -7; gx <= 7; gx++) {
    for (let gy = -7; gy <= 7; gy++) {
      const cx = gx * gap + gap / 2;
      const cy = gy * gap + gap / 2;
      if (cy > 1760) continue;
      if (Math.abs(cx - 1500) < 280 && cy > 1680 && cy < 2080) continue;
      blocks.push({ x: cx, y: cy });
    }
  }
  const shuffled = rng.shuffle(blocks);
  const buildings = [];
  for (const b of shuffled) {
    if (buildings.length >= WORLD.buildingCount) break;
    if (rng.chance(0.28)) continue;
    buildings.push({
      x: b.x + rng.range(-12, 12),
      y: b.y + rng.range(-12, 12),
      w: rng.range(46, 92),
      d: rng.range(46, 92),
      h: rng.range(34, 150),
      roof: rng.pick(PALETTE.roofPastel),
      wall: rng.pick(PALETTE.wallWarm),
    });
  }
  const parks = [];
  for (let i = 0; i < WORLD.parkCount; i++) {
    parks.push({
      x: rng.range(-half + 160, half - 160),
      y: rng.range(-half + 160, 1700),
      r: rng.range(70, 130),
    });
  }
  const palms = [];
  for (let i = 0; i < WORLD.palmCount; i++) {
    if (rng.chance(0.45)) {
      palms.push({ x: rng.range(520, 2050), y: rng.chance(0.5) ? rng.range(1920, 1985) : rng.range(2120, 2160), s: rng.range(0.8, 1.3) });
    } else {
      const park = parks[i % parks.length];
      const a = rng.next() * Math.PI * 2;
      palms.push({ x: park.x + Math.cos(a) * park.r * 0.7, y: park.y + Math.sin(a) * park.r * 0.7, s: rng.range(0.8, 1.2) });
    }
  }
  const lamps = [];
  for (let k = -7; k <= 7; k++) {
    for (let t = -1100; t <= 1100; t += 220) {
      if (lamps.length >= WORLD.lampCount) break;
      if (rng.chance(0.5)) lamps.push({ x: k * gap + 18, y: t });
      if (lamps.length >= WORLD.lampCount) break;
      if (rng.chance(0.5)) lamps.push({ x: t, y: k * gap - 18 });
    }
    if (lamps.length >= WORLD.lampCount) break;
  }
  return {
    buildings,
    palms,
    lamps,
    parks,
    airstrip: { x: 1500, y: 1890, len: 520, wid: 46, angle: 0 },
    gap,
    half,
  };
}

// True when (x, y) sits on a road centreline (within half width).
export function onRoad(x, y) {
  const gap = WORLD.roadGap;
  const w = WORLD.roadWidth / 2 + 6;
  const fx = Math.abs(((x % gap) + gap) % gap - gap / 2);
  const fy = Math.abs(((y % gap) + gap) % gap - gap / 2);
  const nearX = Math.min(fx, gap - fx) < w;
  const nearY = Math.min(fy, gap - fy) < w;
  return nearX || nearY;
}

// Distance from (x, y) to the beach road centreline.
export function beachGap(x, y) {
  return Math.abs(y - WORLD.beachY);
}

export function buildCityMeshes(scene, city) {
  const T = globalThis.THREE;
  // NOTE: this world is Z-up — the ground IS the XY plane, so
  // PlaneGeometry / CircleGeometry (already XY, facing +Z) must NOT
  // be rotated. (An earlier build used rotation.x = -PI/2, the Y-up
  // trick, which turned every ground/road plane into a vertical
  // wall and left the camera staring at the bare sky.)
  const ground = new T.Mesh(
    new T.PlaneGeometry(WORLD.size * 1.6, WORLD.size * 1.6),
    new T.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 })
  );
  ground.position.set(0, 0, -0.5);
  ground.receiveShadow = true;
  scene.add(ground);

  const sea = new T.Mesh(
    new T.PlaneGeometry(2600, 420),
    new T.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.35 })
  );
  sea.position.set(900, WORLD.seaY + 120, 0.5);
  sea.receiveShadow = true;
  scene.add(sea);

  const sand = new T.Mesh(
    new T.PlaneGeometry(2400, 130),
    new T.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 })
  );
  sand.position.set(900, 2180, 0.2);
  sand.receiveShadow = true;
  scene.add(sand);

  // Asphalt strips for the grid roads.
  const roadMat = new T.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.95 });
  for (let k = -7; k <= 7; k++) {
    const c = k * WORLD.roadGap;
    const v = new T.Mesh(new T.PlaneGeometry(WORLD.roadWidth, WORLD.size), roadMat);
    v.position.set(c, 0, 0.05);
    v.receiveShadow = true;
    scene.add(v);
    const h = new T.Mesh(new T.PlaneGeometry(WORLD.size, WORLD.roadWidth), roadMat);
    h.position.set(0, c, 0.05);
    h.receiveShadow = true;
    scene.add(h);
  }
  const beach = new T.Mesh(new T.PlaneGeometry(1800, WORLD.roadWidth + 6), roadMat);
  beach.position.set(1250, WORLD.beachY, 0.05);
  beach.receiveShadow = true;
  scene.add(beach);

  // Buildings as one instanced mesh, coloured per instance.
  const boxGeo = new T.BoxGeometry(1, 1, 1);
  const boxMat = new T.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 });
  const inst = new T.InstancedMesh(boxGeo, boxMat, city.buildings.length);
  const m4 = new T.Matrix4();
  const q = new T.Quaternion();
  const sc = new T.Vector3();
  const pos = new T.Vector3();
  const col = new T.Color();
  city.buildings.forEach((b, i) => {
    pos.set(b.x, b.y, b.h / 2);
    sc.set(b.w, b.d, b.h);
    m4.compose(pos, q, sc);
    inst.setMatrixAt(i, m4);
    col.setHex(b.wall);
    inst.setColorAt(i, col);
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  scene.add(inst);
  // Pastel roof caps, also instanced.
  const roofGeo = new T.BoxGeometry(1, 1, 1);
  const roofMat = new T.MeshStandardMaterial({ roughness: 0.7, metalness: 0.1 });
  const roofs = new T.InstancedMesh(roofGeo, roofMat, city.buildings.length);
  city.buildings.forEach((b, i) => {
    pos.set(b.x, b.y, b.h + 2);
    sc.set(b.w + 4, b.d + 4, 4);
    m4.compose(pos, q, sc);
    roofs.setMatrixAt(i, m4);
    col.setHex(b.roof);
    roofs.setColorAt(i, col);
  });
  roofs.castShadow = true;
  scene.add(roofs);

  // Palms: instanced trunks and canopies. Cylinders/cones are built
  // along local Y, so each instance gets a +90 deg X rotation (qUp)
  // to stand them upright along world Z. (Without it the trunks lie
  // flat on the ground and the canopies point sideways.)
  const qUp = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2);
  const trunkGeo = new T.CylinderGeometry(0.35, 0.55, 14, 7);
  const trunkMat = new T.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
  const trunks = new T.InstancedMesh(trunkGeo, trunkMat, city.palms.length);
  const canopyGeo = new T.ConeGeometry(5.4, 7, 6);
  const canopyMat = new T.MeshStandardMaterial({ color: 0x2f9e44, roughness: 0.9 });
  const canopies = new T.InstancedMesh(canopyGeo, canopyMat, city.palms.length);
  city.palms.forEach((p, i) => {
    pos.set(p.x, p.y, 7 * p.s);
    sc.set(p.s, p.s, p.s);
    m4.compose(pos, qUp, sc);
    trunks.setMatrixAt(i, m4);
    pos.set(p.x, p.y, (14 + 3) * p.s);
    m4.compose(pos, qUp, sc);
    canopies.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  canopies.castShadow = true;
  scene.add(trunks);
  scene.add(canopies);

  // Lamp posts, instanced. Posts are cylinders: same qUp so they
  // stand up; bulbs are spheres, rotation-free.
  const postGeo = new T.CylinderGeometry(0.22, 0.3, 11, 6);
  const postMat = new T.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.5 });
  const posts = new T.InstancedMesh(postGeo, postMat, city.lamps.length);
  const bulbGeo = new T.SphereGeometry(0.85, 8, 6);
  const bulbMat = new T.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xffe9a8, emissiveIntensity: 1.6 });
  const bulbs = new T.InstancedMesh(bulbGeo, bulbMat, city.lamps.length);
  city.lamps.forEach((l, i) => {
    pos.set(l.x, l.y, 5.5);
    sc.set(1, 1, 1);
    m4.compose(pos, qUp, sc);
    posts.setMatrixAt(i, m4);
    pos.set(l.x, l.y, 11.2);
    m4.compose(pos, q, sc);
    bulbs.setMatrixAt(i, m4);
  });
  scene.add(posts);
  scene.add(bulbs);

  // Parks as flat green discs (CircleGeometry is already XY: no rotation).
  const parkMat = new T.MeshStandardMaterial({ color: 0x2b6b34, roughness: 1 });
  for (const pk of city.parks) {
    const disc = new T.Mesh(new T.CircleGeometry(pk.r, 20), parkMat);
    disc.position.set(pk.x, pk.y, 0.15);
    disc.receiveShadow = true;
    scene.add(disc);
  }

  // Airstrip: runway + windsock pole.
  const strip = city.airstrip;
  const runway = new T.Mesh(
    new T.PlaneGeometry(strip.len, strip.wid),
    new T.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.95 })
  );
  runway.position.set(strip.x, strip.y, 0.1);
  runway.receiveShadow = true;
  scene.add(runway);
  const sockPole = new T.Mesh(
    new T.CylinderGeometry(0.25, 0.3, 16, 6),
    new T.MeshStandardMaterial({ color: 0xd7dde3, roughness: 0.5, metalness: 0.6 })
  );
  sockPole.rotation.x = Math.PI / 2; // cylinder Y-axis -> world Z (stand up)
  sockPole.position.set(strip.x + strip.len / 2 + 30, strip.y + 30, 8);
  sockPole.castShadow = true;
  scene.add(sockPole);
  const sock = new T.Mesh(
    new T.ConeGeometry(1.6, 6, 8),
    new T.MeshStandardMaterial({ color: 0xff6b35, roughness: 0.8 })
  );
  sock.rotation.z = -Math.PI / 2;
  sock.position.set(strip.x + strip.len / 2 + 33, strip.y + 30, 15);
  scene.add(sock);
}
// Round 9: NEON BAY design pack integration point (see src/designs.js).
if (typeof window !== 'undefined') { (window.__NEON_POINTS__ = window.__NEON_POINTS__ || []).push('world.js'); }
