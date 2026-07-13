export interface Preferences {
  readonly highContrast: boolean;
  readonly largeText: boolean;
  readonly reducedMotion: boolean;
  readonly sound: boolean;
}

const key = "houkago-dash-preferences";
const defaults: Preferences = {
  sound: true,
  reducedMotion: false,
  highContrast: false,
  largeText: false,
};

export function loadPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "{}") as Partial<Preferences>;
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

export function savePreferences(preferences: Preferences): void {
  localStorage.setItem(key, JSON.stringify(preferences));
  applyPreferences(preferences);
}

export function applyPreferences(preferences: Preferences): void {
  document.body.classList.toggle("reduced-motion", preferences.reducedMotion);
  document.body.classList.toggle("high-contrast", preferences.highContrast);
  document.body.classList.toggle("large-text", preferences.largeText);
}
