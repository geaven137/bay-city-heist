// NEON BAY — 34 buildings + 3 road modules (Round 9, fresh). Z-up.
// Never a bare box: awning + sign + glass ground floor + roof props + dressing.
(function () {
  var N = window.NEON_DESIGNS, H = N.h, T = window.THREE;
  var GLASS = 0x20242c, CONC = 0x9a938a, ASPH = 0x2e2e32;
  function sbox(w, d, h, c, e, x, y, z) {
    var m = new T.Mesh(new T.BoxGeometry(w, d, h), H.mat(c, e));
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function windows(g, w, h, fl, co, y, z0) {
    for (var f = 0; f < fl; f++) for (var c = 0; c < co; c++)
      H.put(g, H.box(w / co * .55, .06, h / fl * .5, GLASS, -w / 2 + (c + .5) * (w / co), y, z0 + (f + .5) * (h / fl)));
  }
  function roofProps(g, w, d, h) {
    H.put(g, H.box(1.2, 1.0, .5, 0x7a7d80, -w / 4, 0, h + .25), H.cyl(.5, .5, 1.0, 0xb8b0a0, w / 4, -d / 4, h + .5, 'z'), H.cyl(.03, .03, 2.2, 0x666666, w / 3, d / 3, h + 1.1, 'z'));
  }
  function tower(o) {
    var g = H.grp();
    H.put(g, H.box(o.w, o.d, o.h, o.c, 0, 0, o.h / 2), H.box(o.w * .9, .08, 1.6, 0x2a3038, 0, o.d / 2, 1.0));
    windows(g, o.w, o.h - 3, o.fl, o.co, o.d / 2, 2.6);
    windows(g, o.w, o.h - 3, o.fl, o.co, -o.d / 2, 2.6);
    roofProps(g, o.w, o.d, o.h);
    return g;
  }
  function roofProp(g, kind, o) {
    var z = o.h + .4;
    if (kind === 'burger') H.put(g, H.cyl(.7, .7, .22, 0xd8a060, 0, 0, z + .1, 'z', 10), H.cyl(.75, .75, .14, 0x6a4a28, 0, 0, z - .05, 'z', 10), H.cyl(.7, .7, .12, 0xd8a060, 0, 0, z - .18, 'z', 10));
    else if (kind === 'cup') H.put(g, H.cyl(.45, .35, .7, 0xfff2f2, 0, 0, z + .15, 'z', 10), H.box(.14, .3, .4, 0xfff2f2, .5, 0, z + .15));
    else if (kind === 'donut') H.put(g, H.cyl(.7, .7, .25, 0xd87a9a, 0, 0, z, 'z', 12), H.cyl(.45, .45, .28, 0xfff2f2, 0, 0, z, 'z', 12));
    else if (kind === 'cone') H.put(g, H.cyl(.05, .4, .9, 0xd8a060, 0, 0, z + .3, 'z', 8), H.sph(.45, 0xfff2f2, 0, 0, z + .95, 1, 1, 1));
    else if (kind === 'bowl') H.put(g, H.cyl(.55, .4, .35, 0xfff2f2, 0, 0, z, 'z', 10), H.cyl(.4, .4, .1, 0xe8c040, 0, 0, z + .2, 'z', 10));
    else if (kind === 'pizza') H.put(g, H.cyl(.8, .8, .12, 0xe8c040, 0, 0, z, 'z', 12), H.box(.2, .2, .06, 0xc02020, .3, 0, z + .1), H.box(.2, .2, .06, 0x2a7a4a, -.3, .2, z + .1));
    else if (kind === 'taco') H.put(g, H.box(1.2, .5, .7, 0xe8a020, 0, 0, z + .15), H.box(1.0, .3, .3, 0x7a9a3a, 0, 0, z + .4));
  }
  function shop(o) {
    var g = H.grp();
    H.put(g, H.box(o.w, o.d, o.h, o.c, 0, 0, o.h / 2),
      sbox(o.w * .7, .08, .5, o.sign, o.sign, 0, o.d / 2 + .02, o.h - .5),
      H.box(o.w * .8, .06, 1.9, GLASS, 0, o.d / 2, 1.15),
      H.box(.9, .06, 2.1, 0x4a3a28, -o.w / 2 + .7, o.d / 2, 1.25));
    for (var s = 0; s < 5; s++) H.put(g, H.box(o.w * .19, .7, .08, s % 2 ? 0xfff2f2 : o.aw, -o.w * .38 + s * o.w * .19, o.d / 2 + .3, 2.7));
    if (o.prop) roofProp(g, o.prop, o);
    roofProps(g, o.w, o.d, o.h);
    return g;
  }
  function house(o) {
    var g = H.grp();
    H.put(g, H.box(o.w, o.d, o.h, o.c, 0, 0, o.h / 2));
    var r1 = H.box(o.w + .4, o.d / 2 + .3, .1, o.roof, 0, o.d / 4, o.h + .7); r1.rotation.x = -.45;
    var r2 = H.box(o.w + .4, o.d / 2 + .3, .1, o.roof, 0, -o.d / 4, o.h + .7); r2.rotation.x = .45;
    H.put(g, r1, r2, H.box(1.0, .08, 2.0, 0x4a3a28, 0, o.d / 2, 1.1));
    windows(g, o.w, o.h, 1, 3, o.d / 2, .8);
    return g;
  }
  function kiosk(o) {
    var g = H.grp();
    H.put(g, H.box(2.4, 2.0, 2.5, o.c, 0, 0, 1.25),
      H.box(2.6, 2.2, .12, o.roof, 0, 0, 2.6),
      sbox(1.8, .08, .45, o.sign, o.sign, 0, 1.02, 2.1),
      H.box(2.0, .5, .9, 0x6a5a44, 0, 1.05, .7));
    return g;
  }
  function civic(o) {
    var g = H.grp();
    H.put(g, H.box(o.w, o.d, o.h, o.c, 0, 0, o.h / 2),
      H.box(o.w * .5, 2.2, .15, 0x8a8578, 0, o.d / 2 + 1.0, 3.4),
      H.box(.18, .18, 3.4, 0x666666, -o.w * .25, o.d / 2 + 1.0, 1.7),
      H.box(.18, .18, 3.4, 0x666666, o.w * .25, o.d / 2 + 1.0, 1.7));
    windows(g, o.w, o.h - 1, o.fl || 3, o.co || 5, o.d / 2, .8);
    if (o.cross) {
      H.put(g, H.box(.5, .08, 2.2, 0xc01818, 0, o.d / 2 + .02, o.h - 1.2), H.box(1.6, .08, .5, 0xc01818, 0, o.d / 2 + .02, o.h - 1.2));
      H.put(g, H.cyl(3.2, 3.2, .12, 0x3a3f46, 0, 0, o.h + .06, 'z', 16));
    }
    if (o.doors) for (var i = 0; i < 3; i++) H.put(g, H.box(1.8, .08, 2.4, 0xc02020, -o.w / 2 + 2 + i * 2.6, o.d / 2, 1.3));
    if (o.open) H.put(g, H.box(o.w * .6, .1, 2.4, 0x14161a, 0, o.d / 2, 1.3));
    roofProps(g, o.w, o.d, o.h);
    return g;
  }
  function road(kind) {
    var g = H.grp();
    if (kind === 'road') {
      H.put(g, H.box(12, 6, .16, ASPH, 0, 0, .08), H.box(12, .18, .2, CONC, 0, 3.1, .1), H.box(12, .18, .2, CONC, 0, -3.1, .1));
      for (var i = 0; i < 6; i++) H.put(g, H.box(.9, .12, .02, 0xf2c018, -5 + i * 2, 0, .18));
    } else if (kind === 'cross') {
      H.put(g, H.box(12, 12, .16, ASPH, 0, 0, .08));
      for (var j = 0; j < 5; j++) {
        H.put(g, H.box(.7, 2.2, .02, 0xe8e8e8, -4.4, -3.4 + j * 1.7, .18), H.box(2.2, .7, .02, 0xe8e8e8, -3.4 + j * 1.7, 4.4, .18));
      }
    } else {
      H.put(g, H.box(12, 3, .2, CONC, 0, 0, .1), H.box(12, .2, .24, 0x7a746a, 0, 1.5, .12));
      for (var k = -1; k < 2; k++) H.put(g, H.cyl(.05, .07, 2.6, 0x3a3f46, k * 4, 1.0, 1.5, 'z'), sbox(.5, .3, .12, 0xfff2c0, 0xffedb0, k * 4, 1.0, 2.85));
    }
    return g;
  }
  function palm(x, y, s) {
    var g = H.grp(), r = H.rng((x * 13 + y * 7) | 0);
    H.put(g, H.cyl(.1, .18, 3 * s, 0x6a4a28, 0, 0, 1.5 * s, 'z'));
    for (var i = 0; i < 6; i++) {
      var f = H.box(1.7 * s, .12, .04, 0x2e6b34, 0, 0, 3 * s);
      f.rotation.set(.6, 0, i * Math.PI / 3 + r() * .3);
      f.position.set(Math.cos(i * Math.PI / 3) * .7 * s, Math.sin(i * Math.PI / 3) * .7 * s, 3 * s);
      g.add(f);
    }
    g.position.set(x, y, 0);
    return g;
  }
  N._bld = { tower: tower, shop: shop, house: house, kiosk: kiosk, civic: civic, road: road, palm: palm, sbox: sbox };
})();
// Round 9, part 2: the 34-building table (NEON BAY names only) + registration.
(function () {
  var N = window.NEON_DESIGNS, H = N.h, B = N._bld;
  var T = [
    ['road-straight', 'Straight Road', 'road', 12, function () { return B.road('road'); }],
    ['intersection', 'Intersection', 'road', 12, function () { return B.road('cross'); }],
    ['sidewalk', 'Sidewalk', 'road', 12, function () { return B.road('walk'); }],
    ['tower-glass', 'Marina Glass Tower', 'tower', 20, function () { return B.tower({ w: 8, d: 8, h: 18, c: 0x5a7a8a, fl: 9, co: 5 }); }],
    ['tower-beacon', 'Beacon Tower', 'tower', 18, function () { return B.tower({ w: 7, d: 7, h: 16, c: 0xc8a060, fl: 8, co: 4 }); }],
    ['tower-market', 'Marina Market House', 'tower', 14, function () { return B.tower({ w: 9, d: 8, h: 12, c: 0x8a5a40, fl: 5, co: 5 }); }],
    ['tower-terrace', 'Terrace Residences', 'tower', 15, function () { var g = B.tower({ w: 10, d: 7, h: 13, c: 0xb8a890, fl: 6, co: 5 }); for (var f = 0; f < 5; f++) H.put(g, H.box(9, .8, .12, 0x8a7a68, 0, 3.9, 2.5 + f * 2.2)); return g; }],
    ['shop-burgers', 'Bay Shack Burgers', 'shop', 8, function () { return B.shop({ w: 7, d: 6, h: 4.2, c: 0xc87040, aw: 0xe84040, sign: 0xffc020, prop: 'burger' }); }],
    ['shop-pizza', 'Marina Pizza', 'shop', 8, function () { return B.shop({ w: 7, d: 6, h: 4.2, c: 0xd8c8a8, aw: 0x2a7a4a, sign: 0xff5030, prop: 'pizza' }); }],
    ['shop-sushi', 'Bay Sushi', 'shop', 8, function () { return B.shop({ w: 6, d: 6, h: 4.0, c: 0x3a4a5a, aw: 0x20242c, sign: 0x40c0d8 }); }],
    ['shop-noodles', 'Golden Bay Noodles', 'shop', 8, function () { return B.shop({ w: 6, d: 6, h: 4.0, c: 0xc02020, aw: 0xf2c018, sign: 0xffe020, prop: 'bowl' }); }],
    ['shop-coffee', 'Beacon Roast Coffee', 'shop', 8, function () { return B.shop({ w: 6, d: 5, h: 3.8, c: 0x6a4a28, aw: 0x2a2d34, sign: 0xc8a060, prop: 'cup' }); }],
    ['shop-donuts', 'Ring Donuts', 'shop', 8, function () { return B.shop({ w: 6, d: 5, h: 3.8, c: 0xd87a9a, aw: 0xfff2f2, sign: 0xff80a0, prop: 'donut' }); }],
    ['shop-gelato', 'Beach Gelato', 'shop', 8, function () { return B.shop({ w: 6, d: 5, h: 3.8, c: 0x7ac8a8, aw: 0xfff2c0, sign: 0x40e0a0, prop: 'cone' }); }],
    ['shop-tacos', 'Sol Tacos', 'shop', 8, function () { return B.shop({ w: 6, d: 5, h: 3.8, c: 0xe8a020, aw: 0xc02020, sign: 0xffd020, prop: 'taco' }); }],
    ['auto-gallery', 'St. Marina Auto Gallery', 'civic', 14, function () { return B.civic({ w: 12, d: 9, h: 6, c: 0x9aa2a8, fl: 2, co: 6 }); }],
    ['ricos-garage', "Rico's Garage", 'civic', 12, function () { var g = B.civic({ w: 10, d: 8, h: 5, c: 0x7a6a58, fl: 1, co: 4, open: true }); H.put(g, H.cyl(.4, .4, .3, 0x0c0d0f, 3, 4.5, .2, 'z', 10), H.cyl(.4, .4, .3, 0x0c0d0f, 3.8, 4.5, .2, 'z', 10)); return g; }],
    ['armoury', 'Marina Armoury', 'civic', 12, function () { return B.civic({ w: 9, d: 7, h: 5, c: 0x4a4e54, fl: 2, co: 4 }); }],
    ['hospital', 'St. Marina Hospital', 'civic', 15, function () { return B.civic({ w: 13, d: 10, h: 9, c: 0xe8e8e4, fl: 4, co: 6, cross: true }); }],
    ['precinct', 'Bayview Precinct', 'civic', 14, function () { var g = B.civic({ w: 11, d: 9, h: 8, c: 0x3a4a6a, fl: 4, co: 5 }); H.put(g, H.cyl(.04, .04, 4.5, 0x888888, 5, 4.5, 5.5, 'z'), H.box(1.4, .06, .9, 0x2050a0, 5, 4.5, 7.2)); return g; }],
    ['fire-station', 'St. Marina Fire Station', 'civic', 13, function () { return B.civic({ w: 12, d: 9, h: 6, c: 0xc02020, fl: 2, co: 5, doors: true }); }],
    ['house-bungalow', 'Bungalow', 'house', 7, function () { return B.house({ w: 6, d: 5, h: 3.0, c: 0xd8c8a8, roof: 0x8a5a40 }); }],
    ['house-two', 'Two-Storey House', 'house', 8, function () { var g = B.house({ w: 6, d: 5, h: 5.2, c: 0xa8b8c8, roof: 0x4a5a6a }); return g; }],
    ['house-villa', 'Villa', 'house', 9, function () { return B.house({ w: 8, d: 6, h: 4.2, c: 0xe8dcc8, roof: 0xc07040 }); }],
    ['house-provisions', 'Marina Provisions', 'shop', 8, function () { return B.shop({ w: 7, d: 6, h: 4.6, c: 0x9a8a72, aw: 0x2a5a4a, sign: 0xd8c8a0 }); }],
    ['palmera-residences', 'Palmera Residences', 'estate', 14, function () { var g = B.tower({ w: 12, d: 9, h: 8, c: 0xc8b89a, fl: 3, co: 6 }); for (var f = 0; f < 3; f++) H.put(g, H.box(11, .8, .12, 0x8a7a68, 0, 4.9, 2.2 + f * 2.4)); return g; }],
    ['kiosk-hotdog', 'Bay Dogs', 'kiosk', 4, function () { return B.kiosk({ c: 0xd8b040, roof: 0xc02020, sign: 0xffd020 }); }],
    ['kiosk-donut', 'Donut Pod', 'kiosk', 4, function () { return B.kiosk({ c: 0xd87a9a, roof: 0xfff2f2, sign: 0xff80a0 }); }],
    ['kiosk-drinks', 'Fizz Drinks', 'kiosk', 4, function () { return B.kiosk({ c: 0x40a8c8, roof: 0x20242c, sign: 0x40d8ff }); }],
    ['vending-cola', 'Marina Cola', 'vending', 3, function () { var g = H.grp(); H.put(g, H.box(1.0, .8, 1.9, 0xc02020, 0, 0, .95), B.sbox(.8, .06, 1.2, 0xfff2f2, 0xff4040, 0, .42, 1.1)); return g; }],
    ['vending-snack', 'Snack Pod', 'vending', 3, function () { var g = H.grp(); H.put(g, H.box(1.0, .8, 1.9, 0x2a7a4a, 0, 0, .95), B.sbox(.8, .06, 1.2, 0xfff2c0, 0xffd020, 0, .42, 1.1)); return g; }],
    ['skyport', 'St. Marina Skyport', 'airport', 18, function () { var g = B.civic({ w: 14, d: 10, h: 7, c: 0xb8bcc0, fl: 2, co: 7 }); H.put(g, H.box(20, 4, .14, 0x2e2e32, 0, -8, .07), H.box(1.2, 1.2, 9, 0x8a8d90, 8, 6, 4.5), H.box(2.4, 2.4, 1.2, 0x5a7a8a, 8, 6, 9.4)); return g; }],
    ['fort-marina', 'Fort Marina', 'military', 14, function () { var g = H.grp(); H.put(g, H.box(14, .5, 2.2, 0x8a8578, 0, 7, 1.1), H.box(14, .5, 2.2, 0x8a8578, 0, -7, 1.1), H.box(.5, 14, 2.2, 0x8a8578, 7, 0, 1.1), H.box(.5, 14, 2.2, 0x8a8578, -7, 0, 1.1)); H.put(g, B.tower({ w: 5, d: 5, h: 6, c: 0x6a6e5a, fl: 2, co: 3 }), H.cyl(.04, .04, 5, 0x888888, -5, -5, 4.5, 'z'), H.box(1.6, .06, 1.0, 0xc02020, -5, -5, 6.4)); return g; }],
    ['diorama', 'St. Marina Diorama', 'diorama', 22, function () {
      var g = H.grp(), r = H.rng(7), cols = [0x5a7a8a, 0xc8a060, 0x8a5a40, 0xb8a890, 0x3a4a6a];
      H.put(g, H.box(20, 20, .5, 0x9a938a, 0, 0, .25), H.box(20, 2, .06, 0x2e2e32, 0, 0, .53), H.box(2, 20, .06, 0x2e2e32, 0, 0, .53));
      for (var i = 0; i < 8; i++) {
        var w = 2 + r() * 2, h = 2 + r() * 6, x = -8 + (i % 4) * 5.2, y = -6 + Math.floor(i / 4) * 11;
        H.put(g, H.box(w, w, h, cols[i % 5], x, y, .5 + h / 2));
      }
      H.put(g, B.palm(-8, 8, 1), B.palm(8, -8, 1));
      return g;
    }]
  ];
  T.forEach(function (b) {
    N.reg('b', b[0], { name: b[1], cls: b[2], size: b[3], build: b[4] });
  });
  // One composed city block: road + towers + shops + palms (seeded variation).
  N.cityBlock = function (seed) {
    var g = H.grp(), r = H.rng(seed || 1);
    var road = B.road('road'); road.position.y = -6; g.add(road);
    var t1 = N.spawn('tower-glass'); t1.position.set(-6, 2, 0); t1.rotation.z = (r() - .5) * .1; g.add(t1);
    var t2 = N.spawn('tower-market'); t2.position.set(6, 3, 0); t2.scale.setScalar(.9 + r() * .2); g.add(t2);
    var s1 = N.spawn('shop-burgers'); s1.position.set(-6, -2.5, 0); g.add(s1);
    var s2 = N.spawn('shop-coffee'); s2.position.set(6, -2.5, 0); g.add(s2);
    g.add(B.palm(-9, -4, 1)); g.add(B.palm(9, -4, 1));
    return g;
  };
})();
