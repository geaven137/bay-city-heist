// Neon Bay — sparks, smoke and debris.
// Pure data: each particle is a point with velocity and a life.
// The renderer draws them; the logic here only moves and ages them.

export function burst(state, x, y, z, count, color, speed) {
  const list = state.particles;
  for (let i = 0; i < count; i++) {
    const a = state.rng.next() * Math.PI * 2;
    const up = state.rng.range(0.3, 1);
    const v = speed * state.rng.range(0.4, 1);
    list.push({
      x, y, z,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      vz: up * v * 0.7,
      life: state.rng.range(0.35, 0.8),
      max: 0.8,
      color,
      size: state.rng.range(2, 5),
    });
  }
  if (list.length > 420) list.splice(0, list.length - 420);
}

export function stepParticles(state, dt) {
  const list = state.particles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vz -= 260 * dt;
    if (p.z < 0) {
      p.z = 0;
      p.vz = 0;
    }
    p.vx *= 1 - 1.6 * dt;
    p.vy *= 1 - 1.6 * dt;
  }
}

export function clearParticles(state) {
  state.particles.length = 0;
}
// Round 9: NEON BAY design pack integration point (see src/designs.js).
if (typeof window !== 'undefined') { (window.__NEON_POINTS__ = window.__NEON_POINTS__ || []).push('particles.js'); }
