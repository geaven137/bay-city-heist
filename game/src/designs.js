// NEON BAY — design registry + shared low-poly helpers (Round 9, fresh).
// Z-up world: ground is the XY plane, height is Z. Camera up is (0,0,1).
// All 98 designs register here: vehicles (v), characters (c), npcs (n),
// buildings (b), weapons (w). Every entry: {name, kind, cls, size, build}.
(function () {
  var T = window.THREE;
  var N = window.NEON_DESIGNS = window.NEON_DESIGNS || {};
  N.v = N.v || {}; N.c = N.c || {}; N.n = N.n || {}; N.b = N.b || {}; N.w = N.w || {};
  N.anim = N.anim || []; N.points = N.points || [];
  var MC = {};
  function mat(c, e) {
    var k = c + ':' + (e || 0);
    if (!MC[k]) MC[k] = new T.MeshStandardMaterial({ color: c, roughness: .85, metalness: .06, flatShading: true, emissive: e || 0, emissiveIntensity: e ? .7 : 0 });
    return MC[k];
  }
  // Box: w along X, d along Y, h along Z. (x,y,z) = centre. rz = yaw.
  function box(w, d, h, c, x, y, z, rz) {
    var m = new T.Mesh(new T.BoxGeometry(w, d, h), mat(c));
    m.position.set(x || 0, y || 0, z || 0);
    if (rz) m.rotation.z = rz;
    return m;
  }
  // Cylinder: len along axis 'x' | 'y' | 'z' (default 'y').
  function cyl(rt, rb, len, c, x, y, z, ax, seg) {
    var m = new T.Mesh(new T.CylinderGeometry(rt, rb, len, seg || 10), mat(c));
    if (ax === 'z') m.rotation.x = Math.PI / 2; else if (ax === 'x') m.rotation.z = Math.PI / 2;
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function sph(r, c, x, y, z, sx, sy, sz) {
    var m = new T.Mesh(new T.SphereGeometry(r, 12, 9), mat(c));
    m.scale.set(sx || 1, sy || 1, sz || 1);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function grp() { return new T.Group(); }
  function put(g) { for (var i = 1; i < arguments.length; i++) g.add(arguments[i]); return g; }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  N.h = { mat: mat, box: box, cyl: cyl, sph: sph, grp: grp, put: put, rng: rng };
  N.reg = function (kind, id, e) { N[kind][id] = e; e.id = id; e.kind = kind; return e; };
  N.get = function (id) { return N.v[id] || N.c[id] || N.n[id] || N.b[id] || N.w[id] || null; };
  N.ids = function (kind) { return Object.keys(N[kind]); };
  N.allIds = function () { return N.ids('v').concat(N.ids('c'), N.ids('n'), N.ids('b'), N.ids('w')); };
  N.tick = function (t) { for (var i = 0; i < N.anim.length; i++) N.anim[i](t); };
  N.meta = { game: 'NEON BAY', city: 'St. Marina', count: 98 };
})();

// Round 9, part 2: lookup helpers used by the viewer and the game shim.
(function () {
  var N = window.NEON_DESIGNS;
  N.kindOf = function (id) {
    if (N.v[id]) return 'vehicle';
    if (N.c[id]) return 'character';
    if (N.n[id]) return 'npc';
    if (N.b[id]) return 'building';
    if (N.w[id]) return 'weapon';
    return null;
  };
  // Build one design by id. Returns a THREE.Group or null.
  N.spawn = function (id) {
    var e = N.get(id);
    if (!e || typeof e.build !== 'function') return null;
    var g = e.build(N.h);
    g.userData.designId = id;
    g.userData.designName = e.name;
    g.userData.designSize = e.size || 3;
    return g;
  };
  // One-line summary per design, for HUD / viewer captions.
  N.describe = function (id) {
    var e = N.get(id);
    if (!e) return id;
    return e.name + ' — ' + e.kind + (e.cls ? ' / ' + e.cls : '');
  };
})();
