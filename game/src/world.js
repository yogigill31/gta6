// The world: one object holding the city, the actors, the story and the clock, and
// the single step() that advances all of it. The player drives or walks here; the
// other modules own the details (traffic, police, missions, combat). Hooks for
// sound and saving are injected so this file never touches the browser directly.
import { CAR, CITY_H, CITY_W, PISTOL, PLAYER } from './config.js';
import { createCity, hitsBuilding, resolveBuildings } from './city.js';
import { createEntities } from './entities.js';
import { createMissions, stepMissions, beginMission } from './missions.js';
import { createParticles, addShake, spawnBurst, spawnSmoke, stepParticles } from './particles.js';
import { stepTraffic, stepPeds } from './traffic.js';
import { addHeat, stepPolice } from './police.js';
import { firePistol, punch, stepBullets, stepPickups } from './combat.js';
import { ACTION_ENTER, ACTION_PUNCH } from './input.js';

export function createWorld(random, save, hooks) {
  const world = {
    random,
    save,
    hooks,
    time: 0,
    clock: 15.0, // afternoon sun over Port Meridian; dusk and night arrive as you play
    screen: 'title',
    city: null,
    entities: null,
    missions: null,
    particles: createParticles(random),
    messages: [],
    banner: null,
    alarm: 0,
    alarmX: 0,
    alarmY: 0,
    lastRam: 0,
    lastSpawn: 0,
    lastCopSpawn: 0,
    endKind: null,
  };
  world.city = createCity(random);
  world.entities = createEntities(world);
  world.missions = createMissions(save);

  world.say = (text, color = '#f2ede4', secs = 4) => {
    world.messages.push({ text, color, t: secs });
    if (world.messages.length > 5) world.messages.shift();
  };
  world.sfx = (name) => hooks.sfx(name);
  world.bump = (amount) => addShake(world.particles, amount);
  world.persist = () => hooks.persist(world.save);

  world.bust = () => {
    const p = world.entities.player;
    if (p.dead) return;
    p.dead = true;
    p.deadKind = 'busted';
    world.endKind = 'busted';
    p.wanted = 0;
    p.heat = 0;
    p.cash = Math.max(0, p.cash - 100);
    world.save.cash = p.cash;
    world.save.busted += 1;
    world.persist();
    world.entities.policeCars.length = 0;
    world.entities.cops.length = 0;
    world.sfx('busted');
  };
  world.waste = (source) => {
    const p = world.entities.player;
    if (p.dead) return;
    p.dead = true;
    p.deadKind = 'wasted';
    world.endKind = 'wasted';
    p.wanted = 0;
    p.heat = 0;
    p.cash = Math.max(0, p.cash - 150);
    world.save.cash = p.cash;
    world.save.wasted += 1;
    world.persist();
    world.entities.policeCars.length = 0;
    world.entities.cops.length = 0;
    world.sfx('busted');
    void source;
  };
  world.respawn = () => {
    const p = world.entities.player;
    // Back on the road south of St. Anselm Hospital, patched up and free.
    const spot = { x: 852, y: 1668 };
    p.x = spot.x;
    p.y = spot.y;
    p.angle = -Math.PI / 2;
    p.hp = PLAYER.hp;
    p.ammo = Math.max(p.ammo, 6);
    p.car = null;
    p.dead = false;
    p.deadKind = null;
    p.wanted = 0;
    p.heat = 0;
    p.unseen = 0;
    world.endKind = null;
    world.say('Back on the streets. Stay sharp, Rook.', '#9ad1ff');
  };

  world.enterExitCar = () => {
    const p = world.entities.player;
    if (p.dead) return;
    if (p.car) {
      const car = p.car;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      p.angle = car.angle;
      p.car = null;
      car.kind = 'parked';
      car.driver = false;
      car.speed = 0;
      world.sfx('enter');
      return;
    }
    let best = null;
    let bestD = 52;
    for (const car of world.entities.cars) {
      if (car.kind === 'player') continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    for (const car of world.entities.policeCars) {
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return;
    if (best.kind === 'traffic') addHeat(world, 1, 'car stolen');
    if (best.kind === 'police') addHeat(world, 2, 'police car stolen');
    if (best.kind === 'traffic' || best.kind === 'police') world.save.carsStolen += 1;
    best.kind = 'player';
    best.driver = true;
    p.car = best;
    p.x = best.x;
    p.y = best.y;
    world.sfx('enter');
  };

  function driveCar(car, input, dt) {
    const move = input.move();
    const handbrake = input.shootHeld();
    if (move.y < 0) car.speed += CAR.accel * dt;
    else if (move.y > 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.5) * dt;
    else car.speed -= car.speed * 0.9 * dt;
    if (handbrake) car.speed -= car.speed * 2.6 * dt;
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steer = move.x * CAR.turn * Math.min(1, Math.abs(car.speed) / 120) * (car.speed < 0 ? -1 : 1);
    car.angle += steer * dt * (handbrake ? 1.7 : 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const before = { x: car.x, y: car.y };
    car.x = nx;
    car.y = ny;
    if (resolveBuildings(world.city, car, CAR.radius)) {
      const impact = Math.abs(car.speed);
      car.speed *= 0.35;
      if (impact > 180) {
        car.hp -= Math.min(15, (impact - 180) * 0.08);
        world.bump(Math.min(9, impact / 60));
        spawnBurst(world.particles, car.x, car.y, 8, ['#ffd319', '#c9c9c9'], 200, 0.3, 3);
        world.sfx('crash');
      }
    }
    car.x = Math.max(24, Math.min(CITY_W - 24, car.x));
    car.y = Math.max(24, Math.min(CITY_H, car.y)); // cars stop at the city's edge; the harbour boat is reached on foot
    void before;
    if (handbrake && Math.abs(car.speed) > 120 && world.random() < 0.6) {
      spawnSmoke(world.particles, car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18);
    }
    if (car.hp < 50 && world.random() < 0.25) spawnSmoke(world.particles, car.x, car.y - 8);
    if (car.hp <= 0) {
      spawnBurst(world.particles, car.x, car.y, 26, ['#ff6b6b', '#ffd319', '#888888'], 300, 0.8, 5);
      world.sfx('crash');
      world.bump(10);
      car.hp = CAR.hp;
      car.speed = 0;
      car.kind = 'parked';
      car.driver = false;
      const p = world.entities.player;
      p.car = null;
      p.x = car.x + 40;
      p.y = car.y;
      resolveBuildings(world.city, p, PLAYER.radius); // never eject the player inside a wall
      p.hp = Math.max(20, p.hp - 25);
      world.say('Your ride is wrecked!', '#ff6b6b');
    }
  }

  function carCollisions(dt) {
    const p = world.entities.player;
    if (!p.car) return;
    const car = p.car;
    for (const other of world.entities.cars) {
      if (other === car || other.kind === 'player') continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d > 42 || d === 0) continue;
      const push = (42 - d) / 2;
      const nx = (other.x - car.x) / d;
      const ny = (other.y - car.y) / d;
      other.x += nx * push;
      other.y += ny * push;
      car.x -= nx * push;
      car.y -= ny * push;
      const impact = Math.abs(car.speed - other.speed);
      if (impact > 90) {
        car.hp -= impact * 0.05;
        other.hp -= impact * 0.08;
        spawnBurst(world.particles, (car.x + other.x) / 2, (car.y + other.y) / 2, 8, ['#ffd319', '#ffffff'], 200, 0.3, 3);
        world.bump(Math.min(8, impact / 50));
        world.sfx('crash');
        if (other.kind === 'traffic') addHeat(world, 0.5, 'hit and run');
        if (other.kind === 'police') addHeat(world, 1, 'rammed a police car');
      }
      other.speed *= 0.6;
    }
    for (const ped of world.entities.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 30 && Math.abs(car.speed) > 60) {
        ped.state = 'down';
        addHeat(world, 1, 'pedestrian hit');
        spawnBurst(world.particles, ped.x, ped.y, 8, ['#ffd319', '#ffffff'], 180, 0.35, 3);
        world.bump(4);
        world.sfx('crash');
      }
    }
  }

  function stepPlayer(input, actions, dt) {
    const p = world.entities.player;
    if (p.dead) return;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.shootCd = Math.max(0, p.shootCd - dt);
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    if (actions & ACTION_ENTER) world.enterExitCar();
    if (p.car) {
      driveCar(p.car, input, dt);
      carCollisions(dt);
      return;
    }
    const move = input.move();
    const len = Math.hypot(move.x, move.y);
    if (len > 0) {
      const sprint = input.sprintHeld();
      const speed = sprint ? PLAYER.sprint : PLAYER.walk;
      p.angle = Math.atan2(move.y / len, move.x / len);
      // Move one axis at a time so the player slides along walls instead of
      // wedging into a building corner.
      p.x += (move.x / len) * speed * dt;
      resolveBuildings(world.city, p, PLAYER.radius);
      p.y += (move.y / len) * speed * dt;
      resolveBuildings(world.city, p, PLAYER.radius);
      p.x = Math.max(24, Math.min(CITY_W - 24, p.x));
      p.y = Math.max(24, Math.min(CITY_H + 60, p.y));
    }
    // On-foot collision with parked and traffic cars: they are solid.
    for (const car of world.entities.cars) {
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < 30 && d > 0.01) {
        p.x = car.x + ((p.x - car.x) / d) * 30;
        p.y = car.y + ((p.y - car.y) / d) * 30;
      }
    }
    if (actions & ACTION_PUNCH) punch(world);
    if (input.shootHeld()) firePistol(world);
  }

  world.step = (input, actions, dt) => {
    world.time += dt;
    world.clock = (15 + world.time / 30) % 24;
    if (world.banner) {
      world.banner.t -= dt;
      if (world.banner.t <= 0) world.banner = null;
    }
    for (let i = world.messages.length - 1; i >= 0; i -= 1) {
      world.messages[i].t -= dt;
      if (world.messages[i].t <= 0) world.messages.splice(i, 1);
    }
    world.alarm = Math.max(0, world.alarm - dt);
    stepPlayer(input, actions, dt);
    stepTraffic(world, dt);
    stepPeds(world, dt);
    stepPolice(world, dt);
    stepMissions(world, dt);
    stepBullets(world, dt);
    stepPickups(world, dt);
    stepParticles(world.particles, dt);
    // The player's own car follows the same traffic light of being a car.
    const p = world.entities.player;
    if (p.car) {
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
    }
  };

  return world;
}

/** Start the story's first job the moment a new game begins. */
export function startStory(world) {
  beginMission(world, world.missions.index);
}
