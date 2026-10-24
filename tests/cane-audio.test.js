import test from 'node:test';
import assert from 'node:assert/strict';
import { CaneAudio } from '../src/cane-audio.js';
import { requestMicrophoneAccess } from '../src/device-access.js';

class FakeContext {
  constructor() {
    this.state = 'suspended'; this.currentTime = 0; this.destination = {};
    this.resumeCalls = 0; this.oscillators = [];
  }
  async resume() { this.resumeCalls++; this.state = 'running'; this.onstatechange?.(); }
  createOscillator() {
    const oscillator = { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() {} };
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
}

test('a contact resumes suspended or interrupted audio before playing', async () => {
  const audio = new CaneAudio({ AudioContextClass: FakeContext });
  assert.equal(await audio.unlock(), true);
  audio.context.state = 'interrupted';
  assert.equal(await audio.tap('warning'), true);
  assert.equal(audio.context.resumeCalls, 2);
  assert.equal(audio.context.oscillators.length, 3);
});

test('a closed context is recreated and a failed resume reports failure', async () => {
  const audio = new CaneAudio({ AudioContextClass: FakeContext });
  await audio.unlock();
  const previous = audio.context;
  previous.state = 'closed';
  assert.equal(await audio.unlock(), true);
  assert.notEqual(audio.context, previous);
  audio.context.state = 'suspended';
  audio.context.resume = () => Promise.reject(new Error('Blocked'));
  assert.equal(await audio.tap('guide'), false);
  assert.equal(audio.context.oscillators.length, 0);
});

test('contacts awaiting the same resume play only the latest surface', async () => {
  const audio = new CaneAudio({ AudioContextClass: FakeContext });
  await audio.unlock();
  audio.context.state = 'suspended';
  let resume;
  audio.context.resume = () => new Promise((resolve) => { resume = () => { audio.context.state = 'running'; resolve(); }; });
  const older = audio.tap('floor'), latest = audio.tap('guide');
  resume();
  assert.deepEqual(await Promise.all([older, latest]), [false, true]);
  assert.equal(audio.context.oscillators.length, 2);
});

test('muting while audio resumes cancels queued sounds', async () => {
  const audio = new CaneAudio({ AudioContextClass: FakeContext });
  await audio.unlock();
  audio.context.state = 'suspended';
  let resume;
  audio.context.resume = () => new Promise((resolve) => { resume = () => { audio.context.state = 'running'; resolve(); }; });
  const tap = audio.tap('guide');
  audio.cancel(); resume();
  assert.equal(await tap, false);
  assert.equal(audio.context.oscillators.length, 0);
});

test('microphone setup requests audio only and immediately stops its tracks', async () => {
  let stopped = 0;
  const result = await requestMicrophoneAccess({ getUserMedia: async (constraints) => {
    assert.deepEqual(constraints, { audio: true, video: false });
    return { getTracks: () => [{ stop: () => stopped++ }, { stop: () => stopped++ }] };
  } });
  assert.equal(result.state, 'granted');
  assert.equal(stopped, 2);
});

test('microphone denial and unsupported devices remain recoverable', async () => {
  assert.equal((await requestMicrophoneAccess({})).state, 'unavailable');
  const denied = await requestMicrophoneAccess({ getUserMedia: async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }); } });
  assert.equal(denied.state, 'denied');
  assert.match(denied.message, /preguntas escritas/);
});
