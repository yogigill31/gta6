// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a scripted
// driver (walk to a car, enter it, follow road waypoints, flee the police), so the
// frame is what real play looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { landmarkPoint, roadX, roadY } from './city.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { beginMission } from './missions.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const CHASE_SECONDS = 20;
const MISSION_SECONDS = 2.5; // short: the player is still walking to the marker, beam in view

function scriptedInput() {
  let mx = 0;
  let my = 0;
  let shoot = false;
  return {
    setMove(x, y) { mx = x; my = y; },
    setShoot(v) { shoot = v; },
    move() { return { x: mx, y: my }; },
    shootHeld() { return shoot; },
    sprintHeld() { return false; },
  };
}

/** Steer the car toward (tx, ty); returns the distance left. */
function driveToward(input, car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.8));
  const dist = Math.hypot(tx - car.x, ty - car.y);
  input.setMove(steer, Math.abs(diff) > 1.4 ? 0 : -1);
  return dist;
}

/** Walk the player toward (tx, ty); returns the distance left. */
function walkToward(input, player, tx, ty) {
  const dx = tx - player.x;
  const dy = ty - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) { input.setMove(0, 0); return dist; }
  input.setMove(dx / dist, dy / dist);
  return dist;
}

function stepWorld(world, input, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(input, 0, STEP);
}

function stageStart(world) {
  const plaza = landmarkPoint('plaza', 0.5, 0.5);
  const p = world.entities.player;
  p.x = plaza.x;
  p.y = plaza.y + 60;
  p.angle = -Math.PI / 2;
  const input = scriptedInput();
  stepWorld(world, input, START_SECONDS);
  return { screen: SCREEN_TITLE };
}

function stagePlay(world) {
  const input = scriptedInput();
  const p = world.entities.player;
  const car = world.entities.cars.find((c) => c.model === 'Meridian');
  beginMission(world, 0);
  const waypoints = [
    { x: roadX(2), y: roadY(6) },
    { x: roadX(6), y: roadY(6) },
    { x: roadX(6), y: roadY(4) },
    { x: roadX(9), y: roadY(4) },
  ];
  let wp = 0;
  let entered = false;
  const steps = Math.round(PLAY_SECONDS / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (!p.car) {
      if (entered) break; // the ride got wrecked: the frame is what it is
      const d = walkToward(input, p, car.x, car.y);
      if (d < 40) {
        world.enterExitCar();
        entered = true;
      }
    } else if (wp < waypoints.length) {
      const d = driveToward(input, p.car, waypoints[wp].x, waypoints[wp].y);
      if (d < 60) wp += 1;
    } else {
      input.setMove(0, -1);
    }
    world.step(input, 0, STEP);
  }
  return { screen: SCREEN_PLAY };
}

function stageChase(world) {
  const input = scriptedInput();
  const p = world.entities.player;
  const car = world.entities.cars.find((c) => c.model === 'Meridian');
  const plaza = landmarkPoint('plaza', 0.5, 0.5);
  car.x = roadX(6);
  car.y = roadY(4) + 10;
  car.angle = 0;
  car.hp = 500; // the chase shot needs the ride to survive twenty seconds of ramming
  p.x = car.x;
  p.y = car.y;
  p.car = car;
  car.kind = 'player';
  beginMission(world, 0);
  p.wanted = 3;
  p.heat = 60;
  world.say('WANTED LEVEL 3 — lose the cops!', '#ff6b6b');
  const waypoints = [
    { x: roadX(9), y: roadY(4) },
    { x: roadX(9), y: roadY(6) },
    { x: roadX(4), y: roadY(6) },
    { x: roadX(4), y: roadY(3) },
    { x: roadX(8), y: roadY(3) },
  ];
  let wp = 0;
  const steps = Math.round(CHASE_SECONDS / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (!p.car) break; // wrecked: the frame shows the aftermath
    if (wp < waypoints.length) {
      const d = driveToward(input, p.car, waypoints[wp].x, waypoints[wp].y);
      if (d < 60) wp += 1;
    } else {
      input.setMove(0, -1);
    }
    world.step(input, 0, STEP);
    if (p.dead) break;
  }
  void plaza;
  return { screen: SCREEN_PLAY };
}

function stageMission(world) {
  const input = scriptedInput();
  const p = world.entities.player;
  beginMission(world, 0);
  const marker = world.missions.active;
  // Start on foot at the intersection north of the docks and walk the roads to
  // the marker: south on 6th Avenue, east on the harbour road, then into the docks.
  p.x = roadX(6);
  p.y = roadY(6);
  p.angle = Math.PI / 2;
  const waypoints = [
    { x: roadX(6), y: roadY(7) },
    { x: marker.x, y: roadY(7) },
    { x: marker.x, y: marker.y },
  ];
  let wp = 0;
  const steps = Math.round(MISSION_SECONDS / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (wp < waypoints.length) {
      const d = walkToward(input, p, waypoints[wp].x, waypoints[wp].y);
      if (d < 24) wp += 1;
    } else {
      input.setMove(0, 0);
    }
    world.step(input, 0, STEP);
  }
  return { screen: SCREEN_PLAY };
}

/**
 * Set `world` to the named scene (start, play, chase or mission; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  if (name === 'play') return stagePlay(world);
  if (name === 'chase') return stageChase(world);
  if (name === 'mission') return stageMission(world);
  return stageStart(world);
}
