import { CITY } from './config.js';

export const FLEET_KINDS = [
  'pumper', 'ladder', 'rescue', 'arff', 'ambulance',
  'moto-sport', 'moto-cruiser', 'moto-enduro',
];
export const FLEET_COLOR = {
  pumper: '#dc2626', ladder: '#dc2626', rescue: '#b91c1c', arff: '#eab308',
  ambulance: '#f8fafc', 'moto-sport': '#ef4444', 'moto-cruiser': '#1e293b', 'moto-enduro': '#f97316',
};

export function pickFleetKind(random) {
  const r = random();
  if (r < 0.15) return FLEET_KINDS[Math.floor(random() * 5)];
  if (r < 0.3) return FLEET_KINDS[5 + Math.floor(random() * 3)];
  return null;
}

function mat(THREE, color) {
  return new THREE.MeshLambertMaterial({ color });
}
function box(THREE, parent, w, h, d, x, y, z, color, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(THREE, color));
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = true;
  parent.add(m);
  return m;
}
function tube(THREE, parent, r, len, x, y, z, color, seg) {
  const geo = new THREE.CylinderGeometry(r, r, len, seg || 12);
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(THREE, color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function buildProp(THREE) {
  const g = new THREE.Group();
  tube(THREE, g, 0.7, 6.6, 0, 1.3, 0, 0xf8fafc, 14);
  box(THREE, g, 1.4, 0.2, 6.2, 0, 1.3, 0, 0x0284c7);
  box(THREE, g, 1.2, 0.5, 1.6, 0, 1.8, 0.5, 0x1e293b);
  box(THREE, g, 10.4, 0.16, 1.6, 0, 2.05, 0.35, 0xf8fafc);
  box(THREE, g, 0.14, 1.8, 1.2, 0, 2.1, -3, 0x0284c7);
  box(THREE, g, 3.3, 0.12, 0.9, 0, 1.4, -3.1, 0xf8fafc);
  const prop = new THREE.Group();
  prop.position.set(0, 1.3, 3.5);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.65, 10), mat(THREE, 0x1e293b));
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  const blade = box(THREE, prop, 2.5, 0.22, 0.06, 0, 0, 0.05, 0x0f172a);
  g.add(prop);
  return { group: g, spin: [prop], blades: [blade] };
}

function buildJet(THREE) {
  const g = new THREE.Group();
  tube(THREE, g, 1.6, 15, 0, 2.6, 0, 0xf1f5f9, 18);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 12), mat(THREE, 0xf1f5f9));
  nose.position.set(0, 2.6, 7.5); nose.scale.set(1, 1, 1.35); g.add(nose);
  tube(THREE, g, 1.6, 4, 0, 2.7, -9.5, 0xf1f5f9, 14);
  box(THREE, g, 3.3, 0.35, 14, 0, 2.3, 0.4, 0x1d4ed8);
  box(THREE, g, 11.2, 0.28, 3.1, -6, 2.2, -0.4, 0xf1f5f9, 0.32);
  box(THREE, g, 11.2, 0.28, 3.1, 6, 2.2, -0.4, 0xf1f5f9, -0.32);
  const fans = [];
  for (const x of [-4.5, 4.5]) {
    const nac = new THREE.Group();
    nac.position.set(x, 1.5, 0.35);
    tube(THREE, nac, 0.7, 2.2, 0, 0, 0, 0x334155, 14);
    const fan = box(THREE, nac, 1.1, 0.14, 0.12, 0, 0, 1, 0xe2e8f0);
    g.add(nac);
    fans.push(fan);
  }
  box(THREE, g, 0.35, 4.3, 2.7, 0, 5, -9.2, 0x1d4ed8);
  box(THREE, g, 7.4, 0.22, 1.7, 0, 3.1, -10, 0xf1f5f9);
  return { group: g, spin: fans, blades: [] };
}

function buildPrivate(THREE) {
  const g = new THREE.Group();
  tube(THREE, g, 0.95, 10, 0, 1.6, 0, 0xffffff, 16);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), mat(THREE, 0xffffff));
  nose.position.set(0, 1.6, 5); nose.scale.set(1, 1, 1.45); g.add(nose);
  tube(THREE, g, 0.9, 3.1, 0, 1.8, -6.4, 0xffffff, 12);
  box(THREE, g, 1.9, 0.14, 9.4, 0, 1.5, 0.2, 0xf59e0b);
  box(THREE, g, 6.6, 0.18, 1.7, -3.7, 1.4, 0.3, 0xffffff, 0.38);
  box(THREE, g, 6.6, 0.18, 1.7, 3.7, 1.4, 0.3, 0xffffff, -0.38);
  tube(THREE, g, 0.42, 1.8, -1.2, 2.2, -4.3, 0x1e293b, 12);
  tube(THREE, g, 0.42, 1.8, 1.2, 2.2, -4.3, 0x1e293b, 12);
  box(THREE, g, 0.24, 2.6, 1.7, 0, 3, -6.1, 0xf59e0b);
  box(THREE, g, 4.1, 0.14, 1.1, 0, 4.2, -6.7, 0xffffff);
  return { group: g, spin: [], blades: [] };
}

function buildStrip(THREE, scene) {
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 46),
    new THREE.MeshLambertMaterial({ color: 0x2b2f3a }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(CITY.width / 2, 0.6, CITY.beachY + 42);
  strip.receiveShadow = true;
  scene.add(strip);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xe8ecf2 });
  for (const x of [260, 2940]) {
    for (let k = -2; k <= 2; k += 1) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(26, 4), barMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(x, 0.8, CITY.beachY + 42 + k * 8);
      scene.add(bar);
    }
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 30, 6), mat(THREE, 0x8a8f9a));
  pole.position.set(240, 15, CITY.beachY + 10);
  scene.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(3, 12, 8), mat(THREE, 0xff5a5a));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(246, 29, CITY.beachY + 10);
  scene.add(sock);
}

export function createFleet(THREE, scene) {
  buildStrip(THREE, scene);
  const lanes = [
    { build: buildProp, y: 1000, h: 320, speed: 130, off: 1500, dir: 1, scale: 1 },
    { build: buildJet, y: 1450, h: 430, speed: 210, off: 400, dir: -1, scale: 1.6 },
    { build: buildPrivate, y: 620, h: 380, speed: 170, off: 2600, dir: 1, scale: 1.2 },
  ];
  const planes = lanes.map((lane) => {
    const made = lane.build(THREE);
    made.group.scale.setScalar(lane.scale);
    scene.add(made.group);
    return { ...lane, ...made };
  });
  let t = 0;
  const SPAN = 4000;
  return {
    update(dt, time, state) {
      t += dt;
      for (const pl of planes) {
        const raw = (pl.off + t * pl.speed * pl.dir) % SPAN;
        const x = (raw < 0 ? raw + SPAN : raw) - 400;
        pl.group.position.set(x, pl.h, pl.y);
        pl.group.rotation.y = pl.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        for (const s of pl.spin) s.rotation.z += dt * 30;
      }
    },
  };
}
