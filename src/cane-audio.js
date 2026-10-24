// Procedural contact sounds: no recordings, downloads, or microphone required.
export class CaneAudio {
  constructor() { this.context = null; }

  async unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    try {
      this.context ||= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
      return this.context.state === 'running';
    } catch { return false; }
  }

  tap(surface) {
    const context = this.context;
    if (!context || context.state !== 'running') return;
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
      oscillator.start(time); oscillator.stop(time + .09);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }
}
