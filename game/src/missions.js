// The story: five chained jobs from fixer Marla Vane and her crew. Each mission is a
// list of steps — go somewhere, steal a car, pick something up, take out the gang,
// hold a spot, escape the heat — and the marker on the map and the HUD always point
// at the current step. Finishing pays cash and unlocks the next job.
import { MISSIONS } from './config.js';
import { blockRect, landmarkPoint } from './city.js';
import { makeGang, makePickup } from './entities.js';
import { addHeat } from './police.js';

function stepPoint(world, step) {
  if (step.x === undefined) return null;
  // Steps are written in block coordinates; turn them into world pixels.
  if (step.type === 'escape' && step.x === 6.5 && step.y === 8.4) return landmarkPoint('harbor');
  const bx = step.x;
  const by = step.y;
  const fx = bx - Math.floor(bx);
  const fy = by - Math.floor(by);
  const r = blockRect(Math.floor(bx), Math.floor(by));
  return { x: r.x + r.w * (fx || 0.5), y: r.y + r.h * (fy || 0.5) };
}

export function createMissions(save) {
  return {
    index: Math.min(save.missionIndex, MISSIONS.length - 1),
    step: 0,
    holdT: 0,
    done: save.storyDone,
    active: null, // the live step, resolved to a world point
    banner: null,
  };
}

export function currentMission(missions) {
  if (missions.done) return null;
  return MISSIONS[missions.index] ?? null;
}

export function currentStep(missions) {
  const m = currentMission(missions);
  if (!m) return null;
  return m.steps[missions.step] ?? null;
}

/** World point of the live step, resolved once when the step starts. */
export function resolveStep(world, step) {
  if (!step) return null;
  if (step.type === 'steal') {
    // The red Sunbeam GT by Civic Plaza is the only car that counts.
    const gt = world.entities.cars.find((c) => c.model === 'Sunbeam GT');
    return gt ? { x: gt.x, y: gt.y, car: gt } : null;
  }
  if (step.type === 'eliminate') {
    const p = stepPoint(world, step);
    return p ? { ...p, count: step.count } : null;
  }
  const p = stepPoint(world, step);
  return p;
}

function startStep(world, step) {
  const m = world.missions;
  m.active = resolveStep(world, step);
  m.holdT = 0;
  if (!m.active) return;
  if (step.type === 'escape' && step.wanted) {
    const p = world.entities.player;
    p.wanted = Math.max(p.wanted, step.wanted);
    p.heat = Math.max(p.heat, step.wanted * 20);
    world.say(`WANTED LEVEL ${step.wanted} — lose the cops!`, '#ff6b6b');
    world.sfx('siren');
  }
  if (step.type === 'eliminate') {
    // The Harbormen take their posts at Warehouse Row.
    const { random } = world;
    const base = stepPoint(world, step);
    for (let i = 0; i < step.count; i += 1) {
      const g = makeGang(base.x + (random() - 0.5) * 160, base.y + (random() - 0.5) * 120, random);
      world.entities.gang.push(g);
    }
    world.say('Harbormen ahead — take them all out.', '#ffb347');
  }
  if (step.type === 'pickup') {
    world.entities.pickups.push(makePickup(m.active.x, m.active.y, 'package'));
  }
}

export function beginMission(world, index) {
  const m = world.missions;
  m.index = index;
  m.step = 0;
  m.done = false;
  const mission = MISSIONS[index];
  m.banner = { title: mission.title, sub: `New job from ${mission.fixer}`, t: 4 };
  world.say(`${mission.title}: ${mission.brief}`, '#ffd319', 8);
  world.sfx('mission');
  startStep(world, mission.steps[0]);
}

export function advanceMission(world) {
  const m = world.missions;
  const mission = currentMission(m);
  if (!mission) return;
  m.step += 1;
  if (m.step >= mission.steps.length) {
    // Job done: pay, save, and open the next one.
    const p = world.entities.player;
    p.cash += mission.reward;
    world.save.cash = p.cash;
    world.save.missionsDone += 1;
    world.save.missionIndex = Math.min(m.index + 1, MISSIONS.length - 1);
    world.save.bestCash = Math.max(world.save.bestCash, p.cash);
    world.persist();
    m.banner = { title: 'MISSION PASSED', sub: `+$${mission.reward} — ${mission.title}`, t: 4 };
    world.say(`Mission passed! +$${mission.reward}`, '#4ade80', 6);
    world.sfx('pass');
    if (m.index + 1 >= MISSIONS.length) {
      m.done = true;
      world.save.storyDone = true;
      world.persist();
      m.banner = { title: 'THE BIG SCORE — DONE', sub: 'Port Meridian is yours, Rook.', t: 6 };
      world.say('Story complete! You can keep playing the city.', '#4ade80', 8);
    } else {
      m.index += 1;
      m.step = 0;
      const next = MISSIONS[m.index];
      m.banner = { title: next.title, sub: `Next job from ${next.fixer}`, t: 4 };
      world.say(`${next.title}: ${next.brief}`, '#ffd319', 8);
      startStep(world, next.steps[0]);
    }
    return;
  }
  const step = mission.steps[m.step];
  world.say(step.label, '#ffd319', 6);
  startStep(world, step);
}

function near(world, point, radius) {
  const p = world.entities.player;
  const x = p.car ? p.car.x : p.x;
  const y = p.car ? p.car.y : p.y;
  return Math.hypot(point.x - x, point.y - y) < radius;
}

export function stepMissions(world, dt) {
  const m = world.missions;
  if (m.done) return;
  const mission = currentMission(m);
  const step = currentStep(m);
  if (!mission || !step || !m.active) return;
  const p = world.entities.player;
  if (p.dead) return;

  if (step.type === 'goto' || step.type === 'deliver') {
    if (near(world, m.active, step.radius)) advanceMission(world);
  } else if (step.type === 'pickup') {
    if (step.onFoot && p.car) return; // this one is on foot
    if (near(world, m.active, step.radius)) advanceMission(world);
  } else if (step.type === 'steal') {
    // Complete when the player is driving the Sunbeam GT.
    if (p.car && p.car.model === 'Sunbeam GT') {
      addHeat(world, 1, 'car stolen in front of witnesses');
      advanceMission(world);
    }
  } else if (step.type === 'eliminate') {
    const left = world.entities.gang.filter((g) => g.alive).length;
    if (left === 0) advanceMission(world);
  } else if (step.type === 'hold') {
    if (near(world, m.active, step.radius)) {
      m.holdT += dt;
      if (m.holdT >= step.hold) advanceMission(world);
    } else {
      m.holdT = 0;
    }
  } else if (step.type === 'escape') {
    if (p.wanted === 0 && near(world, m.active, step.radius)) advanceMission(world);
  }
}
