// Particles and screen shake: sparks on impact, smoke from wrecked cars, muzzle
// flashes, tire smoke on the handbrake, and the camera kick when something hits hard.
// Every random choice comes from the world's seeded generator, so the same seed
// renders the same frame — screenshots included.
export function createParticles(random) {
  return { list: [], shake: 0, rng: random ?? Math.random };
}

export function spawnBurst(particles, x, y, count, colors, speed, life, size) {
  const rng = particles.rng;
  for (let i = 0; i < count; i += 1) {
    const a = rng() * Math.PI * 2;
    const v = speed * (0.3 + rng() * 0.7);
    particles.list.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.5 + rng() * 0.5),
      maxLife: life,
      size: size * (0.6 + rng() * 0.8),
      color: colors[(rng() * colors.length) | 0],
    });
  }
}

export function spawnSmoke(particles, x, y) {
  const rng = particles.rng;
  particles.list.push({
    x: x + (rng() - 0.5) * 14,
    y: y + (rng() - 0.5) * 14,
    vx: (rng() - 0.5) * 12,
    vy: -18 - rng() * 20,
    life: 0.9 + rng() * 0.6,
    maxLife: 1.5,
    size: 7 + rng() * 7,
    color: 'rgba(120,120,120,0.5)',
  });
}

export function addShake(particles, amount) {
  particles.shake = Math.min(16, particles.shake + amount);
}

export function stepParticles(particles, dt) {
  const list = particles.list;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.4 * dt;
    p.vy *= 1 - 2.4 * dt;
  }
  particles.shake = Math.max(0, particles.shake - 34 * dt);
}

/** Current camera kick, in pixels, from the shake that is still ringing. */
export function shakeOffset(particles) {
  const s = particles.shake;
  if (s <= 0.1) return { x: 0, y: 0 };
  const rng = particles.rng;
  return { x: (rng() - 0.5) * s, y: (rng() - 0.5) * s };
}
