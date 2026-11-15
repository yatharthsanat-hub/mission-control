type SceneToken = 'bg' | 'ink' | 'accent' | 'telemetry' | 'amber' | 'success'

export function sceneColor(token: SceneToken) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim()
}
