// Combat on foot and from the car: punches, the pistol, bullets in flight, and what
// they hit — pedestrians, gang members, police, cars, and the player. Ramming is the
// car's own weapon, handled where cars move.
import { CAR, PISTOL, PLAYER } from './config.js';
import { resolveBuildings } from './city.js';
import { spawnBurst } from './particles.js';
import { addHeat } from './police.js';

function hitCircle(x, y, cx, cy, r) {
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r;
}

export function firePistol(world) {
  const p = world.entities.player;
  if (p.car || p.ammo <= 0 || p.shootCd > 0 || p.dead) return false;
  p.ammo -= 1;
  p.shootCd = PISTOL.cooldown;
  const a = p.angle + (world.random() - 0.5) * PISTOL.spread;
  world.entities.bullets.push({
    x: p.x + Math.cos(a) * 18,
    y: p.y + Math.sin(a) * 18,
    vx: Math.cos(a) * 900,
    vy: Math.sin(a) * 900,
    life: PISTOL.range / 900,
    from: 'player',
  });
  spawnBurst(world.particles, p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, 4, ['#ffd319', '#ff9d00'], 160, 0.12, 3);
  world.sfx('shot');
  world.alarm = 1.2;
  world.alarmX = p.x;
  world.alarmY = p.y;
  addHeat(world, 0.5, 'shots fired');
  return true;
}

export function punch(world) {
  const p = world.entities.player;
  if (p.car || p.punchCd > 0 || p.dead) return false;
  p.punchCd = PLAYER.punchCooldown;
  const ax = p.x + Math.cos(p.angle) * 26;
  const ay = p.y + Math.sin(p.angle) * 26;
  let hit = false;
  for (const ped of world.entities.peds) {
    if (ped.state === 'down') continue;
    if (hitCircle(ax, ay, ped.x, ped.y, PLAYER.punchRange)) {
      ped.state = 'down';
      ped.panic = 0;
      spawnBurst(world.particles, ped.x, ped.y, 6, ['#ffd319', '#ffffff'], 140, 0.3, 3);
      addHeat(world, 0.5, 'assault');
      hit = true;
    }
  }
  for (const g of world.entities.gang) {
    if (!g.alive) continue;
    if (hitCircle(ax, ay, g.x, g.y, PLAYER.punchRange)) {
      g.hp -= PLAYER.punchDamage;
      spawnBurst(world.particles, g.x, g.y, 6, ['#ff6b6b', '#ffffff'], 160, 0.3, 3);
      if (g.hp <= 0) killGang(world, g);
      hit = true;
    }
  }
  for (const cop of world.entities.cops) {
    if (hitCircle(ax, ay, cop.x, cop.y, PLAYER.punchRange)) {
      addHeat(world, 1, 'attacked an officer');
      world.sfx('punch');
      hit = true;
    }
  }
  if (hit) world.sfx('punch');
  return hit;
}

export function killGang(world, g) {
  g.alive = false;
  world.entities.player.cash += 25;
  world.save.kills += 1;
  world.save.cash = world.entities.player.cash;
  world.persist();
  spawnBurst(world.particles, g.x, g.y, 14, ['#ff6b6b', '#ffd319', '#ffffff'], 220, 0.5, 4);
  world.sfx('down');
  world.say('Harborman down. +$25', '#ffb347');
}

export function hurtPlayer(world, amount, source) {
  const p = world.entities.player;
  if (p.dead || p.hurtCd > 0) return;
  p.hp -= amount;
  p.hurtCd = 0.5;
  world.bump(4);
  world.sfx('hurt');
  if (p.hp <= 0) {
    p.hp = 0;
    world.waste(source);
  }
}

function stepBullet(world, b, dt) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.life -= dt;
  if (b.life <= 0) return false;
  if (resolveBuildings(world.city, { x: b.x, y: b.y }, 2)) {
    spawnBurst(world.particles, b.x, b.y, 5, ['#c9c9c9', '#ffd319'], 120, 0.2, 2);
    return false;
  }
  const p = world.entities.player;
  if (b.from !== 'player' && !p.car && !p.dead && hitCircle(b.x, b.y, p.x, p.y, 13)) {
    hurtPlayer(world, 12, 'shot');
    return false;
  }
  if (b.from === 'player') {
    for (const g of world.entities.gang) {
      if (!g.alive) continue;
      if (hitCircle(b.x, b.y, g.x, g.y, 14)) {
        g.hp -= PISTOL.damage;
        spawnBurst(world.particles, b.x, b.y, 6, ['#ff6b6b', '#ffffff'], 150, 0.25, 3);
        if (g.hp <= 0) killGang(world, g);
        return false;
      }
    }
    for (const ped of world.entities.peds) {
      if (ped.state === 'down') continue;
      if (hitCircle(b.x, b.y, ped.x, ped.y, 12)) {
        ped.state = 'down';
        addHeat(world, 1, 'pedestrian shot');
        spawnBurst(world.particles, b.x, b.y, 8, ['#ff6b6b', '#ffffff'], 160, 0.3, 3);
        return false;
      }
    }
    for (const car of world.entities.cars) {
      if (car.kind === 'player' && p.car === car) continue;
      if (hitCircle(b.x, b.y, car.x, car.y, 20)) {
        car.hp -= PISTOL.damage;
        spawnBurst(world.particles, b.x, b.y, 6, ['#ffd319', '#c9c9c9'], 170, 0.25, 3);
        if (car.kind === 'police') addHeat(world, 1, 'shot at police');
        if (car.hp <= 0) {
          car.kind = 'parked';
          car.speed = 0;
          spawnBurst(world.particles, car.x, car.y, 20, ['#ff6b6b', '#ffd319', '#888888'], 260, 0.7, 5);
          world.sfx('crash');
        }
        return false;
      }
    }
    for (const cop of world.entities.cops) {
      if (hitCircle(b.x, b.y, cop.x, cop.y, 12)) {
        addHeat(world, 1, 'officer shot');
        spawnBurst(world.particles, b.x, b.y, 8, ['#2f6fed', '#ffffff'], 160, 0.3, 3);
        return false;
      }
    }
  } else {
    for (const car of world.entities.cars) {
      if (car.kind !== 'police') continue;
      if (hitCircle(b.x, b.y, car.x, car.y, 20)) {
        car.hp -= 10;
        return false;
      }
    }
  }
  return true;
}

export function stepBullets(world, dt) {
  const list = world.entities.bullets;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (!stepBullet(world, list[i], dt)) list.splice(i, 1);
  }
  // Gang members fire back when the player is close and on foot.
  const p = world.entities.player;
  for (const g of world.entities.gang) {
    if (!g.alive || p.dead) continue;
    g.cooldown -= dt;
    const d = Math.hypot(p.x - g.x, p.y - g.y);
    if (d < 380 && g.cooldown <= 0) {
      g.cooldown = 1.1 + world.random() * 0.7;
      const a = Math.atan2(p.y - g.y, p.x - g.x) + (world.random() - 0.5) * 0.12;
      world.entities.bullets.push({
        x: g.x + Math.cos(a) * 18,
        y: g.y + Math.sin(a) * 18,
        vx: Math.cos(a) * 760,
        vy: Math.sin(a) * 760,
        life: 0.6,
        from: 'gang',
      });
      spawnBurst(world.particles, g.x + Math.cos(a) * 22, g.y + Math.sin(a) * 22, 3, ['#ff9d00', '#ff6b6b'], 140, 0.1, 3);
      world.sfx('shotFar');
    }
  }
}

/** Pickups: health, ammo, cash and the mission package. */
export function stepPickups(world, dt) {
  const p = world.entities.player;
  if (p.dead) return;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const list = world.entities.pickups;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const pk = list[i];
    pk.bob += dt * 4;
    if (Math.hypot(pk.x - px, pk.y - py) > 34) continue;
    if (pk.kind === 'health') {
      if (p.hp >= 100) continue;
      p.hp = Math.min(100, p.hp + 40);
      world.say('Health +40', '#4ade80');
    } else if (pk.kind === 'ammo') {
      if (p.ammo >= PISTOL.maxAmmo) continue;
      p.ammo = Math.min(PISTOL.maxAmmo, p.ammo + 12);
      world.say('Ammo +12', '#ffd319');
    } else if (pk.kind === 'cash') {
      p.cash += 50;
      world.save.cash = p.cash;
      world.persist();
      world.say('Found $50', '#4ade80');
    } else if (pk.kind === 'package') {
      world.say('Package secured.', '#ffd319');
    }
    world.sfx('pickup');
    list.splice(i, 1);
  }
}
