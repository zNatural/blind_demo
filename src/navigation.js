// Shared movement and proximity rules, in metres on the scene's X/Z plane.
export const PLAYER_RADIUS = .22;
export const WALK_SPEED = 1.8;
export const START_POSITION = { x: 0, z: 5.3 };
export const LOCKER_POSITION = { x: 1.6, z: .13 };

export function movementDelta(keys, yaw, seconds) {
  const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const sideways = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const length = Math.hypot(forward, sideways);
  if (!length) return { x: 0, z: 0 };
  const step = WALK_SPEED * seconds / length;
  return {
    x: (-Math.sin(yaw) * forward + Math.cos(yaw) * sideways) * step,
    z: (-Math.cos(yaw) * forward - Math.sin(yaw) * sideways) * step
  };
}

export function canStand(x, z, obstacles) {
  if (x < -5.6 || x > 5.6 || z < -4.25 || z > 6.65) return false;
  return !obstacles.some((box) => x > box.minX - PLAYER_RADIUS && x < box.maxX + PLAYER_RADIUS
    && z > box.minZ - PLAYER_RADIUS && z < box.maxZ + PLAYER_RADIUS);
}

export function stepPosition(position, delta, obstacles) {
  // Resolve each axis separately so movement slides along walls instead of sticking.
  let { x, z } = position;
  if (canStand(x + delta.x, z, obstacles)) x += delta.x;
  if (canStand(x, z + delta.z, obstacles)) z += delta.z;
  return { x, z };
}

export function nearTerminal({ x, z }) {
  return Math.abs(x) < .9 && z > .5 && z < 2.25;
}

export function nearLocker({ x, z }) {
  return Math.abs(x - LOCKER_POSITION.x) < .55 && z > .55 && z < 1.8;
}

export function spatialHint(position, yaw, destination) {
  const dx = destination.x - position.x, dz = destination.z - position.z;
  let angle = Math.atan2(-dx, -dz) - yaw;
  angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  const direction = Math.abs(angle) < Math.PI / 6 ? 'al frente'
    : Math.abs(angle) > Math.PI * 5 / 6 ? 'detrás de ti'
    : angle > 0 ? 'a tu izquierda' : 'a tu derecha';
  return { direction, distance: Math.hypot(dx, dz) };
}

export function groundSurface(x, z, tiles) {
  const matches = tiles.filter((tile) => x >= tile.minX && x <= tile.maxX && z >= tile.minZ && z <= tile.maxZ);
  if (matches.some((tile) => tile.warning)) return 'warning';
  return matches.length ? 'guide' : 'floor';
}
