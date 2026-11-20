// Neon Bay — the Palmera fleet.
// Three planes that cross the sky, four fire trucks, an ambulance
// and three motorcycles, all built from boxes and cylinders in
// this file's own style. Wheels spin, propellers turn, turbines
// whir and beacons flash; the animation hooks live on each rig
// under userData.spin.

import { tyre, spawnCar } from './vehicles.js';

export const RIG_KINDS = [
  'prop', 'twinjet', 'jet',
  'pumper', 'ladder', 'rescue', 'arff',
  'ambulance',
  'sport', 'cruiser', 'enduro',
];

function skin(color, rough, metal, glow, glowColor) {
  const T = globalThis.THREE;
  const m = new T.MeshStandardMaterial({ color, roughness: rough ?? 0.4, metalness: metal ?? 0.3 });
  if (glow) {
    m.emissive = new T.Color(glowColor ?? color);
    m.emissiveIntensity = glow;
  }
  return m;
}

function bolt(parent, geo, material, x, y, z, rx, ry, rz) {
  const T = globalThis.THREE;
  const mesh = new T.Mesh(geo, material);
  mesh.position.set(x, y, z);
  if (rx || ry || rz) mesh.rotation.set(rx || 0, ry || 0, rz || 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function freshSpin() {
  return { props: [], fans: [], wheels: [], beacons: [], ladder: null, boom: null, turret: null };
}

function addWheels(root, spin, spots, radius, width) {
  for (const [x, y, z] of spots) {
    const w = tyre(radius, width);
    w.position.set(x, y, z);
    root.add(w);
    spin.wheels.push(w);
  }
}

export function craftRig(kind) {
  const T = globalThis.THREE;
  const root = new T.Group();
  root.userData.kind = kind;
  const spin = freshSpin();
  root.userData.spin = spin;
  // Rigs are built in Y-up convention (up = +Y, forward = +Z), but
  // this world is Z-up. Rotate the root +90 deg about X once here
  // (rig +Y -> world +Z, rig +Z -> world -Y); drawFrame then uses
  // heading angle + PI/2 so the rig faces its direction of travel.
  // The root MUST use Euler order 'ZYX': with the default 'XYZ'
  // the matrix is Rx*Rz (Z applied first), which would roll the rig
  // sideways instead of yawing it. 'ZYX' gives Rz*Rx, i.e. the
  // X-flip first, then the heading yaw about world Z.
  root.rotation.order = 'ZYX';
  root.rotation.x = Math.PI / 2;

  if (kind === 'prop') {
    const white = skin(0xf4f7fa, 0.35, 0.35);
    const stripe = skin(0x0e7490, 0.4, 0.3);
    const glass = skin(0x17263b, 0.1, 0.85);
    const bodyGeo = new T.CylinderGeometry(0.66, 0.52, 6.4, 16);
    bodyGeo.rotateX(Math.PI / 2);
    bolt(root, bodyGeo, white, 0, 0, 1.2);
    bolt(root, new T.BoxGeometry(1.36, 0.2, 6.0), stripe, 0, 0, 1.2);
    bolt(root, new T.BoxGeometry(1.1, 0.48, 1.5), glass, 0, 0.5, 0.6, 0.1, 0, 0);
    bolt(root, new T.BoxGeometry(9.8, 0.14, 1.5), white, 0, 0.72, 0.3);
    bolt(root, new T.BoxGeometry(9.8, 0.05, 1.55), stripe, 0, 0.8, 0.3);
    bolt(root, new T.BoxGeometry(0.13, 1.7, 1.1), stripe, 0, 0.8, -2.8, -0.2, 0, 0);
    bolt(root, new T.BoxGeometry(3.1, 0.11, 0.9), white, 0, 0.1, -2.9);
    const prop = new T.Group();
    prop.position.set(0, 0, 4.6);
    bolt(prop, new T.ConeGeometry(0.24, 0.6, 12), skin(0x1e293b, 0.4, 0.7), 0, 0, 0.2, Math.PI / 2, 0, 0);
    bolt(prop, new T.BoxGeometry(2.3, 0.2, 0.06), skin(0x0f172a, 0.5, 0.3), 0, 0, 0.05);
    root.add(prop);
    spin.props.push(prop);
    addWheels(root, spin, [[0, 0.3, 2.0], [-1.25, 0.35, 0.1], [1.25, 0.35, 0.1]], 0.34, 0.18);
  } else if (kind === 'twinjet') {
    const hull = skin(0xeef2f6, 0.3, 0.4);
    const livery = skin(0x1e40af, 0.35, 0.3);
    const engine = skin(0x334155, 0.35, 0.75);
    const fuseGeo = new T.CylinderGeometry(1.5, 1.5, 14.5, 22);
    fuseGeo.rotateX(Math.PI / 2);
    bolt(root, fuseGeo, hull, 0, 0, 2.4);
    bolt(root, new T.SphereGeometry(1.5, 22, 14), hull, 0, 0, 9.6, 0, 0, 0, 1, 1, 1.3);
    const tailGeo = new T.CylinderGeometry(1.5, 0.5, 3.8, 18);
    tailGeo.rotateX(-Math.PI / 2);
    bolt(root, tailGeo, hull, 0, 0.15, -6.4);
    bolt(root, new T.BoxGeometry(3.04, 0.32, 13.5), livery, 0, -0.25, 2.4);
    bolt(root, new T.BoxGeometry(10.8, 0.26, 3.0), hull, -5.8, -0.35, 0.2, 0, 0.3, -0.04);
    bolt(root, new T.BoxGeometry(10.8, 0.26, 3.0), hull, 5.8, -0.35, 0.2, 0, -0.3, 0.04);
    for (const ex of [-4.3, 4.3]) {
      const nac = new T.Group();
      nac.position.set(ex, -1.0, 0.6);
      const podGeo = new T.CylinderGeometry(0.66, 0.62, 2.1, 16);
      podGeo.rotateX(Math.PI / 2);
      bolt(nac, podGeo, engine);
      const fan = bolt(nac, new T.BoxGeometry(1.05, 0.12, 0.1), skin(0xe2e8f0, 0.2, 0.9), 0, 0, 1.0);
      root.add(nac);
      spin.fans.push(fan);
    }
    bolt(root, new T.BoxGeometry(0.32, 4.0, 2.6), livery, 0, 2.4, -6.2, -0.4, 0, 0);
    bolt(root, new T.BoxGeometry(7.0, 0.2, 1.7), hull, 0, 0.5, -7.0);
    addWheels(root, spin, [[0, 0.5, 5.2], [-2.2, 0.62, -0.6], [2.2, 0.62, -0.6]], 0.6, 0.34);
  } else if (kind === 'jet') {
    const white = skin(0xffffff, 0.2, 0.45);
    const gold = skin(0xd97706, 0.3, 0.7);
    const dark = skin(0x1e293b, 0.25, 0.7);
    const bodyGeo = new T.CylinderGeometry(0.88, 0.82, 9.4, 18);
    bodyGeo.rotateX(Math.PI / 2);
    bolt(root, bodyGeo, white, 0, 0, 1.5);
    bolt(root, new T.SphereGeometry(0.88, 18, 12), white, 0, 0, 6.2, 0, 0, 0, 1, 1, 1.4);
    const tailGeo = new T.CylinderGeometry(0.82, 0.32, 2.9, 14);
    tailGeo.rotateX(-Math.PI / 2);
    bolt(root, tailGeo, white, 0, 0.2, -4.8);
    bolt(root, new T.BoxGeometry(1.8, 0.13, 8.8), gold, 0, -0.1, 1.5);
    bolt(root, new T.BoxGeometry(6.3, 0.16, 1.6), white, -3.5, -0.2, 0.4, 0, 0.35, -0.05);
    bolt(root, new T.BoxGeometry(6.3, 0.16, 1.6), white, 3.5, -0.2, 0.4, 0, -0.35, 0.05);
    for (const ex of [-1.15, 1.15]) {
      const engGeo = new T.CylinderGeometry(0.38, 0.36, 1.7, 14);
      engGeo.rotateX(Math.PI / 2);
      bolt(root, engGeo, dark, ex, 0.55, -2.6);
    }
    bolt(root, new T.BoxGeometry(0.22, 2.5, 1.6), gold, 0, 1.4, -4.6, -0.32, 0, 0);
    bolt(root, new T.BoxGeometry(3.9, 0.13, 1.0), white, 0, 2.6, -5.1);
    addWheels(root, spin, [[0, 0.33, 3.3], [-1.4, 0.38, -0.3], [1.4, 0.38, -0.3]], 0.38, 0.22);
  } else if (kind === 'pumper' || kind === 'ladder' || kind === 'rescue' || kind === 'arff') {
    const isArff = kind === 'arff';
    const body = skin(isArff ? 0xd9a514 : 0xc1272d, 0.32, 0.4);
    const chrome = skin(0xe2e8f0, 0.2, 0.9);
    const redB = skin(0xef4444, 0.4, 0.2, 1.5, 0xef4444);
    const whiteB = skin(0xffffff, 0.4, 0.2, 1.3, 0xffffff);
    const len = kind === 'ladder' ? 7.6 : isArff ? 7.0 : 6.0;
    const wid = isArff ? 2.7 : 2.3;
    bolt(root, new T.BoxGeometry(wid, 1.25, 2.0), body, 0, 0, len * 0.32);
    bolt(root, new T.BoxGeometry(wid - 0.04, 1.45, len * 0.62), body, 0, 0.1, -len * 0.12);
    bolt(root, new T.BoxGeometry(wid + 0.06, 0.11, len * 0.64), chrome, 0, -0.62, -len * 0.12);
    const s1 = bolt(root, new T.BoxGeometry(0.42, 0.18, 0.28), redB, -0.5, 0.78, len * 0.32);
    const s2 = bolt(root, new T.BoxGeometry(0.42, 0.18, 0.28), whiteB, 0.5, 0.78, len * 0.32);
    spin.beacons.push(s1, s2);
    if (kind === 'ladder') {
      const table = new T.Group();
      table.position.set(0, 0.9, -0.4);
      const boom = new T.Group();
      boom.position.set(0, 0.12, 0);
      boom.rotation.x = -0.35;
      bolt(boom, new T.BoxGeometry(0.3, 0.26, 5.2), chrome, 0, 0.12, -2.0);
      bolt(boom, new T.BoxGeometry(0.22, 0.18, 4.4), body, 0, 0.3, -2.4);
      table.add(boom);
      root.add(table);
      spin.ladder = table;
      spin.boom = boom;
    }
    if (kind === 'rescue') {
      bolt(root, new T.BoxGeometry(wid + 0.12, 0.85, 2.2), chrome, 0, 0.05, -0.3);
      bolt(root, new T.BoxGeometry(0.15, 1.1, 0.15), chrome, 0, 1.4, -1.6);
    }
    if (isArff) {
      const turret = new T.Group();
      turret.position.set(0, 0.92, 1.4);
      bolt(turret, new T.BoxGeometry(0.4, 0.32, 1.0), chrome, 0, 0.08, 0.28);
      root.add(turret);
      spin.turret = turret;
    }
    const wr = isArff ? 0.58 : 0.46;
    const wz = kind === 'ladder' ? [2.4, -1.1, -2.9] : [1.9, -1.8];
    for (const z of wz) {
      addWheels(root, spin, [[-wid * 0.52, 0, z], [wid * 0.52, 0, z]], wr, 0.36);
    }
  } else if (kind === 'ambulance') {
    const white = skin(0xf8fafc, 0.3, 0.25);
    const med = skin(0xdc2626, 0.35, 0.3);
    const blueB = skin(0x2563eb, 0.4, 0.2, 1.4, 0x2563eb);
    bolt(root, new T.BoxGeometry(2.0, 0.8, 1.9), white, 0, -0.42, 1.5);
    bolt(root, new T.BoxGeometry(2.08, 1.45, 3.4), white, 0, 0.08, -1.0);
    bolt(root, new T.BoxGeometry(2.12, 0.22, 3.45), med, 0, 0.1, -1.0);
    bolt(root, new T.BoxGeometry(2.14, 0.52, 0.17), med, 0, 0.3, -1.0);
    bolt(root, new T.BoxGeometry(2.14, 0.17, 0.52), med, 0, 0.3, -1.0);
    const st = bolt(root, new T.BoxGeometry(0.85, 0.18, 0.26), blueB, 0, 0.92, 1.7);
    spin.beacons.push(st);
    addWheels(root, spin, [[-1.0, 0, 1.7], [1.0, 0, 1.7], [-1.0, 0, -1.6], [1.0, 0, -1.6]], 0.4, 0.28);
  } else {
    // Motorcycles: sport, cruiser, enduro.
    const paintMap = { sport: 0xdc2626, cruiser: 0x1e293b, enduro: 0xea580c };
    const bike = skin(paintMap[kind] ?? 0xdc2626, 0.28, 0.6);
    const chrome = skin(0xd4d4d8, 0.2, 0.9);
    const seat = skin(0x18181b, 0.85, 0.05);
    const seatY = kind === 'enduro' ? 0.9 : kind === 'cruiser' ? 0.62 : 0.72;
    const wheelR = kind === 'enduro' ? 0.4 : 0.33;
    bolt(root, new T.BoxGeometry(0.4, 0.32, 1.05), bike, 0, seatY + 0.12, 0.12);
    bolt(root, new T.BoxGeometry(0.34, 0.13, 0.72), seat, 0, seatY + 0.05, -0.5);
    bolt(root, new T.BoxGeometry(0.78, 0.06, 0.09), chrome, 0, seatY + 0.32, 0.5);
    if (kind === 'sport') {
      bolt(root, new T.BoxGeometry(0.46, 0.4, 0.7), bike, 0, seatY + 0.06, 0.66, 0.42, 0, 0);
    } else if (kind === 'cruiser') {
      bolt(root, new T.BoxGeometry(0.11, 0.42, 0.11), chrome, 0, seatY + 0.48, 0.5);
      const pipeGeo = new T.CylinderGeometry(0.11, 0.11, 1.15, 10);
      pipeGeo.rotateX(Math.PI / 2);
      bolt(root, pipeGeo, chrome, 0.26, 0.4, -0.32);
    } else {
      bolt(root, new T.BoxGeometry(0.3, 0.09, 0.42), bike, 0, wheelR * 2 + 0.1, 0.76, 0.22, 0, 0);
    }
    addWheels(root, spin, [[0, 0, 0.88], [0, 0, -0.85]], wheelR, 0.15);
  }
  return root;
}

export function animateRig(rig, dt, elapsed, speed) {
  const spin = rig && rig.userData ? rig.userData.spin : null;
  if (!spin) return;
  for (const p of spin.props) p.rotation.z += dt * 34;
  for (const f of spin.fans) f.rotation.z += dt * 26;
  for (const w of spin.wheels) w.rotation.x += dt * (speed || 4);
  spin.beacons.forEach((b, i) => {
    const pulse = Math.sin(elapsed * 13 + i * Math.PI);
    if (b.material && b.material.emissiveIntensity !== undefined) {
      b.material.emissiveIntensity = pulse > 0 ? 1.8 : 0.25;
    }
  });
  if (spin.ladder) spin.ladder.rotation.y = Math.sin(elapsed * 0.7) * 0.4;
  if (spin.boom) spin.boom.rotation.x = -0.35 + Math.sin(elapsed * 1.05) * 0.14;
  if (spin.turret) spin.turret.rotation.y = Math.sin(elapsed * 1.3) * 0.5;
}

export function spawnFleet(state) {
  const rng = state.rng;
  state.fleet = { planes: [] };
  const planeKinds = ['prop', 'twinjet', 'jet'];
  for (let i = 0; i < 3; i++) {
    state.fleet.planes.push({
      kind: planeKinds[i],
      x: rng.range(-900, 900),
      y: rng.range(700, 2000),
      z: 130 + i * 28,
      angle: rng.pick([0, Math.PI]),
      speed: 95 + i * 18,
      mesh: null,
      rig: null,
    });
  }
  const ground = [
    ['pumper', 1420, 1820, 0],
    ['ladder', 1560, 1820, 0],
    ['rescue', 1640, 1820, 0],
    ['arff', 1720, 1820, 0],
    ['ambulance', 480, 1460, Math.PI / 2],
  ];
  for (const [kind, x, y, a] of ground) {
    const car = spawnCar(state, kind, x, y, a);
    car.targetSpeed = 0;
    state.cars.push(car);
  }
  const motoKinds = ['sport', 'cruiser', 'enduro'];
  for (let i = 0; i < 3; i++) {
    const car = spawnCar(state, motoKinds[i], 700 + i * 260, 2080, 0);
    car.targetSpeed = 30 + i * 6;
    car.speed = car.targetSpeed;
    state.cars.push(car);
  }
}

export function stepFleet(state, dt) {
  for (const pl of state.fleet.planes) {
    pl.x += Math.cos(pl.angle) * pl.speed * dt;
    pl.y += Math.sin(pl.angle) * pl.speed * dt;
    if (pl.x > 2300 || pl.x < -1100 || pl.y > 2400 || pl.y < -1200) {
      pl.angle += Math.PI;
      pl.x = Math.max(-1000, Math.min(2200, pl.x));
      pl.y = Math.max(-1100, Math.min(2300, pl.y));
    }
    if (pl.rig) animateRig(pl.rig, dt, state.time, pl.speed);
  }
  for (const car of state.cars) {
    if (car.kind === 'sport' || car.kind === 'cruiser' || car.kind === 'enduro') {
      car.speed += Math.max(-260 * dt, Math.min(260 * dt, car.targetSpeed - car.speed));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.x > 2100 || car.x < 480) {
        car.angle += Math.PI;
        car.x = Math.max(480, Math.min(2100, car.x));
      }
    }
    if (car.rig) animateRig(car.rig, dt, state.time, car.speed);
  }
}
