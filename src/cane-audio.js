// Procedural contact sounds: no recordings, downloads, or microphone required.
export class CaneAudio {
  constructor({ AudioContextClass, onStateChange = () => {} } = {}) {
    this.context = null;
    this.AudioContextClass = AudioContextClass;
    this.onStateChange = onStateChange;
    this.unlocking = null;
    this.sources = new Set();
    this.epoch = 0;
    this.request = 0;
  }

  get state() { return this.context?.state || 'inactive'; }

  unlock() {
    const AudioContext = this.AudioContextClass || globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return Promise.resolve(false);
    if (this.unlocking) return this.unlocking;
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioContext();
        this.context.onstatechange = () => this.onStateChange(this.state);
      }
      if (this.state === 'running') return Promise.resolve(true);
      // Call resume synchronously from the click/key event to retain user activation.
      this.unlocking = Promise.resolve(this.context.resume())
        .then(() => this.state === 'running', () => false)
        .finally(() => { this.unlocking = null; this.onStateChange(this.state); });
      return this.unlocking;
    } catch {
      this.onStateChange(this.state);
      return Promise.resolve(false);
    }
  }

  cancel() {
    this.epoch++;
    for (const source of this.sources) {
      try { source.stop(); } catch { /* An ended oscillator is already silent. */ }
    }
    this.sources.clear();
  }

  async tap(surface) {
    const epoch = this.epoch, request = ++this.request;
    if (this.state !== 'running') {
      if (!await this.unlock() || request !== this.request) return false;
    }
    if (epoch !== this.epoch) return false;
    const context = this.context;
    if (!context || context.state !== 'running') return false;
    const taps = surface === 'warning' ? 3 : surface === 'guide' ? 2 : 1;
    const frequency = { floor: 260, guide: 1300, warning: 750, obstacle: 160 }[surface];
    for (let i = 0; i < taps; i++) {
      const time = context.currentTime + i * .065;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, time);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * .35, time + .055);
      gain.gain.setValueAtTime(.0001, time);
      gain.gain.exponentialRampToValueAtTime(.22, time + .003);
      gain.gain.exponentialRampToValueAtTime(.0001, time + .085);
      oscillator.connect(gain); gain.connect(context.destination);
      this.sources.add(oscillator);
      oscillator.start(time); oscillator.stop(time + .09);
      oscillator.onended = () => { this.sources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    }
    return true;
  }
}
