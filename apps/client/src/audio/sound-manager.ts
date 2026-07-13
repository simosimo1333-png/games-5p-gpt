import type { Preferences } from "../ui/preferences";

type Cue = "click" | "start" | "gate" | "rescue" | "finish";

const cues: Record<Cue, readonly [number, number]> = {
  click: [440, 0.06],
  start: [660, 0.12],
  gate: [880, 0.16],
  rescue: [740, 0.14],
  finish: [990, 0.22],
};

class SoundManager {
  private context: AudioContext | undefined;
  private enabled = true;

  setPreferences(preferences: Preferences): void {
    this.enabled = preferences.sound;
  }

  play(cue: Cue): void {
    if (!this.enabled || typeof AudioContext === "undefined") return;
    try {
      this.context ??= new AudioContext();
      const [frequency, duration] = cues[cue];
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.0001, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, this.context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + duration);
    } catch {
      // Audio is optional. Browser restrictions must never block game progress.
    }
  }
}

export const soundManager = new SoundManager();
