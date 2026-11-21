// Kai Reyes — low-poly player character for NEON BAY.
// Plain classic script, uses the global THREE from the vendored UMD build.
// Z-UP WORLD: up is +Z, the ground is the XY plane, forward is +Y.
// The character stands ~1.75 units tall with his feet at z = 0.

function kaiMat(color, opts) {
  opts = opts || {};
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.65,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.15,
    flatShading: true,
  });
}

// Box part helper: position and rotation are [x, y, z] in the parent's frame.
function kaiPart(parent, geo, mat, pos, rot, name) {
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

// Build the character. Returns a rig of pivots the animation can pose:
// root, pelvisPivot, torsoPivot, headPivot, rightShoulder, leftShoulder,
// rightHip, leftHip, rifleGroup.
function createKaiCharacter(options) {
  options = options || {};
  var palette = {
    skin: options.skinColor !== undefined ? options.skinColor : 0xd99b72,
    vest: options.vestColor !== undefined ? options.vestColor : 0x2f3e2e,
    shirt: options.shirtColor !== undefined ? options.shirtColor : 0x3b4d61,
    pants: options.pantsColor !== undefined ? options.pantsColor : 0x262b33,
    boots: options.bootsColor !== undefined ? options.bootsColor : 0x18191c,
    helmet: options.helmetColor !== undefined ? options.helmetColor : 0x3a4a37,
    gun: options.gunColor !== undefined ? options.gunColor : 0x232830,
  };

  var root = new THREE.Group();
  root.name = options.name || 'kai_reyes';

  // Pelvis pivot at hip height — root of the lower body.
  var pelvisPivot = new THREE.Group();
  pelvisPivot.position.set(0, 0, 0.92);
  root.add(pelvisPivot);

  kaiPart(pelvisPivot,
    new THREE.BoxGeometry(0.42, 0.26, 0.20),
    kaiMat(palette.pants), [0, 0, 0], null, 'pelvis');

  // Torso pivot above the pelvis: chest + slightly larger tactical vest.
  var torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0, 0.10);
  pelvisPivot.add(torsoPivot);

  kaiPart(torsoPivot,
    new THREE.BoxGeometry(0.48, 0.28, 0.54),
    kaiMat(palette.shirt), [0, 0, 0.27], null, 'chest');
  kaiPart(torsoPivot,
    new THREE.BoxGeometry(0.51, 0.32, 0.36),
    kaiMat(palette.vest, { roughness: 0.78 }),
    [0, 0.01, 0.31], null, 'tactical_vest');

  // Head pivot on top of the torso: boxy head, faceted helmet, thin visor.
  var headPivot = new THREE.Group();
  headPivot.position.set(0, 0, 0.56);
  torsoPivot.add(headPivot);

  kaiPart(headPivot,
    new THREE.BoxGeometry(0.28, 0.28, 0.30),
    kaiMat(palette.skin, { roughness: 0.6 }),
    [0, 0, 0.16], null, 'head');
  kaiPart(headPivot,
    new THREE.IcosahedronGeometry(0.185, 0),
    kaiMat(palette.helmet, { roughness: 0.5, metalness: 0.2 }),
    [0, -0.01, 0.21], null, 'helmet');
  kaiPart(headPivot,
    new THREE.BoxGeometry(0.24, 0.05, 0.06),
    kaiMat(0x0f172a, { roughness: 0.15, metalness: 0.8 }),
    [0, 0.14, 0.18], null, 'visor');

  // One arm: upper arm, forearm, hand — hung from a shoulder pivot.
  function buildArm(side) {
    var sign = side === 'right' ? 1 : -1;
    var shoulder = new THREE.Group();
    shoulder.position.set(sign * 0.31, 0, 0.48);
    torsoPivot.add(shoulder);

    kaiPart(shoulder,
      new THREE.BoxGeometry(0.14, 0.14, 0.28),
      kaiMat(palette.shirt), [0, 0, -0.14]);
    kaiPart(shoulder,
      new THREE.BoxGeometry(0.125, 0.125, 0.26),
      kaiMat(palette.skin), [0, 0.02, -0.39], [0.12, 0, 0]);
    kaiPart(shoulder,
      new THREE.BoxGeometry(0.11, 0.12, 0.11),
      kaiMat(palette.skin), [0, 0.04, -0.52]);
    return shoulder;
  }

  var rightShoulder = buildArm('right');
  var leftShoulder = buildArm('left');

  // Long rifle in the right hand. Its long axis runs along local -Z (the
  // arm's direction), so when the arm rises forward the barrel points
  // forward too. Body + thinner barrel + short angled grip underneath.
  var rifleGroup = new THREE.Group();
  rifleGroup.position.set(0, 0.03, -0.50);
  rightShoulder.add(rifleGroup);

  var gunMat = kaiMat(palette.gun, { metalness: 0.65, roughness: 0.3 });
  kaiPart(rifleGroup,
    new THREE.BoxGeometry(0.06, 0.10, 0.58),
    gunMat, [0, 0, -0.05], null, 'rifle_body');
  kaiPart(rifleGroup,
    new THREE.BoxGeometry(0.03, 0.035, 0.24),
    gunMat, [0, 0, -0.42], null, 'rifle_barrel');
  kaiPart(rifleGroup,
    new THREE.BoxGeometry(0.045, 0.07, 0.16),
    gunMat, [0, 0, -0.18], [0.25, 0, 0], 'rifle_grip');

  // One leg: thigh, shin, boot (boot slightly longer toward the front, +Y).
  function buildLeg(side) {
    var sign = side === 'right' ? 1 : -1;
    var hip = new THREE.Group();
    hip.position.set(sign * 0.115, 0, -0.08);
    pelvisPivot.add(hip);

    kaiPart(hip,
      new THREE.BoxGeometry(0.165, 0.175, 0.42),
      kaiMat(palette.pants), [0, 0, -0.21]);
    kaiPart(hip,
      new THREE.BoxGeometry(0.15, 0.16, 0.36),
      kaiMat(palette.pants), [0, 0, -0.56]);
    kaiPart(hip,
      new THREE.BoxGeometry(0.16, 0.26, 0.12),
      kaiMat(palette.boots, { roughness: 0.75 }),
      [0, 0.04, -0.78]);
    return hip;
  }

  var rightHip = buildLeg('right');
  var leftHip = buildLeg('left');

  return {
    root: root,
    pelvisPivot: pelvisPivot,
    torsoPivot: torsoPivot,
    headPivot: headPivot,
    rightShoulder: rightShoulder,
    leftShoulder: leftShoulder,
    rightHip: rightHip,
    leftHip: leftHip,
    rifleGroup: rifleGroup,
  };
}

// Pose the rig procedurally. elapsed is seconds, speed is world units/sec,
// aiming holds the rifle up. In this Z-up world, swinging a limb forward
// is a rotation about the X axis, and turning the torso is a rotation
// about the Z axis (the up axis).
function updateKaiAnimation(rig, elapsed, speed, aiming) {
  if (!rig) return;
  speed = speed || 0;
  var drive = THREE.MathUtils.clamp(speed / 8, 0, 1.5);
  var cycle = elapsed * (4.5 + drive * 7.5);

  if (aiming) {
    // Rifle stance: right arm forward holding the rifle, left arm across
    // to support it, torso bladed slightly, feet in a short wide stance.
    rig.rightShoulder.rotation.set(1.35, 0.12, 0);
    rig.leftShoulder.rotation.set(1.10, -0.45, 0);
    rig.torsoPivot.rotation.z = 0.15;
    rig.headPivot.rotation.x = -0.12;
    rig.rightHip.rotation.set(0.10, -0.08, 0);
    rig.leftHip.rotation.set(-0.06, 0.08, 0);
    rig.pelvisPivot.position.z = 0.92;
    return;
  }

  // Walk / run: legs swing in opposition, pelvis bobs each step, arms
  // swing opposite their same-side leg, torso sways a little.
  var swing = Math.sin(cycle) * 0.65 * drive;
  rig.rightHip.rotation.set(swing, 0, 0);
  rig.leftHip.rotation.set(-swing, 0, 0);
  rig.pelvisPivot.position.z = 0.92 + Math.abs(Math.cos(cycle)) * 0.045 * drive;

  rig.rightShoulder.rotation.set(-0.25 - swing * 0.5, 0, 0);
  rig.leftShoulder.rotation.set(-0.25 + swing * 0.5, 0, 0);
  rig.torsoPivot.rotation.z = Math.sin(cycle) * 0.06 * drive;
  rig.headPivot.rotation.x = 0;

  // Idle breathing and a slow look-around, fading out as speed rises.
  var still = 1 - Math.min(drive, 1);
  rig.torsoPivot.position.z = 0.10 + Math.sin(elapsed * 1.6) * 0.006 * still;
  rig.headPivot.rotation.z = Math.sin(elapsed * 0.9) * 0.03 * still;
}
