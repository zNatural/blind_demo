import test from 'node:test';
import assert from 'node:assert/strict';
import { movementDelta, stepPosition, nearTerminal, nearLocker, spatialHint, groundSurface } from '../src/navigation.js';

test('WASD follows the viewing direction and diagonal speed is constant', () => {
  const forward = movementDelta(new Set(['KeyW']), 0, 1);
  assert.equal(forward.x, 0);
  assert.equal(forward.z, -1.8);
  const leftFacing = movementDelta(new Set(['KeyW']), Math.PI / 2, 1);
  assert.ok(Math.abs(leftFacing.x + 1.8) < 1e-10);
  const diagonal = movementDelta(new Set(['KeyW', 'KeyD']), 0, 1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1.8) < 1e-10);
  assert.deepEqual(movementDelta(new Set(), 0, 1), { x: 0, z: 0 });
});

test('walking is blocked by furniture and room boundaries but slides along walls', () => {
  const obstacles = [{ minX: -.45, maxX: .45, minZ: -.4, maxZ: .4 }];
  assert.deepEqual(stepPosition({ x: 0, z: .7 }, { x: .1, z: -.15 }, obstacles), { x: .1, z: .7 });
  assert.deepEqual(stepPosition({ x: 5.5, z: 6.6 }, { x: .2, z: .2 }, []), { x: 5.5, z: 6.6 });
});

test('terminal and locker interactions require the corresponding proximity zone', () => {
  assert.equal(nearTerminal({ x: 0, z: 5.3 }), false);
  assert.equal(nearTerminal({ x: 0, z: 1.8 }), true);
  assert.equal(nearTerminal({ x: 0, z: .6 }), true);
  assert.equal(nearTerminal({ x: 0, z: -.8 }), false);
  assert.equal(nearLocker({ x: 0, z: 1.8 }), false);
  assert.equal(nearLocker({ x: -2.4, z: -.72 }), true);
  assert.equal(nearLocker({ x: -3.6, z: -.72 }), true);
});

test('spatial guidance uses the player heading, not the overview camera', () => {
  const position = { x: 0, z: 0 };
  assert.equal(spatialHint(position, 0, { x: -3, z: 0 }).direction, 'a tu izquierda');
  assert.equal(spatialHint(position, Math.PI / 2, { x: -3, z: 0 }).direction, 'al frente');
  assert.equal(spatialHint(position, 0, { x: 0, z: 3 }).direction, 'detrás de ti');
  assert.equal(spatialHint(position, 0, { x: 3, z: 0 }).distance, 3);
});

test('cane distinguishes the floor, directional guides, and overlapping warning tiles', () => {
  const tiles = [{ minX: -.25, maxX: .25, minZ: 0, maxZ: 4, warning: false },
    { minX: -.75, maxX: .75, minZ: 0, maxZ: 1, warning: true }];
  assert.equal(groundSurface(1, 2, tiles), 'floor');
  assert.equal(groundSurface(0, 2, tiles), 'guide');
  assert.equal(groundSurface(0, .5, tiles), 'warning');
});
