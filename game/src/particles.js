const MAX = 400;
const rnd = Math.random;

export function spawnParticles(state, x, y, count, color, speed) {
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length > MAX) return;
    const a = rnd() * Math.PI * 2;
    const v = speed * (0.3 + rnd() * 0.7);
    state.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      z: 4 + rnd() * 10, vz: 30 + rnd() * 90,
      life: 0.4 + rnd() * 0.5, maxLife: 0.9, size: 2 + rnd() * 4, color, gravity: 0,
    });
  }
}

export function spawnExhaust(state, x, y, angle) {
  if (state.particles.length > MAX) return;
  state.particles.push({
    x, y, vx: Math.cos(angle) * 30 + (rnd() - 0.5) * 20,
    vy: Math.sin(angle) * 30 + (rnd() - 0.5) * 20,
    z: 6, vz: 10, life: 0.5, maxLife: 0.5, size: 5, color: '#5a5f6a', gravity: 0,
  });
}

export function updateParticles(state, dt) {
  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 1 - 2 * dt; p.vy *= 1 - 2 * dt;
    p.vz -= 60 * dt; p.z += p.vz * dt; // gravity pulls the rise back down
    if (p.z < 0) { p.z = 0; p.vz = 0; }
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

export function updateShake(state, dt) {
  state.camera.shake = Math.max(0, state.camera.shake - dt * 26);
}
