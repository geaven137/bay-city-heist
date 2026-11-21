// NEON BAY — 20 vehicles (Round 9, fresh). Z-up, forward = +Y.
// Shared builders (car / heli / plane / moto) + per-vehicle params in part 2.
(function () {
  var N = window.NEON_DESIGNS, H = N.h, T = window.THREE;
  var STEEL = 0x8a9199, GLASS = 0x10151c, TYRE = 0x0c0d0f, LAMP = 0xfff6c8;
  function ebox(w, d, h, c, e, x, y, z) {
    var m = new T.Mesh(new T.BoxGeometry(w, d, h), H.mat(c, e));
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function wheel(r, w) {
    var g = H.grp();
    H.put(g, H.cyl(r, r, w, TYRE, 0, 0, 0, 'x', 12), H.cyl(r * .45, r * .45, w + .03, STEEL, 0, 0, 0, 'x', 8));
    return g;
  }
  function wheels4(g, len, wid, r, z) {
    var ys = [len * .32, -len * .32], xs = [wid / 2 + .02, -wid / 2 - .02];
    for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
      var w = wheel(r, .2); w.position.set(xs[j], ys[i], z); g.add(w);
    }
  }
  // Generic car: body + cabin + 4 wheels + lights. o: len,wid,bodyH,cabLen,cabH,cabY,bodyC,cabC,wheelR
  function car(o) {
    var g = H.grp(), L = o.len, W = o.wid, z0 = o.wheelR;
    H.put(g,
      H.box(L, W, o.bodyH, o.bodyC, 0, 0, z0 + o.bodyH / 2),
      H.box(o.cabLen, W * .86, o.cabH, o.cabC, o.cabY || 0, 0, z0 + o.bodyH + o.cabH / 2),
      H.box(.1, W * .8, .1, GLASS, 0, 0, z0 + o.bodyH + .05),
      ebox(.1, .3, .12, LAMP, 0xffedb0, L / 2, W * .3, z0 + o.bodyH * .62),
      ebox(.1, .3, .12, LAMP, 0xffedb0, L / 2, -W * .3, z0 + o.bodyH * .62),
      ebox(.08, .3, .1, 0x7a1010, 0xc01818, -L / 2, W * .3, z0 + o.bodyH * .62),
      ebox(.08, .3, .1, 0x7a1010, 0xc01818, -L / 2, -W * .3, z0 + o.bodyH * .62));
    wheels4(g, L, W, o.wheelR, o.wheelR);
    return g;
  }
  // Helicopter: sphere fuselage + tail boom + rotors + skids.
  function heli(o) {
    var g = H.grp(), z = 1.05;
    H.put(g,
      H.sph(.95, o.bodyC, 0, 0, z, .62, 1.45, .6),
      H.sph(.62, GLASS, 0, .95, z + .12, .8, .9, .8),
      H.box(2.6, .3, .3, o.bodyC, 0, -2.4, z + .15),
      H.box(.12, .7, 1.0, o.bodyC, 0, -3.6, z + .5),
      H.box(2.4, .34, .06, o.stripeC, 0, .1, z - .1),
      H.cyl(.06, .06, 2.4, STEEL, .62, 0, .18, 'y'),
      H.cyl(.06, .06, 2.4, STEEL, -.62, 0, .18, 'y'));
    var rotor = H.grp(); rotor.position.set(0, 0, z + .75);
    H.put(rotor, H.box(5.2, .14, .04, DARK, 0, 0, 0), H.box(.14, 5.2, .04, DARK, 0, 0, 0), H.cyl(.07, .07, .5, STEEL, 0, 0, -.2, 'z'));
    var tail = H.grp(); tail.position.set(0, -3.7, z + .5);
    H.put(tail, H.box(.05, 1.1, .16, DARK, .08, 0, 0), H.box(.05, 1.1, .16, DARK, -.08, 0, 0));
    g.add(rotor); g.add(tail);
    N.anim.push(function (t) { rotor.rotation.z = t * 9; tail.rotation.x = t * 22; });
    if (o.flir) H.put(g, H.sph(.16, GLASS, 0, 1.15, z - .55, 1, 1, 1));
    if (o.bar) H.put(g, ebox(.5, .2, .1, 0x881111, 0xff2222, -.2, 0, z + .62), ebox(.5, .2, .1, 0x112288, 0x3355ff, .2, 0, z + .62));
    return g;
  }
  // Plane: cylinder fuselage + wings + tail. prop=true spins a nose prop.
  function plane(o) {
    var g = H.grp(), L = o.len, z = 1.1;
    H.put(g,
      H.cyl(o.r, o.r * .8, L, o.bodyC, 0, 0, z, 'y', 14),
      H.sph(o.r, o.bodyC, 0, L / 2, z, 1, 1.15, 1),
      H.box(.14, o.span, .09, o.bodyC, 0, .1, z + .15),
      H.box(.1, o.span * .32, .07, o.bodyC, 0, -L / 2 + .4, z + .3),
      H.box(.08, .9, o.finH, o.bodyC, 0, -L / 2 + .3, z + o.finH / 2),
      H.box(L * .55, o.r * 1.7, .08, o.stripeC, 0, .1, z - o.r * .4));
    if (o.ttail) H.put(g, H.box(.1, o.span * .3, .07, o.bodyC, 0, -L / 2 + .3, z + o.finH + .1));
    if (o.prop) {
      var p = H.grp(); p.position.set(0, L / 2 + .5, z);
      H.put(p, H.box(.1, 2.2, .3, DARK, 0, 0, .3), H.box(.1, 2.2, .3, DARK, 0, 0, -.3));
      g.add(p);
      N.anim.push(function (t) { p.rotation.y = t * 18; });
    } else {
      H.put(g, H.cyl(.28, .34, 1.4, STEEL, .9, -.4, z - .1, 'y', 10), H.cyl(.28, .34, 1.4, STEEL, -.9, -.4, z - .1, 'y', 10));
    }
    var gear = [[0, L * .32, .3], [.8, -.1, .3], [-.8, -.1, .3]];
    for (var i = 0; i < 3; i++) H.put(g, H.cyl(.05, .05, .5, STEEL, gear[i][0], gear[i][1], .55, 'z'), H.cyl(.3, .3, .14, TYRE, gear[i][0], gear[i][1], gear[i][2], 'x', 10));
    return g;
  }
  // Motorcycle: two wheels + tank + seat + bars + exhaust.
  function moto(o) {
    var g = H.grp(), r = .36;
    var wf = wheel(r, .14); wf.position.set(0, .62, r);
    var wr = wheel(r, .14); wr.position.set(0, -.62, r);
    H.put(g, wf, wr,
      H.sph(.3, o.tankC, 0, .18, .78, 1, 1.5, .8),
      H.box(.34, .62, .14, DARK, 0, -.42, .82),
      H.box(.1, .5, .1, o.bodyC, 0, .62, .86),
      H.cyl(.035, .035, .8, STEEL, 0, .62, 1.05, 'x'),
      ebox(.12, .1, .14, LAMP, 0xffedb0, 0, .72, .92),
      H.cyl(.07, .07, 1.0, STEEL, .2, -.2, .45, 'y'),
      H.box(.3, .5, .05, o.bodyC, 0, .62, .62));
    if (o.screen) H.put(g, H.box(.02, .34, .5, 0xd8e4e0, 0, .58, 1.25));
    return g;
  }
  N._veh = { car: car, heli: heli, plane: plane, moto: moto, ebox: ebox };
})();
// Round 9, part 2: the 20-vehicle table (NEON BAY names only) + registration.
(function () {
  var N = window.NEON_DESIGNS, H = N.h, V = N._veh, E = V.ebox;
  var D = 0x17181a, WHT = 0xf2ede4, RED = 0xc02020, BLU = 0x2050a0, GRN = 0x2e6b34, YEL = 0xf2c018, ORG = 0xe8641c, TEL = 0x2a7f8f, MRN = 0x6e1f24;
  function lightbar(g, z) {
    H.put(g, E(.55, .22, .1, 0x881111, 0xff2222, -.3, 0, z), E(.55, .22, .1, 0x112288, 0x3355ff, .3, 0, z));
  }
  var T = [
    ['skylark', 'Skylark', 'plane', 10, { max: 62, acc: 10, turn: 3.2, drift: .1, air: true }, function () { return V.plane({ len: 5.2, r: .62, span: 7.2, finH: 1.1, bodyC: WHT, stripeC: TEL, prop: true }); }],
    ['airliner', 'Island Airliner', 'plane', 11, { max: 88, acc: 8, turn: 2.4, drift: .05, air: true }, function () { return V.plane({ len: 8.6, r: .95, span: 9.4, finH: 1.7, bodyC: WHT, stripeC: BLU }); }],
    ['execjet', 'Executive Jet', 'plane', 10, { max: 95, acc: 12, turn: 3.0, drift: .05, air: true }, function () { return V.plane({ len: 7.4, r: .8, span: 8.0, finH: 1.4, bodyC: WHT, stripeC: ORG, ttail: true }); }],
    ['patrol-car', 'Bayview Patrol Car', 'car', 4.6, { max: 52, acc: 12, turn: 4.2, drift: .25, air: false }, function () { var g = V.car({ len: 4.4, wid: 1.9, bodyH: .7, cabLen: 2.2, cabH: .55, cabY: -.2, bodyC: D, cabC: WHT, wheelR: .36 }); lightbar(g, 1.62); H.put(g, H.box(4.0, 1.92, .06, WHT, 0, 0, 1.06)); return g; }],
    ['civil-sedan', 'Civil Sedan', 'car', 4.4, { max: 44, acc: 9, turn: 3.6, drift: .2, air: false }, function () { return V.car({ len: 4.2, wid: 1.8, bodyH: .65, cabLen: 2.1, cabH: .55, cabY: -.1, bodyC: GRN, cabC: GRN, wheelR: .34 }); }],
    ['fire-pumper', 'St. Marina Fire Pumper', 'truck', 5.4, { max: 38, acc: 8, turn: 3.0, drift: .1, air: false }, function () { var g = V.car({ len: 5.2, wid: 2.1, bodyH: 1.5, cabLen: 1.6, cabH: .7, cabY: 1.6, bodyC: RED, cabC: RED, wheelR: .42 }); H.put(g, H.cyl(.12, .12, 1.6, 0xd8d8d8, 0, -1.2, 2.3, 'y')); return g; }],
    ['fire-ladder', 'St. Marina Fire Aerial Ladder', 'truck', 6.2, { max: 36, acc: 7, turn: 2.8, drift: .1, air: false }, function () { var g = V.car({ len: 6.0, wid: 2.1, bodyH: 1.4, cabLen: 1.6, cabH: .7, cabY: 1.9, bodyC: RED, cabC: RED, wheelR: .42 }); H.put(g, H.box(5.4, .5, .16, STEEL0, 0, -.3, 2.6)); return g; }],
    ['fire-rescue', 'St. Marina Fire Heavy Rescue', 'truck', 5.6, { max: 38, acc: 8, turn: 3.0, drift: .1, air: false }, function () { var g = V.car({ len: 5.4, wid: 2.2, bodyH: 1.9, cabLen: 1.5, cabH: .7, cabY: 1.7, bodyC: RED, cabC: RED, wheelR: .42 }); H.put(g, H.box(2.6, 2.0, .5, 0xd8d8d8, 0, -1.2, 2.5)); return g; }],
    ['fire-arff', 'St. Marina Fire ARFF Crash Tender', 'truck', 5.8, { max: 40, acc: 8, turn: 3.0, drift: .1, air: false }, function () { var g = V.car({ len: 5.6, wid: 2.3, bodyH: 1.7, cabLen: 1.7, cabH: .7, cabY: 1.6, bodyC: YEL, cabC: YEL, wheelR: .44 }); H.put(g, H.cyl(.1, .16, .7, D, 0, 1.9, 2.5, 'z')); return g; }],
    ['ambulance', 'St. Marina Ambulance', 'truck', 5.4, { max: 46, acc: 10, turn: 3.4, drift: .15, air: false }, function () { var g = V.car({ len: 5.2, wid: 2.1, bodyH: 1.8, cabLen: 1.5, cabH: .7, cabY: 1.7, bodyC: WHT, cabC: WHT, wheelR: .4 }); H.put(g, H.box(4.6, 2.12, .18, RED, 0, -.6, 1.5), H.box(.06, .5, .5, RED, 1.07, -.6, 1.5), H.box(.06, .16, .5, RED, 1.07, -.6, 1.5)); return g; }],
    ['moto-sport', 'Sport Motorcycle', 'moto', 2.4, { max: 58, acc: 15, turn: 5.0, drift: .4, air: false }, function () { return V.moto({ bodyC: RED, tankC: RED }); }],
    ['moto-cruiser', 'Cruiser Motorcycle', 'moto', 2.6, { max: 48, acc: 11, turn: 4.2, drift: .3, air: false }, function () { return V.moto({ bodyC: MRN, tankC: MRN, screen: true }); }],
    ['moto-enduro', 'Enduro Motorcycle', 'moto', 2.4, { max: 52, acc: 13, turn: 4.8, drift: .45, air: false }, function () { return V.moto({ bodyC: ORG, tankC: ORG }); }],
    ['bay-tourer', 'Bay Tourer', 'heli', 5.6, { max: 55, acc: 9, turn: 3.4, drift: .1, air: true }, function () { return V.heli({ bodyC: YEL, stripeC: TEL }); }],
    ['air-one', 'Air One', 'heli', 5.6, { max: 58, acc: 10, turn: 3.6, drift: .1, air: true }, function () { var g = V.heli({ bodyC: D, stripeC: WHT, flir: true, bar: true }); H.put(g, H.box(.08, 2.2, .3, WHT, -.6, -2.4, 1.2)); return g; }],
    ['hatchback', 'Civil Hatchback', 'car', 4.2, { max: 42, acc: 9, turn: 3.8, drift: .2, air: false }, function () { return V.car({ len: 3.9, wid: 1.8, bodyH: .8, cabLen: 2.4, cabH: .6, cabY: -.2, bodyC: RED, cabC: RED, wheelR: .33 }); }],
    ['pickup', 'Civil Pickup', 'car', 4.8, { max: 44, acc: 9, turn: 3.5, drift: .2, air: false }, function () { var g = V.car({ len: 4.7, wid: 1.9, bodyH: .7, cabLen: 1.9, cabH: .6, cabY: 1.0, bodyC: TEL, cabC: TEL, wheelR: .37 }); H.put(g, H.box(1.9, 1.7, .5, TEL, 0, -1.3, 1.15)); return g; }],
    ['suv', 'Family SUV', 'car', 4.8, { max: 46, acc: 9, turn: 3.6, drift: .2, air: false }, function () { var g = V.car({ len: 4.6, wid: 2.0, bodyH: .9, cabLen: 2.8, cabH: .65, cabY: -.2, bodyC: 0x7a7f72, cabC: 0x7a7f72, wheelR: .38 }); H.put(g, H.box(2.6, .08, .06, D, -.4, 0, 2.0), H.box(2.6, .08, .06, D, .4, 0, 2.0)); return g; }],
    ['coupe', 'Sports Coupe', 'car', 4.6, { max: 60, acc: 14, turn: 4.4, drift: .35, air: false }, function () { var g = V.car({ len: 4.5, wid: 1.9, bodyH: .55, cabLen: 2.0, cabH: .5, cabY: -.3, bodyC: ORG, cabC: ORG, wheelR: .35 }); H.put(g, H.box(.5, 1.7, .06, D, 0, -2.1, 1.25)); return g; }],
    ['swat-truck', 'Bayview SWAT Armored Truck', 'truck', 5.6, { max: 40, acc: 8, turn: 3.0, drift: .1, air: false }, function () { var g = V.car({ len: 5.4, wid: 2.2, bodyH: 1.9, cabLen: 1.4, cabH: .8, cabY: 1.8, bodyC: D, cabC: D, wheelR: .44 }); lightbar(g, 2.85); H.put(g, H.box(.3, 2.0, .5, D, 2.7, 0, .8)); return g; }]
  ];
  var STEEL0 = 0x8a9199;
  T.forEach(function (v) {
    N.reg('v', v[0], { name: v[1], cls: v[2], size: v[3], stats: v[4], build: v[5] });
  });
})();
