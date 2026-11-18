// The wanted system and the police who answer it. Crimes raise heat; heat becomes
// stars; stars decide how many police cars and foot cops hunt the player. Out of
// sight for long enough, the heat cools and stars fall one by one. Caught on foot
// means busted; out of health means wasted.
import { POLICE, WANTED } from './config.js';
import { resolveBuildings, roadX, roadY } from './city.js';
import { spawnCop, spawnPoliceCar } from './entities.js';

export function addHeat(world, amount, reason) {
  const p = world.entities.player;
  if (p.dead) return;
  p.heat = Math.min(100, p.heat + amount * 20);
  const stars = Math.min(WANTED.max, Math.max(p.wanted, Math.ceil(p.heat / 20)));
  if (stars > p.wanted) {
    p.wanted = stars;
    world.say(`WANTED LEVEL ${stars} — ${reason}`, '#ff6b6b');
  }
  p.unseen = 0;
}

/** How many police cars and foot cops the current wanted level calls for. */
export function policeQuota(wanted) {
  if (wanted <= 0) return { cars: 0, cops: 0 };
  if (wanted === 1) return { cars: 0, cops: 1 };
  if (wanted === 2) return { cars: 1, cops: 2 };
  if (wanted === 3) return { cars: 2, cops: 3 };
  if (wanted === 4) return { cars: 3, cops: 4 };
  return { cars: 4, cops: 5 };
}

function nearestPoliceDist(world) {
  const p = world.entities.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  let best = Infinity;
  for (const car of world.entities.policeCars) best = Math.min(best, Math.hypot(car.x - px, car.y - py));
  for (const cop of world.entities.cops) best = Math.min(best, Math.hypot(cop.x - px, cop.y - py));
  return best;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function stepPoliceCar(world, car, dt) {
  const p = world.entities.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  // Road-hugging pursuit: steer toward the player, but snap the heading to the
  // grid so the car follows streets instead of ploughing through blocks.
  const wantAngle = Math.atan2(dy, dx);
  const snapped = Math.round(wantAngle / (Math.PI / 2)) * (Math.PI / 2);
  const steer = dist < 90 ? wantAngle : snapped;
  car.angle = angleLerp(car.angle, steer, Math.min(1, 3.4 * dt));
  const targetSpeed = dist < 60 ? 120 : POLICE.chaseSpeed;
  car.speed += Math.max(-700 * dt, Math.min(520 * dt, targetSpeed - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.brakeLight = dist < 80;
  const pushed = resolveBuildings(world.city, car, 20);
  if (pushed) car.speed *= 0.6;
  // Ram the player's car on contact.
  if (p.car && dist < 44) {
    p.car.hp -= 12 * dt;
    p.car.speed *= 1 - 1.5 * dt;
    if (world.time - (world.lastRam || 0) > 0.5) {
      world.lastRam = world.time;
      world.bump(5);
      world.sfx('crash');
    }
  }
}

function stepCop(world, cop, dt) {
  const p = world.entities.player;
  if (p.dead) return;
  const dx = p.x - cop.x;
  const dy = p.y - cop.y;
  const dist = Math.hypot(dx, dy);
  cop.angle = Math.atan2(dy, dx);
  const speed = dist > 200 ? 165 : 145;
  cop.x += (dx / (dist || 1)) * speed * dt;
  cop.y += (dy / (dist || 1)) * speed * dt;
  resolveBuildings(world.city, cop, 10);
  // A cop who catches the player on foot arrests them.
  if (!p.car && dist < POLICE.arrestRange && p.wanted > 0) {
    world.bust();
  }
}

export function stepPolice(world, dt) {
  const p = world.entities.player;
  const quota = policeQuota(p.wanted);
  // Keep the force topped up, one spawn at a time so it never floods in.
  if (world.entities.policeCars.length < quota.cars && world.time - (world.lastSpawn || 0) > 2.5) {
    world.lastSpawn = world.time;
    spawnPoliceCar(world, p.car ?? p);
  }
  if (world.entities.cops.length < quota.cops && world.time - (world.lastCopSpawn || 0) > 3) {
    world.lastCopSpawn = world.time;
    spawnCop(world, p.car ?? p);
  }
  for (const car of world.entities.policeCars) stepPoliceCar(world, car, dt);
  for (const cop of world.entities.cops) stepCop(world, cop, dt);

  // Heat cools when no police can see the player; a star falls after a long lull.
  const nearest = nearestPoliceDist(world);
  if (p.wanted > 0) {
    if (nearest > POLICE.sight) {
      p.unseen += dt;
      if (p.unseen > WANTED.decayDelay) {
        p.unseen = 0;
        p.wanted -= 1;
        p.heat = Math.max(0, p.heat - 22);
        world.say(p.wanted === 0 ? 'You lost the heat.' : `Wanted down to ${p.wanted} star${p.wanted > 1 ? 's' : ''}.`, '#9ad1ff');
      }
    } else {
      p.unseen = 0;
    }
    // Passive heat bleed while the chase is on.
    p.heat = Math.max(p.wanted * 20 - 19, p.heat - 0.6 * dt);
  }
  // The force stands down when the wanted level clears.
  if (p.wanted === 0) {
    world.entities.policeCars.length = 0;
    world.entities.cops.length = 0;
  }
}
