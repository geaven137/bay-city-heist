// NEON BAY — 10 characters + 7 NPCs (Round 9, fresh). Z-up, height ~1.75.
// One jointed rig, head ~1:3.5, poses: idle / aim / run / flee / downed.
(function () {
  var N = window.NEON_DESIGNS, H = N.h;
  var SKIN = [0xeec39b, 0xd99e73, 0xb57a4e, 0x8a5a38];
  var HAIR = { black: 0x14100c, brown: 0x4a2e1a, purple: 0x5a3a6a, grey: 0x8a8a8a };
  function limb(w, d, len, c, zc) {
    var g = H.grp();
    H.put(g, H.box(w, d, len, c, 0, 0, zc));
    return g;
  }
  // spec: s=skin idx, h=hair key, t=top, b=bottom, v=vest(0 none), m=headgear
  // ('helm'|'cap'|'hood'|0), a=apron(0 none), r=rifle(0/1), sc=scale.
  function figure(sp) {
    var g = H.grp(), sc = sp.sc || 1, skin = SKIN[sp.s || 0];
    var hips = H.grp(); hips.position.z = .72;
    var legL = limb(.15, .14, .68, sp.b, -.34); legL.position.set(.11, 0, 0);
    var legR = limb(.15, .14, .68, sp.b, -.34); legR.position.set(-.11, 0, 0);
    H.put(legL, H.box(.16, .26, .09, 0x141518, 0, .04, -.68));
    H.put(legR, H.box(.16, .26, .09, 0x141518, 0, .04, -.68));
    var torso = H.grp(); torso.position.z = .72;
    H.put(torso, H.box(.44, .26, .58, sp.t, 0, 0, .29), H.box(.46, .28, .08, 0x1c1e22, 0, 0, .03));
    if (sp.v) H.put(torso, H.box(.47, .29, .4, sp.v, 0, 0, .34));
    if (sp.a) H.put(torso, H.box(.4, .03, .5, sp.a, 0, .15, .28));
    var armL = limb(.13, .12, .52, sp.t, -.26); armL.position.set(.28, 0, 1.24);
    var armR = limb(.13, .12, .52, sp.t, -.26); armR.position.set(-.28, 0, 1.24);
    H.put(armL, H.box(.12, .11, .1, skin, 0, 0, -.55));
    H.put(armR, H.box(.12, .11, .1, skin, 0, 0, -.55));
    var head = H.grp(); head.position.z = 1.3;
    H.put(head, H.cyl(.07, .08, .1, skin, 0, 0, .05, 'z'), H.box(.32, .28, .38, skin, 0, 0, .26));
    H.put(head, H.box(.06, .04, .04, 0x14100c, .07, .15, .3), H.box(.06, .04, .04, 0x14100c, -.07, .15, .3));
    if (sp.m === 'helm') {
      H.put(head, H.sph(.2, 0x5a6142, 0, 0, .42, 1, 1, .75), H.box(.3, .03, .12, 0x101418, 0, .15, .32));
    } else if (sp.m === 'cap') {
      H.put(head, H.box(.34, .3, .07, sp.t, 0, 0, .47), H.box(.3, .14, .03, sp.t, 0, .2, .44));
    } else if (sp.m === 'hood') {
      H.put(head, H.sph(.21, sp.t, 0, 0, .36, 1, 1, .8));
    } else {
      H.put(head, H.box(.34, .3, .09, HAIR[sp.h || 'black'], 0, -.01, .46));
    }
    var rifle = null;
    if (sp.r) {
      rifle = H.grp(); rifle.position.set(0, .08, -.55);
      H.put(rifle, H.box(.07, .7, .09, 0x2b2f33, 0, .1, 0), H.cyl(.025, .025, .3, 0x8a9199, 0, .55, 0, 'y'), H.box(.06, .16, .2, 0x17181a, 0, -.05, -.08), H.box(.06, .2, .07, 0x66401f, 0, -.28, 0));
      armR.add(rifle);
    }
    H.put(g, hips, torso, armL, armR, head);
    hips.add(legL); hips.add(legR);
    g.scale.setScalar(sc);
    g.userData.j = { hips: hips, torso: torso, legL: legL, legR: legR, armL: armL, armR: armR, head: head, rifle: rifle };
    g.userData.pose = 'idle';
    return g;
  }
  // Set a pose; t = time for walk/run cycles.
  function pose(fig, name, t) {
    var j = fig.userData.j;
    if (!j) return;
    var s = Math.sin(t || 0), c = Math.cos(t || 0);
    j.legL.rotation.x = 0; j.legR.rotation.x = 0; j.armL.rotation.x = 0; j.armR.rotation.x = 0;
    j.armL.rotation.z = 0; j.armR.rotation.z = 0; j.torso.rotation.x = 0; j.torso.rotation.z = 0;
    j.head.rotation.z = 0; fig.rotation.x = 0; fig.position.z = 0; j.hips.position.z = .72;
    if (name === 'run') {
      j.legL.rotation.x = .55 + s * .5; j.legR.rotation.x = -.55 + c * .5;
      j.armL.rotation.x = -.4 - s * .4; j.armR.rotation.x = .4 + c * .4;
      j.hips.position.z = .72 + Math.abs(c) * .07; j.torso.rotation.x = .22;
    } else if (name === 'aim') {
      j.armR.rotation.x = Math.PI / 2; j.armL.rotation.x = Math.PI / 2 * .7; j.armL.rotation.z = .5;
      j.torso.rotation.z = -.15; j.legL.rotation.z = .12; j.legR.rotation.z = -.12;
      if (j.rifle) j.rifle.rotation.x = -Math.PI / 2;
    } else if (name === 'flee') {
      j.armL.rotation.x = Math.PI * .85; j.armR.rotation.x = Math.PI * .85;
      j.legL.rotation.x = Math.sin((t || 0) * 1.3) * .7; j.legR.rotation.x = -Math.sin((t || 0) * 1.3) * .7;
      j.torso.rotation.x = .2;
    } else if (name === 'downed') {
      fig.rotation.x = Math.PI / 2; fig.position.z = .22;
      j.armL.rotation.z = 1.2; j.armR.rotation.z = -1.2;
    } else {
      j.armL.rotation.x = s * .05; j.armR.rotation.x = -s * .05;
      j.hips.position.z = .72 + s * .015; j.head.rotation.z = Math.sin((t || 0) * .5) * .15;
      if (j.rifle) j.rifle.rotation.x = -Math.PI / 2;
    }
    fig.userData.pose = name;
  }
  N._fig = { figure: figure, pose: pose, skin: SKIN, hair: HAIR };
})();
// Round 9, part 2: the cast table — 10 characters + 7 NPCs (NEON BAY names).
(function () {
  var N = window.NEON_DESIGNS, F = N._fig;
  var NAVY = 0x22344e, OLIVE = 0x5a6142, SLATE = 0x3a4a5a, VEST = 0x2e4a2e, CHAR = 0x23262b;
  var C = [
    ['kai', 'c', 'Kai Reyes', 'hero', { s: 0, h: 'black', t: SLATE, b: CHAR, v: VEST, m: 'helm', r: 1 }, 'aim'],
    ['mara', 'c', 'Mara Voss', 'mechanic', { s: 1, h: 'brown', t: 0xb0703a, b: 0x6a4a28, m: 'cap' }, 'idle'],
    ['ghost', 'c', 'Hacker "Ghost"', 'hacker', { s: 0, h: 'black', t: 0x2a2d34, b: 0x1c1e22, m: 'hood' }, 'idle'],
    ['tank', 'c', '"Tank"', 'muscle', { s: 2, h: 'black', t: 0x4a3a2a, b: 0x2a2d34, v: 0x3a2e22, sc: 1.18 }, 'idle'],
    ['officer', 'c', 'Bayview Officer', 'police', { s: 1, h: 'black', t: NAVY, b: NAVY, m: 'cap' }, 'idle'],
    ['pilot', 'c', 'Air One Pilot', 'pilot', { s: 0, h: 'brown', t: OLIVE, b: OLIVE, m: 'helm' }, 'idle'],
    ['soldier', 'c', 'Marina Soldier', 'soldier', { s: 3, h: 'black', t: 0x4a5238, b: 0x3a4030, m: 'helm' }, 'idle'],
    ['fish-vendor', 'c', 'Fish Vendor', 'vendor', { s: 2, h: 'grey', t: 0x7a8a9a, b: 0x3a3f46, a: 0x2a5a8a }, 'idle'],
    ['donut-vendor', 'c', 'Donut Vendor', 'vendor', { s: 0, h: 'brown', t: 0xc8b8a8, b: 0x5a4a3a, a: 0xd87a9a, m: 'cap' }, 'idle'],
    ['gelato-vendor', 'c', 'Gelato Vendor', 'vendor', { s: 1, h: 'purple', t: 0xa8c8b8, b: 0x3a4a44, a: 0x7ac8a8 }, 'idle'],
    ['npc-officer', 'n', 'Bayview Officer', 'police', { s: 2, h: 'black', t: NAVY, b: NAVY, m: 'cap' }, 'idle'],
    ['npc-soldier', 'n', 'Marina Soldier', 'soldier', { s: 1, h: 'brown', t: 0x4a5238, b: 0x3a4030, m: 'helm' }, 'idle'],
    ['npc-pilot', 'n', 'Air One Pilot', 'pilot', { s: 3, h: 'black', t: OLIVE, b: OLIVE, m: 'helm' }, 'idle'],
    ['npc-fish', 'n', 'Fish Vendor', 'vendor', { s: 0, h: 'grey', t: 0x8a9aaa, b: 0x3a3f46, a: 0x2a5a8a }, 'idle'],
    ['npc-donut', 'n', 'Donut Vendor', 'vendor', { s: 2, h: 'black', t: 0xc8b8a8, b: 0x5a4a3a, a: 0xd87a9a, m: 'cap' }, 'idle'],
    ['npc-gelato', 'n', 'Gelato Vendor', 'vendor', { s: 1, h: 'brown', t: 0xa8c8b8, b: 0x3a4a44, a: 0x7ac8a8 }, 'idle'],
    ['hostile', 'n', 'Hostile', 'hostile', { s: 1, h: 'black', t: 0x1c1c20, b: 0x141518, m: 'hood', r: 1 }, 'aim']
  ];
  C.forEach(function (c) {
    N.reg(c[1], c[0], {
      name: c[2], cls: c[3], size: 2.2, pose: c[5],
      build: (function (spec, pose) {
        return function () { var g = F.figure(spec); F.pose(g, pose, 0); return g; };
      })(c[4], c[5])
    });
  });
  // Live pose driver for the viewer / game: call with time to animate.
  N.poseFigure = function (g, name, t) { F.pose(g, name, t); };
})();
