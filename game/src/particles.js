// NEON BAY — particles, skid marks and screen shake.
// Small, cheap, and pooled by capping the list: sparks, smoke, muzzle
// flashes, pickup sparkles and exhaust puffs. Nothing here allocates a
// canvas; the renderer draws each particle as a fading square or circle.

export function spawnParticles(state, x, y, count, color, speed) {
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length > 400) return;
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    state.particles.push({
      x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
      life: 0.4 + Math.random() * 0.5, maxLife: 0.9, size: 2 + Math.random() * 4,
      color, gravity: 0,
    });
  }
}

export function spawnExhaust(state, x, y, angle) {
  if (state.particles.length > 400) return;
  state.particles.push({
    x, y, vx: Math.cos(angle) * 30 + (Math.random() - 0.5) * 20,
    vy: Math.sin(angle) * 30 + (Math.random() - 0.5) * 20,
    life: 0.5, maxLife: 0.5, size: 5, color: '#5a5f6a', gravity: 0,
  });
}

export function updateParticles(state, dt) {
  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2 * dt;
    p.vy *= 1 - 2 * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

/** Ease the screen shake back to zero; call once per frame. */
export function updateShake(state, dt) {
  state.camera.shake = Math.max(0, state.camera.shake - dt * 26);
}
