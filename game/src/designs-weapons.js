// NEON BAY — 27 weapons, 6 classes (Round 9, fresh). Small low-poly models,
// length along +Y, held / pickup scale. Brands: PALMERA, BAYLINE, SOL.
(function () {
  var N = window.NEON_DESIGNS, H = N.h, T = window.THREE;
  var GUN = 0x2b2f33, POLY = 0x17181a, STL = 0x8a9199, WOOD = 0x66401f, TAN = 0xb59a6a, OLV = 0x5a6142;
  function dot(g, c, x, y, z) {
    var m = new T.Mesh(new T.BoxGeometry(.05, .05, .03), H.mat(0x222222, c));
    m.position.set(x, y, z); g.add(m);
  }
  function pistol(o) {
    var g = H.grp(), L = o.len;
    H.put(g, H.box(.09, L * .55, .12, GUN, 0, .1, .02), H.box(.08, .16, .3, POLY, 0, -.05, -.16), H.cyl(.03, .03, .2, STL, 0, L * .38, .02, 'y'), H.box(.04, .08, .05, STL, 0, L * .28, .1));
    dot(g, o.dot || 0x40ff40, .05, L * .2, .09);
    return g;
  }
  function rifle(o) {
    var g = H.grp(), L = o.len;
    H.put(g, H.box(.09, L * .5, .13, GUN, 0, 0, .02), H.cyl(.035, .035, L * .3, STL, 0, L * .4, .02, 'y'), H.box(.08, .22, .16, o.wood ? WOOD : POLY, 0, -L * .28, 0), H.box(.07, .14, .22, POLY, 0, -.02, -.14), H.box(.07, .1, .1, POLY, 0, L * .12, .1));
    if (o.scope) H.put(g, H.cyl(.05, .05, .3, STL, 0, L * .05, .14, 'y'));
    if (o.sup) H.put(g, H.cyl(.045, .045, .25, POLY, 0, L * .55, .02, 'y'));
    dot(g, o.dot || 0xffc020, .05, L * .1, .1);
    return g;
  }
  function sniper(o) {
    var g = rifle({ len: o.len, wood: o.wood, scope: true, dot: o.dot });
    H.put(g, H.cyl(.04, .04, .5, STL, 0, o.len * .62, .02, 'y'), H.box(.05, .3, .05, POLY, .06, -o.len * .1, -.08), H.box(.05, .3, .05, POLY, -.06, -o.len * .1, -.08));
    return g;
  }
  function launcher(o) {
    var g = H.grp(), L = o.len;
    if (o.dbl) H.put(g, H.cyl(.09, .09, L, GUN, -.09, 0, 0, 'y', 10), H.cyl(.09, .09, L, GUN, .09, 0, 0, 'y', 10));
    else H.put(g, H.cyl(.13, .13, L, o.tube || OLV, 0, 0, 0, 'y', 12), H.cyl(.02, .13, .3, o.tip || GUN, 0, L / 2 + .12, 0, 'y', 10));
    H.put(g, H.box(.08, .2, .14, POLY, 0, -.1, -.14), H.box(.1, .16, .08, STL, 0, L * .2, .16));
    if (o.cone) H.put(g, H.cyl(.14, .03, .35, o.cone, 0, -L / 2 - .15, 0, 'y', 10));
    if (o.big) H.put(g, H.box(.14, .34, .14, POLY, 0, L * .1, .2));
    dot(g, o.dot || 0xff3020, .14, L * .2, 0);
    return g;
  }
  function smg(o) {
    var g = H.grp(), L = o.len;
    H.put(g, H.box(o.bw || .09, L * .55, .12, o.body || GUN, 0, 0, .02), H.box(.07, .12, .24, POLY, 0, -.08, -.14), H.box(.06, .18, .08, POLY, 0, -L * .25, 0));
    if (o.drum) H.put(g, H.cyl(.16, .16, .1, STL, 0, -.05, -.12, 'x', 12));
    if (o.sup) H.put(g, H.cyl(.05, .05, .42, STL, 0, L * .42, .02, 'y'));
    if (o.rod) H.put(g, H.cyl(.02, .02, .3, STL, 0, -L * .38, .02, 'y'), H.box(.09, .04, .12, POLY, 0, -L * .52, .02));
    if (o.long) H.put(g, H.cyl(.03, .03, .5, GUN, 0, L * .5, .02, 'y'));
    if (o.sight) { H.put(g, H.box(.09, .16, .09, POLY, 0, L * .12, .13)); dot(g, 0xff8020, 0, L * .12, .18); }
    dot(g, o.dot || 0x40ff40, .05, L * .15, .09);
    return g;
  }
  function explosive(o) {
    var g = H.grp();
    if (o.shape === 'ball') H.put(g, H.sph(.16, OLV, 0, 0, 0, 1, 1, 1.1), H.cyl(.02, .02, .16, STL, .1, 0, .14, 'z'));
    else if (o.shape === 'stick') H.put(g, H.cyl(.05, .05, .7, TAN, 0, 0, 0, 'y'), H.cyl(.06, .06, .12, POLY, 0, .4, 0, 'y'));
    else if (o.shape === 'disc') H.put(g, H.cyl(.2, .24, .12, GUN, 0, 0, 0, 'z', 12), H.cyl(.05, .05, .1, STL, 0, 0, .1, 'z'));
    else if (o.shape === 'pack') H.put(g, H.box(.34, .24, .12, TAN, 0, 0, 0), H.box(.36, .05, .14, POLY, 0, 0, 0));
    else H.put(g, H.cyl(.09, .09, .5, STL, 0, 0, 0, 'y', 10), H.cyl(.015, .015, .2, 0x8a6a3a, 0, .3, 0, 'y'));
    dot(g, o.dot || 0xff3020, 0, 0, .17);
    return g;
  }
  N._wpn = { pistol: pistol, rifle: rifle, sniper: sniper, launcher: launcher, smg: smg, explosive: explosive };
})();
// Round 9, part 2: the 27-weapon table (NEON BAY brands: PALMERA, BAYLINE, SOL).
(function () {
  var N = window.NEON_DESIGNS, W = N._wpn;
  var T = [
    ['p1', 'Palmera Wren', 'pistol', 22, 3.5, 18, 'pistol', { len: .55 }],
    ['p2', 'Bayline Falcon 17', 'pistol', 26, 3.0, 22, 'pistol', { len: .62 }],
    ['p3', 'Sol Duellist', 'pistol', 34, 1.8, 30, 'pistol', { len: .8, dot: 0xffc020 }],
    ['p4', 'Palmera Sixiron', 'pistol', 40, 1.2, 26, 'pistol', { len: .66, dot: 0xff3020 }],
    ['p5', 'Bayline Tempest', 'pistol', 20, 6.0, 16, 'pistol', { len: .6, dot: 0x40ff40 }],
    ['a1', 'Palmera LC-7 Carbine', 'rifle', 34, 4.5, 60, 'rifle', { len: 1.0 }],
    ['a2', 'Sol Timberline 62', 'rifle', 42, 3.0, 70, 'rifle', { len: 1.15, wood: true }],
    ['a3', 'Bayline M9 Bullpup', 'rifle', 32, 5.0, 55, 'rifle', { len: .9, scope: true }],
    ['a4', 'Palmera Warlord BR-10', 'rifle', 48, 2.2, 80, 'rifle', { len: 1.25, scope: true, dot: 0xff3020 }],
    ['s1', 'Sol Longshot', 'sniper', 90, .8, 140, 'sniper', { len: 1.5 }],
    ['s2', 'Bayline DMR-12', 'sniper', 72, 1.4, 120, 'sniper', { len: 1.35, wood: true }],
    ['s3', 'Palmera Anvil AMR', 'sniper', 120, .5, 160, 'sniper', { len: 1.7, dot: 0xff3020 }],
    ['l1', 'Sol Dart-1', 'launcher', 110, .4, 90, 'launcher', { len: 1.1, tip: TAN }],
    ['l2', 'Bayline Kometa', 'launcher', 130, .3, 100, 'launcher', { len: 1.25, cone: TAN }],
    ['l3', 'Palmera Hornet', 'launcher', 95, .8, 70, 'launcher', { len: .95, tube: TAN, big: 1 }],
    ['l4', 'Sol Hydra-4', 'launcher', 150, .25, 110, 'launcher', { len: 1.4, dbl: 1, dot: 0xffc020 }],
    ['m1', 'Palmera Wasp', 'smg', 18, 8.0, 30, 'smg', { len: .7, rod: 1 }],
    ['m2', 'Bayline Pipe-9', 'smg', 20, 7.0, 32, 'smg', { len: .75, sup: 1 }],
    ['m3', 'Sol Viper-9', 'smg', 22, 7.5, 34, 'smg', { len: .72, sight: 1, bw: .13 }],
    ['m4', 'Palmera Drummer 71', 'smg', 24, 6.0, 30, 'smg', { len: .8, drum: 1 }],
    ['m5', 'Bayline Whisper-9', 'smg', 16, 6.5, 28, 'smg', { len: .7, long: 1, sight: 1, body: WOOD, dot: 0x40c0ff }],
    ['x1', 'Palmera Pineapple Frag', 'explosive', 80, .5, 14, 'explosive', { shape: 'ball' }],
    ['x2', 'Sol Baton', 'explosive', 45, 1.0, 2, 'explosive', { shape: 'stick' }],
    ['x3', 'Bayline Gecko Charge', 'explosive', 100, .3, 6, 'explosive', { shape: 'pack' }],
    ['x4', 'Palmera Hedgehog Mine', 'explosive', 90, .2, 4, 'explosive', { shape: 'disc' }],
    ['x5', 'Sol Satchel-5', 'explosive', 120, .25, 5, 'explosive', { shape: 'pack', dot: 0xffc020 }],
    ['x6', 'Bayline Pipe Bomb', 'explosive', 70, .4, 10, 'explosive', { shape: 'pipe' }]
  ];
  T.forEach(function (w) {
    N.reg('w', w[0], {
      name: w[1], cls: w[2], size: 1.6,
      stats: { damage: w[3], fireRate: w[4], range: w[5] },
      build: (function (key, params) {
        return function () { return W[key](params); };
      })(w[6], w[7])
    });
  });
})();
