const DESMOS_API_VERSION = 'v1.11'

// Desmos requires an API key. The public demo key from Desmos's own docs is
// used as a fallback; set VITE_DESMOS_API_KEY to your own key
// (free at https://www.desmos.com/my-api) for production use.
const DESMOS_API_KEY = import.meta.env.VITE_DESMOS_API_KEY || 'dcb31709b452b1cf9dc26972add0fda6'

export interface DesmosGraphingCalculator {
  getState(): unknown
  setState(state: unknown): void
  setBlank(): void
  resize(): void
  destroy(): void
}

export interface DesmosApi {
  GraphingCalculator(element: HTMLElement, options?: Record<string, unknown>): DesmosGraphingCalculator
}

declare global {
  interface Window {
    Desmos?: DesmosApi
  }
}

let loader: Promise<DesmosApi> | null = null

export function loadDesmos(): Promise<DesmosApi> {
  if (window.Desmos) return Promise.resolve(window.Desmos)
  if (!loader) {
    loader = new Promise<DesmosApi>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://www.desmos.com/api/${DESMOS_API_VERSION}/calculator.js?apiKey=${DESMOS_API_KEY}`
      script.async = true
      script.onload = () => {
        if (window.Desmos) resolve(window.Desmos)
        else {
          loader = null
          reject(new Error('Desmos API loaded but window.Desmos is missing'))
        }
      }
      script.onerror = () => {
        loader = null
        reject(new Error('Failed to load the Desmos calculator API'))
      }
      document.head.appendChild(script)
    })
  }
  return loader
}

// Module-scoped graph state. The panel saves here when it unmounts (e.g.
// switching to the review screen) and restores on remount, so closing and
// reopening the calculator never loses work. Keyed by module id so each
// module starts blank; Home clears it whenever a new test is assembled.
let stored: { moduleId: string; state: unknown } | null = null

export function saveCalcState(moduleId: string, state: unknown) {
  stored = { moduleId, state }
}

export function takeCalcState(moduleId: string): unknown | null {
  return stored && stored.moduleId === moduleId ? stored.state : null
}

export function clearCalcState() {
  stored = null
}
