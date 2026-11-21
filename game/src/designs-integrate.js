// NEON BAY — design integration shim (Round 9, fresh). Loaded LAST in index.html.
// Exposes the design pack to the game. Nothing is auto-placed in the scene:
// the game chooses where each design goes, through N.integrate / N.parade.
(function () {
  var N = window.NEON_DESIGNS;
  if (!N) return;
  // Spawn one design into a THREE.Scene at (x, y, z), yaw in radians.
  N.integrate = function (scene, id, x, y, z, yaw) {
    var g = N.spawn(id);
    if (!g || !scene || typeof scene.add !== 'function') return null;
    g.position.set(x || 0, y || 0, z || 0);
    if (yaw) g.rotation.z = yaw;
    scene.add(g);
    return g;
  };
  // Per-frame driver: the game loop calls this with elapsed seconds.
  // It spins rotors / props and advances figure poses.
  N.drive = function (t) { N.tick(t); };
})();

// Round 9, part 2: a composed "design parade" the game can place anywhere.
(function () {
  var N = window.NEON_DESIGNS;
  if (!N) return;
  // One city block + a vehicle row + a few pedestrians, at origin (x, y).
  N.parade = function (scene, x, y) {
    if (!scene || typeof scene.add !== 'function') return null;
    var g = N.cityBlock ? N.cityBlock(3) : null;
    var out = [];
    if (g) { g.position.set(x, y, 0); scene.add(g); out.push(g); }
    var cars = ['patrol-car', 'civil-sedan', 'pickup', 'suv', 'coupe'];
    for (var i = 0; i < cars.length; i++) {
      var v = N.integrate(scene, cars[i], x - 8 + i * 4, y - 9, 0, 0);
      if (v) out.push(v);
    }
    var folks = ['officer', 'mara', 'fish-vendor', 'hostile'];
    for (var j = 0; j < folks.length; j++) {
      var f = N.integrate(scene, folks[j], x - 6 + j * 4, y + 6, 0, j * .8);
      if (f) out.push(f);
    }
    var heli = N.integrate(scene, 'air-one', x + 10, y + 8, 0, .5);
    if (heli) out.push(heli);
    return out;
  };
  N.ready = true;
})();
