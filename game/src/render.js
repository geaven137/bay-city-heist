// Neon Bay — the Three.js stage.
// Creates the renderer, the golden-hour sky, the sun and the
// camera rig, then builds and syncs every mesh from the game
// state each frame. All Three.js use lives here and in the
// module mesh builders; the logic modules never touch it.

import { PALETTE, WORLD } from './config.js';
import { buildCityMeshes } from './world.js';
import { buildCarMesh, syncCarMesh } from './vehicles.js';
import { craftRig, animateRig } from './fleet.js';

export function createStage(canvas) {
  const T = globalThis.THREE;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new T.Scene();
  scene.fog = new T.Fog(PALETTE.fog, 260, 2400);
  const camera = new T.PerspectiveCamera(62, 16 / 9, 0.5, 6000);
  camera.up.set(0, 0, 1); // World is Z-up (ground XY, height Z); default Y-up rolls the view 90 deg.
  const hemi = new T.HemisphereLight(0x8a6fd6, 0x2c1a2e, 0.75);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-500, 420, 900);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -700;
  sun.shadow.camera.right = 700;
  sun.shadow.camera.top = 700;
  sun.shadow.camera.bottom = -700;
  sun.shadow.camera.far = 2600;
  scene.add(sun);
  // Golden-hour sky dome: a canvas gradient on a big sphere.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4;
  skyCanvas.height = 256;
  const g2 = skyCanvas.getContext('2d');
  const grad = g2.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2a1245');
  grad.addColorStop(0.45, '#7c2d5e');
  grad.addColorStop(0.72, '#e2603f');
  grad.addColorStop(1, '#ff8c42');
  g2.fillStyle = grad;
  g2.fillRect(0, 0, 4, 256);
  const skyTex = new T.CanvasTexture(skyCanvas);
  const sky = new T.Mesh(
    new T.SphereGeometry(3200, 24, 16),
    new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false })
  );
  scene.add(sky);
  return {
    renderer, scene, camera, sun,
    carMeshes: new Map(),
    pedMeshes: new Map(),
    planeMeshes: new Map(),
    heliMesh: null,
    heliRotor: null,
    points: null,
    pointsGeo: null,
  };
}

export function resizeStage(stage, w, h) {
  stage.renderer.setSize(w, h, false);
  stage.camera.aspect = w / h;
  stage.camera.updateProjectionMatrix();
}

function pedMesh(ped) {
  const T = globalThis.THREE;
  const g = new T.Group();
  const skin = new T.MeshStandardMaterial({ color: ped.skin, roughness: 0.8 });
  const shirt = new T.MeshStandardMaterial({ color: ped.shirt, roughness: 0.85 });
  const dark = new T.MeshStandardMaterial({ color: 0x22242a, roughness: 0.9 });
  const body = new T.Mesh(new T.BoxGeometry(1.1, 1.1, 2.6), shirt);
  body.position.z = 1.9;
  body.castShadow = true;
  g.add(body);
  const head = new T.Mesh(new T.BoxGeometry(0.85, 0.85, 0.85), skin);
  head.position.z = 3.7;
  head.castShadow = true;
  g.add(head);
  for (const s of [-0.35, 0.35]) {
    const leg = new T.Mesh(new T.BoxGeometry(0.38, 0.38, 1.4), dark);
    leg.position.set(s, 0, 0.7);
    g.add(leg);
  }
  return g;
}

function heliMesh() {
  const T = globalThis.THREE;
  const g = new T.Group();
  const body = new T.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.35, metalness: 0.3 });
  const dark = new T.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.6 });
  const fus = new T.Mesh(new T.BoxGeometry(2.6, 4.6, 1.9), body);
  fus.position.z = 0.4;
  fus.castShadow = true;
  g.add(fus);
  const nose = new T.Mesh(new T.BoxGeometry(2.2, 1.6, 1.4), dark);
  nose.position.set(0, 2.4, 0.6);
  g.add(nose);
  const tail = new T.Mesh(new T.BoxGeometry(0.7, 4.4, 0.7), body);
  tail.position.set(0, -3.8, 0.7);
  g.add(tail);
  const rotor = new T.Group();
  rotor.position.z = 1.8;
  const blade = new T.Mesh(new T.BoxGeometry(11, 0.22, 0.1), dark);
  rotor.add(blade);
  const blade2 = new T.Mesh(new T.BoxGeometry(0.22, 11, 0.1), dark);
  rotor.add(blade2);
  g.add(rotor);
  // Spotlight cone, translucent. ConeGeometry points along +Y; a
  // -90 deg X rotation aims the apex up (at the heli) and the wide
  // base down at the street. (rotation.x = PI left it horizontal.)
  const cone = new T.Mesh(
    new T.ConeGeometry(9, 26, 16, 1, true),
    new T.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.14, side: T.DoubleSide, depthWrite: false })
  );
  cone.rotation.x = -Math.PI / 2;
  cone.position.set(0, 0.5, -13);
  g.add(cone);
  g.userData.rotor = rotor;
  return g;
}

export function buildSceneMeshes(stage, state) {
  buildCityMeshes(stage.scene, state.city);
  for (const car of state.cars) {
    ensureCarMesh(stage, car);
  }
  for (const ped of state.peds) {
    const m = pedMesh(ped);
    stage.scene.add(m);
    stage.pedMeshes.set(ped, m);
  }
  for (const pl of state.fleet.planes) {
    const rig = craftRig(pl.kind);
    pl.rig = rig;
    stage.scene.add(rig);
    stage.planeMeshes.set(pl, rig);
  }
  const hm = heliMesh();
  stage.scene.add(hm);
  stage.heliMesh = hm;
  stage.heliRotor = hm.userData.rotor;
  // Particles as one Points cloud.
  const T = globalThis.THREE;
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(420 * 3), 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(420 * 3), 3));
  const mat = new T.PointsMaterial({ size: 3.2, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true });
  const points = new T.Points(geo, mat);
  points.frustumCulled = false;
  stage.scene.add(points);
  stage.points = points;
  stage.pointsGeo = geo;
}

function ensureCarMesh(stage, car) {
  if (car.mesh) return car.mesh;
  let mesh;
  if (car.kind === 'pumper' || car.kind === 'ladder' || car.kind === 'rescue' || car.kind === 'arff' || car.kind === 'ambulance' || car.kind === 'sport' || car.kind === 'cruiser' || car.kind === 'enduro') {
    mesh = craftRig(car.kind);
    car.rig = mesh;
  } else {
    mesh = buildCarMesh(car);
  }
  stage.scene.add(mesh);
  stage.carMeshes.set(car, mesh);
  return mesh;
}

function updateCamera(stage, state) {
  const T = globalThis.THREE;
  const p = state.player;
  const cam = stage.camera;
  const shoulder = state.camera.shoulder || 1;
  const aiming = state.input ? state.input.rightDown : false;
  let dist, height, side;
  if (p.onFoot) {
    if (aiming) {
      dist = 6.5;
      height = 3.4;
      side = 2.2 * shoulder;
    } else {
      dist = 11;
      height = 4.6;
      side = 0;
    }
  } else {
    dist = 17;
    height = 6.4;
    side = aiming ? 2.4 * shoulder : 0;
  }
  const fx = Math.cos(p.angle);
  const fy = Math.sin(p.angle);
  const px = -fy;
  const py = fx;
  const cx = p.x - fx * dist + px * side;
  const cy = p.y - fy * dist + py * side;
  const cz = height;
  const shake = state.camera.shake;
  const jx = shake > 0 ? (Math.random() - 0.5) * shake * 0.4 : 0;
  const jy = shake > 0 ? (Math.random() - 0.5) * shake * 0.4 : 0;
  cam.position.set(cx + jx, cy + jy, cz);
  const lookX = p.x + fx * 26;
  const lookY = p.y + fy * 26;
  const lookZ = p.onFoot ? 2.4 : 2.0;
  cam.lookAt(lookX, lookY, lookZ);
  // Sun follows the player so shadows stay crisp.
  stage.sun.position.set(p.x - 500, p.y + 420, 900);
  stage.sun.target.position.set(p.x, p.y, 0);
  stage.sun.target.updateMatrixWorld();
}

export function drawFrame(stage, state, dt) {
  const T = globalThis.THREE;
  for (const car of state.cars) {
    const mesh = ensureCarMesh(stage, car);
    if (car.rig) {
      mesh.position.set(car.x, car.y, 0);
      // Rigs are built Y-up and carry rotation.x = +PI/2 (see
      // craftRig), so the heading here is angle + PI/2, not - PI/2:
      // with the X-flip, -PI/2 would point the rig backwards.
      mesh.rotation.z = car.angle + Math.PI / 2;
      animateRig(car.rig, dt, state.time, car.speed);
    } else {
      syncCarMesh(car);
    }
  }
  for (const ped of state.peds) {
    const m = stage.pedMeshes.get(ped);
    if (!m) continue;
    m.position.set(ped.x, ped.y, 0);
    m.rotation.z = ped.angle - Math.PI / 2;
    if (ped.down) {
      m.rotation.x = Math.PI / 2;
      m.position.z = 0.5;
    } else {
      m.rotation.x = 0;
      m.position.z = Math.abs(Math.sin(ped.stride)) * 0.35;
    }
    m.visible = true;
  }
  for (const pl of state.fleet.planes) {
    const rig = stage.planeMeshes.get(pl);
    if (!rig) continue;
    rig.position.set(pl.x, pl.y, pl.z);
    // Only the heading is refreshed here; rotation.x = +PI/2 (set
    // in craftRig, the Y-up -> Z-up conversion) must be left alone.
    rig.rotation.z = pl.angle + Math.PI / 2;
  }
  if (stage.heliMesh) {
    const hm = stage.heliMesh;
    if (state.heli) {
      hm.visible = true;
      hm.position.set(state.heli.x, state.heli.y, state.heli.z);
      hm.rotation.z = state.heli.angle - Math.PI / 2;
      if (stage.heliRotor) stage.heliRotor.rotation.z += dt * 24;
    } else {
      hm.visible = false;
    }
  }
  // Particles into the Points cloud.
  if (stage.pointsGeo) {
    const posAttr = stage.pointsGeo.getAttribute('position');
    const colAttr = stage.pointsGeo.getAttribute('color');
    const col = new T.Color();
    const list = state.particles;
    for (let i = 0; i < 420; i++) {
      if (i < list.length) {
        const pt = list[i];
        posAttr.setXYZ(i, pt.x, pt.y, pt.z);
        col.set(pt.color);
        colAttr.setXYZ(i, col.r, col.g, col.b);
      } else {
        posAttr.setXYZ(i, 0, 0, -100);
        colAttr.setXYZ(i, 0, 0, 0);
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    stage.pointsGeo.setDrawRange(0, Math.max(0, list.length));
  }
  updateCamera(stage, state);
  stage.renderer.render(stage.scene, stage.camera);
}
