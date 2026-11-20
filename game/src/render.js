import { CAM3D, CITY, FONT, PALETTE, VIEW } from './config.js';
import { drawCrosshair, drawHud } from './hud.js';
import { HL } from './patchkit.js';
import { missionTarget } from './missions.js';
import { roadCentresX, roadCentresY } from './world.js';
import { carSpeedKmh } from './vehicles.js';
import { createFleet } from './fleet.js';
import { drawShop } from './shop.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

let THREE = null;
const P2 = Math.PI / 2;
const rotY = (th) => P2 - th;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}
function hexNum(hex) { return parseInt(hex.slice(1), 16); }
function hash2(a, b) {
  const h = (a * 374761393 + b * 668265263) % 1000;
  return ((h % 1000) + 1000) % 1000 / 1000;
}
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function makeTex(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glowTex(inner, outer) {
  return makeTex(128, 128, (g) => {
    const v = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    v.addColorStop(0, inner); v.addColorStop(1, outer);
    g.fillStyle = v; g.fillRect(0, 0, 128, 128);
  });
}

function groundTexture() {
  const S = 2048 / CITY.width;
  return makeTex(2048, 1536, (g) => {
    g.fillStyle = PALETTE.grass; g.fillRect(0, 0, 2048, 1536);
    g.fillStyle = PALETTE.park;
    for (let i = 0; i < 40; i += 1) {
      g.fillRect(hash2(i, 3) * 1900 + 40, hash2(i, 7) * 1300 + 40, 120, 90);
    }
    g.fillStyle = PALETTE.sand; g.fillRect(0, CITY.beachY * S, 2048, 60 * S);
    g.fillStyle = PALETTE.water; g.fillRect(0, (CITY.beachY + 60) * S, 2048, 1536 - (CITY.beachY + 60) * S);
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2;
    for (let x = 0; x < 2048; x += 90) {
      g.beginPath(); g.moveTo(x, (CITY.beachY + 90) * S); g.lineTo(x + 40, (CITY.beachY + 90) * S); g.stroke();
    }
    for (const cx of roadCentresX) {
      g.fillStyle = PALETTE.sidewalk; g.fillRect(cx * S - (CITY.road / 2 + 8) * S, 0, (CITY.road + 16) * S, 1536);
      g.fillStyle = PALETTE.asphalt; g.fillRect(cx * S - (CITY.road / 2) * S, 0, CITY.road * S, 1536);
    }
    for (const cy of roadCentresY) {
      g.fillStyle = PALETTE.sidewalk; g.fillRect(0, cy * S - (CITY.road / 2 + 8) * S, 2048, (CITY.road + 16) * S);
      g.fillStyle = PALETTE.asphalt; g.fillRect(0, cy * S - (CITY.road / 2) * S, 2048, CITY.road * S);
    }
    g.fillStyle = PALETTE.roadLine;
    for (const cx of roadCentresX) for (let y = 0; y < 1536; y += 44) g.fillRect(cx * S - 2, y, 4, 22);
    for (const cy of roadCentresY) for (let x = 0; x < 2048; x += 44) g.fillRect(x, cy * S - 2, 22, 4);
    g.fillStyle = 'rgba(232,236,242,0.85)';
    for (const cx of roadCentresX) for (const cy of roadCentresY) {
      for (let k = -3; k <= 3; k += 1) {
        g.fillRect(cx * S - 26 + k * 8, cy * S - 34, 4, 68);
        g.fillRect(cx * S - 34, cy * S - 26 + k * 8, 68, 4);
      }
    }
  });
}

function facadeTexture() {
  return makeTex(128, 256, (g) => {
    g.fillStyle = '#d9d4c8'; g.fillRect(0, 0, 128, 256);
    for (let r = 0; r < 12; r += 1) for (let c = 0; c < 5; c += 1) {
      g.fillStyle = hash2(r, c) < 0.35 ? '#ffd23f' : '#20242e';
      g.fillRect(10 + c * 23, 12 + r * 20, 14, 12);
    }
  });
}

function signTexture(word, color) {
  return makeTex(256, 64, (g) => {
    g.clearRect(0, 0, 256, 64);
    g.font = '700 44px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 18;
    g.fillStyle = color; g.fillText(word, 128, 34);
    g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.fillText(word, 128, 34);
  });
}

export function createRenderer(canvas, hudCanvas) {
  THREE = (typeof window !== 'undefined' && window.THREE) || globalThis.THREE || null;
  if (!THREE) throw new Error('Three.js is required: load game/vendor/three.min.js before the module script.');
  hudCanvas = hudCanvas || canvas;
  const hudCtx = hudCanvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
  } catch (e) {
    renderer = {
      setPixelRatio() {}, setSize() {}, render() {}, dispose() {},
      shadowMap: {}, toneMapping: 0, toneMappingExposure: 1,
    };
  }
  const headless = !renderer.getContext;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x3a2a4a, 500, 1600);
  const camera = new THREE.PerspectiveCamera(66, VIEW.width / VIEW.height, 1, 3200);

  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x2a2a3a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb347, 1.7);
  sun.position.set(-900, 420, 700);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 50; sun.shadow.camera.far = 2600;
  sun.shadow.bias = -0.0004;
  scene.add(sun); scene.add(sun.target);

  const skyTex = makeTex(16, 512, (g) => {
    const v = g.createLinearGradient(0, 0, 0, 512);
    v.addColorStop(0, '#2a1e4a'); v.addColorStop(0.45, '#7a3a6e');
    v.addColorStop(0.72, '#ff7a4a'); v.addColorStop(1, '#ffb347');
    g.fillStyle = v; g.fillRect(0, 0, 16, 512);
  });
  scene.background = skyTex;
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex('rgba(255,220,150,1)', 'rgba(255,120,40,0)'), transparent: true, depthWrite: false,
  }));
  sunSprite.position.set(-1400, 260, 1200); sunSprite.scale.set(700, 700, 1);
  scene.add(sunSprite);
  const cloudTex = glowTex('rgba(255,200,220,0.55)', 'rgba(255,200,220,0)');
  const clouds = [];
  for (let i = 0; i < 8; i += 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.7 }));
    s.position.set(hash2(i, 1) * 3000 - 400, 260 + hash2(i, 2) * 120, hash2(i, 3) * 2400 - 200);
    s.scale.set(500 + hash2(i, 4) * 400, 90 + hash2(i, 5) * 60, 1);
    scene.add(s); clouds.push(s);
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.width, CITY.height),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -P2;
  ground.position.set(CITY.width / 2, 0, CITY.height / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.width + 600, 700),
    new THREE.MeshLambertMaterial({ color: 0x1d4e6e }),
  );
  sea.rotation.x = -P2;
  sea.position.set(CITY.width / 2, 0.4, CITY.height + 330);
  scene.add(sea);

  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const tmpC = new THREE.Color();
  const tmpM2 = new THREE.Matrix4();
  const tmpQ2 = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _q = new THREE.Quaternion();
  const _v = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  let cityBuilt = null;
  let bldgMesh = null, roofMesh = null;
  const signMeshes = [];
  const facadeTex = facadeTexture();
  const bldgMat = new THREE.MeshLambertMaterial({ map: facadeTex });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  function buildCity(city) {
    if (cityBuilt === city) return;
    if (bldgMesh) { scene.remove(bldgMesh); scene.remove(roofMesh); bldgMesh.dispose(); roofMesh.dispose(); }
    for (const s of signMeshes) scene.remove(s);
    signMeshes.length = 0;
    cityBuilt = city;
    const bs = city.buildings;
    bldgMesh = new THREE.InstancedMesh(boxGeo, bldgMat, Math.max(1, bs.length));
    roofMesh = new THREE.InstancedMesh(boxGeo, roofMat, Math.max(1, bs.length));
    bldgMesh.castShadow = true; bldgMesh.receiveShadow = true;
    roofMesh.castShadow = true;
    bs.forEach((b, i) => {
      tmpQ.identity();
      tmpM.compose(tmpV.set(b.x + b.w / 2, b.height / 2, b.y + b.h / 2), tmpQ, tmpS.set(b.w, b.height, b.h));
      bldgMesh.setMatrixAt(i, tmpM);
      bldgMesh.setColorAt(i, tmpC.set(b.color));
      tmpM.compose(tmpV.set(b.x + b.w / 2, b.height + 1.5, b.y + b.h / 2), tmpQ, tmpS.set(b.w + 4, 3, b.h + 4));
      roofMesh.setMatrixAt(i, tmpM);
      roofMesh.setColorAt(i, tmpC.set(b.roof));
      if (b.sign) {
        const sm = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.min(150, b.w * 0.8), 34),
          new THREE.MeshBasicMaterial({ map: signTexture(b.sign, b.sign === 'HOTEL' ? '#ff2e88' : '#22d3ee'), transparent: true }),
        );
        sm.position.set(b.x + b.w / 2, b.height * 0.72, b.y + b.h + 2);
        scene.add(sm); signMeshes.push(sm);
      }
    });
    bldgMesh.instanceMatrix.needsUpdate = true;
    roofMesh.instanceMatrix.needsUpdate = true;
    if (bldgMesh.instanceColor) bldgMesh.instanceColor.needsUpdate = true;
    if (roofMesh.instanceColor) roofMesh.instanceColor.needsUpdate = true;
    scene.add(bldgMesh); scene.add(roofMesh);
  }

  let vegBuilt = null;
  function buildVeg(city) {
    if (vegBuilt === city) return;
    vegBuilt = city;
    const trunks = [], fronds = [], canopies = [];
    for (const p of city.palms) { trunks.push({ x: p.x, y: p.y, h: 46, lean: p.lean }); fronds.push({ x: p.x, y: p.y, h: 46 }); }
    for (const park of city.parks) for (const t of park.trees) {
      trunks.push({ x: t.x, y: t.y, h: 26, lean: 0 });
      canopies.push({ x: t.x, y: t.y, h: 26, r: t.r });
    }
    const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.5, 4, 1, 6), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }), Math.max(1, trunks.length));
    const frondMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(20, 26, 6), new THREE.MeshLambertMaterial({ color: 0x2e8b57 }), Math.max(1, fronds.length));
    const canopyMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x3a7a4a }), Math.max(1, canopies.length));
    trunkMesh.castShadow = true;
    trunks.forEach((t, i) => {
      tmpQ.setFromAxisAngle(tmpV.set(0, 0, 1), t.lean * 0.12);
      tmpM.compose(new THREE.Vector3(t.x, t.h / 2, t.y), tmpQ, new THREE.Vector3(1, t.h, 1));
      trunkMesh.setMatrixAt(i, tmpM);
    });
    fronds.forEach((t, i) => {
      tmpQ.identity();
      tmpM.compose(new THREE.Vector3(t.x, t.h + 10, t.y), tmpQ, new THREE.Vector3(1, 1, 1));
      frondMesh.setMatrixAt(i, tmpM);
    });
    canopies.forEach((t, i) => {
      tmpQ.identity();
      tmpM.compose(new THREE.Vector3(t.x, t.h + 8, t.y), tmpQ, new THREE.Vector3(t.r, t.r * 0.9, t.r));
      canopyMesh.setMatrixAt(i, tmpM);
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    frondMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    scene.add(trunkMesh); scene.add(frondMesh); scene.add(canopyMesh);
  }

  let lampBuilt = null;
  function buildLamps(city) {
    if (lampBuilt === city) return;
    lampBuilt = city;
    const n = city.lamps.length;
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.2, 1.6, 26, 5), new THREE.MeshLambertMaterial({ color: 0x2a2f3a }), n);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(3, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), n);
    city.lamps.forEach((l, i) => {
      tmpQ.identity();
      tmpM.compose(new THREE.Vector3(l.x, 13, l.y), tmpQ, new THREE.Vector3(1, 1, 1));
      pole.setMatrixAt(i, tmpM);
      tmpM.compose(new THREE.Vector3(l.x, 26, l.y), tmpQ, new THREE.Vector3(1, 1, 1));
      head.setMatrixAt(i, tmpM);
    });
    pole.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    scene.add(pole); scene.add(head);
  }

  const MAXCARS = 32;
  const carBody = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXCARS);
  const carCabin = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x1a2028 }), MAXCARS);
  const wheelGeo = new THREE.CylinderGeometry(7, 7, 5, 10);
  wheelGeo.rotateZ(P2);
  const carWheel = new THREE.InstancedMesh(wheelGeo, new THREE.MeshLambertMaterial({ color: 0x14161a }), MAXCARS * 4);
  const carHead = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xfff2cc }), MAXCARS * 2);
  const carTail = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a }), MAXCARS * 2);
  const carBar = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), 8);
  const carStripe = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x1a2a4a }), 8);
  carBody.castShadow = true; carCabin.castShadow = true;
  scene.add(carBody); scene.add(carCabin); scene.add(carWheel);
  scene.add(carHead); scene.add(carTail); scene.add(carBar); scene.add(carStripe);
  const carDark = new THREE.Color();
  const FLEET_SHAPE = {
    pumper: [30, 18, 84, 26, 12, 30], ladder: [30, 18, 108, 26, 12, 30],
    rescue: [30, 18, 84, 26, 12, 30], arff: [34, 20, 92, 28, 12, 32],
    ambulance: [28, 20, 62, 24, 12, 30],
    'moto-sport': [12, 10, 40, 8, 6, 18], 'moto-cruiser': [12, 10, 44, 8, 6, 18], 'moto-enduro': [12, 11, 42, 8, 6, 18],
  };
  function syncCars(state, dt, time) {
    const cars = state.cars;
    const n = Math.min(cars.length, MAXCARS);
    let wi = 0, hi = 0, bi = 0, si = 0;
    for (let i = 0; i < n; i += 1) {
      const c = cars[i];
      const fwd = { x: Math.cos(c.angle), y: Math.sin(c.angle) };
      const rgt = { x: -fwd.y, y: fwd.x };
      const turn = ((c.angle - (c._pa ?? c.angle) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      c._pa = c.angle;
      const roll = clamp(-turn * 2.2, -0.09, 0.09);
      c._spin = (c._spin || 0) + (c.speed * dt) / 7;
      const shape = FLEET_SHAPE[c.fleet] || [26, 12, 54, 22, 10, 28];
      const isMoto = !!c.fleet && c.fleet.startsWith('moto');
      tmpQ.setFromEuler(new THREE.Euler(0, rotY(c.angle), roll, 'YXZ'));
      tmpM.compose(tmpV.set(c.x, isMoto ? 5 : 8, c.y), tmpQ, tmpS.set(shape[0], shape[1], shape[2]));
      carBody.setMatrixAt(i, tmpM);
      carDark.set(c.color);
      if (c.wrecked) carDark.multiplyScalar(0.35);
      carBody.setColorAt(i, carDark);
      tmpM.compose(tmpV.set(c.x - fwd.x * 4, isMoto ? 11 : 18, c.y - fwd.y * 4), tmpQ, tmpS.set(shape[3], shape[4], shape[5]));
      carCabin.setMatrixAt(i, tmpM);
      tmpQ2.setFromEuler(_e.set(0, rotY(c.angle), roll, 'YXZ'));
      const wheelSpots = isMoto ? [[18, 0], [-18, 0]] : [[18, 11], [18, -11], [-18, 11], [-18, -11]];
      for (const [f, s] of wheelSpots) {
        const wx = c.x + fwd.x * f + rgt.x * s;
        const wy = c.y + fwd.y * f + rgt.y * s;
        _q.setFromEuler(_e.set(c._spin, 0, 0));
        tmpQ.copy(tmpQ2).multiply(_q);
        tmpM.compose(tmpV.set(wx, isMoto ? 5 : 7, wy), tmpQ, tmpS.set(1, 1, 1));
        carWheel.setMatrixAt(wi, tmpM);
        wi += 1;
      }
      if (!isMoto) {
        for (const s of [8, -8]) {
          tmpQ.setFromEuler(new THREE.Euler(0, rotY(c.angle), 0, 'YXZ'));
          tmpM.compose(tmpV.set(c.x + fwd.x * 27 + rgt.x * s, 9, c.y + fwd.y * 27 + rgt.y * s), tmpQ, tmpS.set(6, 3, 2));
          carHead.setMatrixAt(hi, tmpM);
          tmpM.compose(tmpV.set(c.x - fwd.x * 27 + rgt.x * s, 9, c.y - fwd.y * 27 + rgt.y * s), tmpQ, tmpS.set(6, 3, 2));
          carTail.setMatrixAt(hi, tmpM);
          hi += 1;
        }
      }
      if (c.kind === 'police' && bi < 8) {
        tmpM.compose(tmpV.set(c.x, 26, c.y), tmpQ, tmpS.set(16, 4, 8));
        carBar.setMatrixAt(bi, tmpM);
        carBar.setColorAt(bi, tmpC.set(((Math.floor(time * 3) + c.id) % 2) ? 0xff2a2a : 0x2a5aff));
        tmpM.compose(tmpV.set(c.x, 10, c.y), tmpQ, tmpS.set(27, 3, 55));
        carStripe.setMatrixAt(si, tmpM);
        si += 1; bi += 1;
      }
    }
    carBody.count = n; carCabin.count = n; carWheel.count = wi;
    carHead.count = hi; carTail.count = hi; carBar.count = bi; carStripe.count = si;
    carBody.instanceMatrix.needsUpdate = true;
    carCabin.instanceMatrix.needsUpdate = true;
    carWheel.instanceMatrix.needsUpdate = true;
    carHead.instanceMatrix.needsUpdate = true;
    carTail.instanceMatrix.needsUpdate = true;
    carBar.instanceMatrix.needsUpdate = true;
    carStripe.instanceMatrix.needsUpdate = true;
    if (carBody.instanceColor) carBody.instanceColor.needsUpdate = true;
    if (carBar.instanceColor) carBar.instanceColor.needsUpdate = true;
  }

  const MAXPEDS = 32;
  const chHead = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXPEDS);
  const chHair = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXPEDS);
  const chTorso = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXPEDS);
  const chArmL = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXPEDS);
  const chArmR = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXPEDS);
  const chLegL = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXPEDS);
  const chLegR = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXPEDS);
  const chGun = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x1a1a1a }), 1);
  chHead.castShadow = true; chTorso.castShadow = true;
  scene.add(chHead); scene.add(chHair); scene.add(chTorso);
  scene.add(chArmL); scene.add(chArmR); scene.add(chLegL); scene.add(chLegR); scene.add(chGun);
  const skinC = new THREE.Color(0xc98a5a);
  const skin2 = new THREE.Color(0x8a5a3a);
  const skin3 = new THREE.Color(0xe8b88a);
  function part(mesh, idx, x, y, z, yaw, lie, ox, oy, oz, rx, sx, sy, sz, color) {
    _q.setFromEuler(_e.set(lie ? -P2 : 0, yaw, 0, 'YXZ'));
    _v.set(x, y, z);
    tmpM.compose(_v, _q, _s.set(1, 1, 1));
    tmpM2.compose(new THREE.Vector3(ox, oy, oz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(sx, sy, sz));
    tmpM.multiply(tmpM2);
    mesh.setMatrixAt(idx, tmpM);
    if (color) mesh.setColorAt(idx, color);
  }
  function syncChars(state, dt, time) {
    const list = [];
    const p = state.player;
    if (p.onFoot) list.push({ x: p.x, y: p.y, angle: p.angle, kind: 'player', down: false, moving: p.moving, run: p.run, aiming: p.aiming });
    for (const ped of state.peds) list.push(ped);
    const n = Math.min(list.length, MAXPEDS);
    let gunOn = false;
    for (let i = 0; i < n; i += 1) {
      const ch = list[i];
      const isPlayer = ch.kind === 'player';
      const down = !!ch.down;
      const speed = ch.mode === 'flee' ? 14 : (isPlayer ? (ch.run ? 12 : 8) : 7);
      ch._ph = (ch._ph || 0) + (ch.moving === false ? 0 : dt * speed);
      const sw = Math.sin(ch._ph) * 0.5;
      const yaw = rotY(ch.angle);
      const rootY = down ? 7 : 0;
      const shirt = isPlayer ? tmpC.set(PALETTE.player) : tmpC.set(ch.color);
      const pants = isPlayer ? tmpC.set(PALETTE.playerPants) : tmpC.set(shade(ch.color, 0.45));
      const skin = isPlayer ? skin3 : (hash2(i, 9) < 0.4 ? skin2 : skinC);
      const hairC = ch.kind === 'police' ? tmpC.set(0x1a2a4a) : ch.kind === 'fire' ? tmpC.set(0xffd23f) : tmpC.set(0x2a1a12);
      part(chHead, i, ch.x, rootY, ch.y, yaw, down, 0, 52, 0, 0, 12, 12, 12, skin);
      part(chHair, i, ch.x, rootY, ch.y, yaw, down, 0, 58, -1, 0, 13, 5, 13, hairC);
      part(chTorso, i, ch.x, rootY, ch.y, yaw, down, 0, 34, 0, 0, 18, 22, 10, shirt);
      part(chArmL, i, ch.x, rootY, ch.y, yaw, down, -12, 42, 0, -sw, 6, 20, 6, shirt);
      part(chArmR, i, ch.x, rootY, ch.y, yaw, down, 12, 42, 0, isPlayer && ch.aiming ? -1.25 : sw, 6, 20, 6, shirt);
      part(chLegL, i, ch.x, rootY, ch.y, yaw, down, -5, 22, 0, sw, 7, 22, 7, pants);
      part(chLegR, i, ch.x, rootY, ch.y, yaw, down, 5, 22, 0, -sw, 7, 22, 7, pants);
      if (isPlayer && HL.Weapons.drawn(state)) {
        const fx = Math.cos(ch.angle), fy = Math.sin(ch.angle);
        const rx = -fy, ry = fx;
        tmpQ.setFromEuler(_e.set(0, yaw, 0, 'YXZ'));
        tmpM.compose(_v.set(ch.x + fx * 20 + rx * 12, 36, ch.y + fy * 20 + ry * 12), tmpQ, _s.set(3, 3, 14));
        chGun.setMatrixAt(0, tmpM);
        gunOn = true;
      }
    }
    chHead.count = n; chHair.count = n; chTorso.count = n;
    chArmL.count = n; chArmR.count = n; chLegL.count = n; chLegR.count = n;
    chGun.count = gunOn ? 1 : 0;
    for (const m of [chHead, chHair, chTorso, chArmL, chArmR, chLegL, chLegR, chGun]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  const heli = new THREE.Group();
  const heliBody = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xe8ecf2 }));
  heliBody.scale.set(22, 16, 46); heli.add(heliBody);
  const heliTail = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xe8ecf2 }));
  heliTail.scale.set(6, 6, 44); heliTail.position.set(0, 2, -42); heli.add(heliTail);
  const heliStripe = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x1a2a4a }));
  heliStripe.scale.set(23, 4, 30); heliStripe.position.set(0, 2, 4); heli.add(heliStripe);
  const rotor = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(110, 1.5, 7);
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const b1 = new THREE.Mesh(bladeGeo, bladeMat);
  const b2 = new THREE.Mesh(bladeGeo, bladeMat); b2.rotation.y = P2;
  rotor.add(b1); rotor.add(b2); rotor.position.y = 12; heli.add(rotor);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const sk1 = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 40), skidMat); sk1.position.set(-9, -11, 0); heli.add(sk1);
  const sk2 = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 40), skidMat); sk2.position.set(9, -11, 0); heli.add(sk2);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2aa, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(46, 170, 12, 1, true), coneMat);
  cone.visible = false;
  scene.add(cone);
  heli.visible = false;
  scene.add(heli);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(60, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2aa, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pool.rotation.x = -P2; pool.position.y = 1; pool.visible = false;
  scene.add(pool);
  const heliPos = new THREE.Vector3(0, 170, 0);
  const _up = new THREE.Vector3(0, 1, 0);
  const _dir = new THREE.Vector3();
  function syncHeli(state, dt, time) {
    const on = state.wanted >= 3 && !state.wasted && !state.busted;
    heli.visible = on; pool.visible = on; cone.visible = on;
    if (!on) return;
    const p = state.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    const fx = Math.cos(state.camera.angle), fy = Math.sin(state.camera.angle);
    const shot = !!state._hlShot;
    const tx = px + fx * 150 - fy * (shot ? 40 : 50);
    const ty = py + fy * 150 + fx * (shot ? 40 : 50);
    const hh = shot ? 85 : CAM3D.heliHeight;
    if (shot) { heliPos.x = tx; heliPos.y = hh; heliPos.z = ty; }
    else {
      heliPos.x = lerp(heliPos.x, tx, Math.min(1, dt * 1.2));
      heliPos.y = lerp(heliPos.y, hh, Math.min(1, dt * 1.2));
      heliPos.z = lerp(heliPos.z, ty, Math.min(1, dt * 1.2));
    }
    heli.position.copy(heliPos);
    heli.rotation.y = rotY(Math.atan2(py - heliPos.z, px - heliPos.x));
    rotor.rotation.y += dt * 22;
    _dir.set(heliPos.x - px, hh, heliPos.z - py).normalize();
    cone.position.set((heliPos.x + px) / 2, hh / 2, (heliPos.z + py) / 2);
    cone.quaternion.setFromUnitVectors(_up, _dir);
    pool.position.set(px, 1, py);
    pool.material.opacity = 0.12 + 0.08 * Math.sin(time * 4);
  }

  const RAIN_N = 500;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_N * 3);
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    map: makeTex(8, 32, (g) => { g.fillStyle = 'rgba(180,200,230,0.8)'; g.fillRect(3, 0, 2, 32); }),
    size: 14, transparent: true, opacity: 0.45, depthWrite: false, sizeAttenuation: true,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.visible = false; rain.frustumCulled = false;
  scene.add(rain);
  const rainSeed = [];
  for (let i = 0; i < RAIN_N; i += 1) rainSeed.push({ x: hash2(i, 1), y: hash2(i, 2), z: hash2(i, 3), v: 380 + hash2(i, 4) * 220 });
  function syncRain(state, dt, camX, camY) {
    const r = state._hlRain || 0;
    rain.visible = r > 0.05;
    if (!rain.visible) return;
    for (let i = 0; i < RAIN_N; i += 1) {
      const s = rainSeed[i];
      s.y -= (s.v * dt) / 300;
      s.x -= (s.v * dt) / 1200;
      if (s.y < 0) { s.y = 1; s.x = hash2(i, Math.floor(state.time * 2) % 97); s.z = hash2(i, 5); }
      rainPos[i * 3] = camX + (s.x - 0.5) * 500;
      rainPos[i * 3 + 1] = s.y * 300;
      rainPos[i * 3 + 2] = camY + (s.z - 0.5) * 500;
    }
    rainGeo.attributes.position.needsUpdate = true;
    rainMat.opacity = 0.45 * r;
  }

  const P_MAX = 400;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P_MAX * 3);
  const pCol = new Float32Array(P_MAX * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({
    map: glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), size: 9,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);
  const bGeo = new THREE.BufferGeometry();
  const bPos = new Float32Array(32 * 3);
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const bMat = new THREE.PointsMaterial({ color: 0xfff2aa, size: 7, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const bPoints = new THREE.Points(bGeo, bMat);
  bPoints.frustumCulled = false;
  scene.add(bPoints);
  const smokeTex = glowTex('rgba(120,120,130,0.7)', 'rgba(120,120,130,0)');
  const smokes = [];
  for (let i = 0; i < 4; i += 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false; scene.add(s); smokes.push(s);
  }
  function syncFx(state, dt, time) {
    const parts = state.particles;
    const n = Math.min(parts.length, P_MAX);
    for (let i = 0; i < n; i += 1) {
      const pt = parts[i];
      pPos[i * 3] = pt.x; pPos[i * 3 + 1] = pt.z || 2; pPos[i * 3 + 2] = pt.y;
      const fade = clamp(pt.life / pt.maxLife, 0, 1);
      tmpC.set(pt.color);
      pCol[i * 3] = tmpC.r * fade; pCol[i * 3 + 1] = tmpC.g * fade; pCol[i * 3 + 2] = tmpC.b * fade;
    }
    pGeo.setDrawRange(0, n);
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
    const nb = Math.min(state.bullets.length, 32);
    for (let i = 0; i < nb; i += 1) {
      const b = state.bullets[i];
      bPos[i * 3] = b.x; bPos[i * 3 + 1] = b.z || 30; bPos[i * 3 + 2] = b.y;
    }
    bGeo.setDrawRange(0, nb);
    bGeo.attributes.position.needsUpdate = true;
    let si = 0;
    for (const c of state.cars) {
      if (!c.wrecked || si >= 4) continue;
      const s = smokes[si];
      s.visible = true;
      s.position.set(c.x, 22 + ((c.smokeTimer || 0) % 6) * 4, c.y);
      const sc = 40 + ((c.smokeTimer || 0) % 6) * 14;
      s.scale.set(sc, sc, 1);
      s.material.opacity = 0.5;
      si += 1;
    }
    for (; si < 4; si += 1) smokes[si].visible = false;
  }

  const fleet = createFleet(THREE, scene);

  let lastTime = 0;
  let qualityLevel = 0;
  const _eye = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const _rgt = new THREE.Vector3();
  const _tgt = new THREE.Vector3();
  function updateCamera3D(state, dt, time) {
    const cam = state.camera;
    const p = state.player;
    const tx = p.car ? p.car.x : p.x;
    const ty = p.car ? p.car.y : p.y;
    const driving = !!p.car;
    const aiming = p.aiming && !driving;
    const eyeH = driving ? CAM3D.eyeDrive : (aiming ? CAM3D.eyeAim : CAM3D.eyeFoot);
    const lookH = driving ? CAM3D.lookDrive : (aiming ? CAM3D.lookAim : CAM3D.lookFoot);
    const th = cam.angle ?? -P2;
    _rgt.set(-Math.sin(th), 0, Math.cos(th));
    const sh = (cam.shoulder || 0) * -0.6;
    const shx = (Math.random() - 0.5) * (cam.shake || 0) * 0.6;
    const shy = (Math.random() - 0.5) * (cam.shake || 0) * 0.4;
    _eye.set(cam.x + _rgt.x * sh + shx, eyeH + shy, cam.y + _rgt.z * sh);
    _look.set(tx + _rgt.x * sh, lookH, ty + _rgt.z * sh);
    camera.position.copy(_eye);
    camera.lookAt(_look);
    const fovDeg = (cam.fov ?? 1.15) * 180 / Math.PI;
    if (Math.abs(camera.fov - fovDeg) > 0.05) { camera.fov = fovDeg; camera.updateProjectionMatrix(); }
    const night = clamp((HL.Sky.time - 18.5) / 3, 0, 1);
    sun.intensity = lerp(1.7, 0.45, night);
    hemi.intensity = lerp(0.95, 0.4, night);
    sun.color.setHSL(0.08, 0.9, lerp(0.62, 0.4, night));
    scene.fog.color.setHex(night > 0.5 ? 0x1a1430 : 0x3a2a4a);
    sunSprite.material.opacity = lerp(1, 0.25, night);
    _tgt.set(tx, 0, ty);
    sun.position.set(tx - 900, 420, ty + 700);
    sun.target.position.copy(_tgt);
    for (const c of clouds) { c.position.x += dt * 3; if (c.position.x > 3400) c.position.x = -400; }
  }

  function drawPanel(title, lines, prompt) {
    const ctx = hudCtx;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.fillStyle = 'rgba(8,10,18,0.82)';
    const w = 640;
    const h = 150 + lines.length * 32;
    ctx.fillRect(VIEW.width / 2 - w / 2, 150, w, h);
    ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 2;
    ctx.strokeRect(VIEW.width / 2 - w / 2, 150, w, h);
    ctx.fillStyle = PALETTE.text; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `700 44px ${FONT}`;
    ctx.fillText(title, VIEW.width / 2, 150 + 62);
    ctx.font = `20px ${FONT}`;
    lines.forEach((ln, i) => { ctx.fillStyle = i === 0 ? PALETTE.neonYellow : PALETTE.text; ctx.fillText(ln, VIEW.width / 2, 150 + 104 + i * 32); });
    ctx.font = `700 18px ${FONT}`; ctx.fillStyle = PALETTE.neonCyan;
    ctx.fillText(prompt, VIEW.width / 2, 150 + h - 18);
    ctx.textAlign = 'left';
  }

  function resize() {
    const w = Math.min(window.innerWidth || VIEW.width, 1920);
    const h = Math.min(window.innerHeight || VIEW.height, 1080);
    const pr = Math.min(window.devicePixelRatio || 1, qualityLevel === 0 ? 2 : qualityLevel === 1 ? 1.25 : 1);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    hudCanvas.width = w; hudCanvas.height = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    view.scale = Math.min(w / VIEW.width, h / VIEW.height);
    view.x = (w - VIEW.width * view.scale) / 2;
    view.y = (h - VIEW.height * view.scale) / 2;
  }

  function draw(state, screen, best, time) {
    const dt = clamp(time - lastTime, 0, 0.1) || 0.016;
    lastTime = time;
    buildCity(state.city); buildVeg(state.city); buildLamps(state.city);
    updateCamera3D(state, dt, time);
    syncCars(state, dt, time);
    syncChars(state, dt, time);
    syncHeli(state, dt, time);
    syncRain(state, dt, state.camera.x, state.camera.y);
    syncFx(state, dt, time);
    fleet.update(dt, time, state);
    renderer.render(scene, camera);
    hudCtx.setTransform(1, 0, 0, 1, 0, 0);
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    if (state._hlTint) { hudCtx.fillStyle = state._hlTint; hudCtx.fillRect(0, 0, hudCanvas.width, hudCanvas.height); }
    hudCtx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
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
    const speedKmh = state.player.car ? carSpeedKmh(state.player.car) : null;
    if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      hudCtx.fillStyle = 'rgba(8,10,18,0.55)';
      hudCtx.fillRect(0, 0, VIEW.width, VIEW.height);
    } else {
      drawHud(hudCtx, state, speedKmh);
      drawShop(hudCtx, state);
      if (screen === SCREEN_PLAY) drawCrosshair(hudCtx, state);
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', '', 'Progress saves when a job ends.'], 'Press P to resume • S to save now');
    } else if (screen === SCREEN_OVER) {
      const fee = Math.min(state.money, 100);
      drawPanel('WASTED', ['You woke up at St. Marina Hospital.', fee > 0 ? `The doctors kept $${fee}.` : 'The doctors patched you up for free.', `Haul so far: $${state.money - fee}`], 'Press Space or click to play again');
    } else if (screen === SCREEN_BUSTED) {
      const fee = Math.min(state.money, 100);
      drawPanel('BUSTED', ['The Bayview police took you in.', fee > 0 ? `They kept $${fee} of your money.` : 'You had nothing worth taking.', `Haul so far: $${state.money - fee}`], 'Press Space or click to play again');
    }
  }

  function toWorld(clientX, clientY, cam) {
    const nx = (clientX / hudCanvas.width) * 2 - 1;
    const ny = -((clientY / hudCanvas.height) * 2 - 1);
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const t = -camera.position.y / dir.y;
    return { x: camera.position.x + dir.x * t, y: camera.position.z + dir.z * t };
  }
  function toScreen(wx, wy, cam) {
    const v = new THREE.Vector3(wx, 0, wy).project(camera);
    return { x: ((v.x + 1) / 2) * VIEW.width, y: ((1 - v.y) / 2) * VIEW.height };
  }

  function setQuality(level) {
    qualityLevel = level;
    renderer.shadowMap.enabled = level < 2;
    scene.fog.far = [1600, 1100, 700][level] || 1600;
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    sun.shadow.mapSize.set(level === 0 ? 1024 : 512, level === 0 ? 1024 : 512);
    resize();
  }
  function clearCaches() {
    cityBuilt = null; vegBuilt = null; lampBuilt = null;
    if (bldgMesh) { scene.remove(bldgMesh); scene.remove(roofMesh); bldgMesh = null; roofMesh = null; }
  }

  function stats(state) {
    const p = state.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    const fx = Math.cos(state.camera.angle ?? -P2);
    const fy = Math.sin(state.camera.angle ?? -P2);
    const ahead = (px - camera.position.x) * fx + (py - camera.position.z) * fy;
    return {
      headless, buildings: bldgMesh ? bldgMesh.count : 0, cars: carBody.count,
      peds: chHead.count, heli: heli.visible, playerAhead: Math.round(ahead),
      sceneChildren: scene.children.length,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toScreen, toWorld, setQuality, clearCaches, stats };
}
