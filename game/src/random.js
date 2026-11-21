// Neon Bay — deterministic seeded random numbers.
// A small xorshift generator so the city, traffic and missions
// are identical for a given seed, but differ across seeds.

export function makeRng(seedValue) {
  let s = (seedValue >>> 0) || 0x9e3779b9;
  if (s === 0) s = 0x2545f491;
  function next() {
    s ^= (s << 13) >>> 0;
    s ^= s >>> 17;
    s ^= (s << 5) >>> 0;
    s >>>= 0;
    return s / 4294967296;
  }
  function range(lo, hi) {
    return lo + next() * (hi - lo);
  }
  function whole(lo, hi) {
    return Math.floor(range(lo, hi + 1));
  }
  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }
  function chance(p) {
    return next() < p;
  }
  function sign() {
    return next() < 0.5 ? -1 : 1;
  }
  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }
  return { next, range, whole, pick, chance, sign, shuffle };
}

// FNV-1a hash of a short string into an unsigned 32-bit seed.
export function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
// Round 9: NEON BAY design pack integration point (see src/designs.js).
if (typeof window !== 'undefined') { (window.__NEON_POINTS__ = window.__NEON_POINTS__ || []).push('random.js'); }
