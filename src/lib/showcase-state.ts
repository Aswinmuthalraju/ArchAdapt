export type ShowcaseSpace = 'living' | 'courtyard' | 'studio';
export type ShowcaseLighting = 'day' | 'evening';
export interface ShowcaseState {
  roofOpen: boolean;
  lighting: ShowcaseLighting;
  space: ShowcaseSpace;
  view: number;
  resetKey: number;
}
export const initialShowcaseState: ShowcaseState = { roofOpen: false, lighting: 'day', space: 'courtyard', view: 0, resetKey: 0 };
export type ShowcaseAction =
  | { type: 'roof' }
  | { type: 'lighting'; value: ShowcaseLighting }
  | { type: 'space'; value: ShowcaseSpace }
  | { type: 'rotate' }
  | { type: 'reset' };

export function showcaseReducer(state: ShowcaseState, action: ShowcaseAction): ShowcaseState {
  switch (action.type) {
    case 'roof': return { ...state, roofOpen: !state.roofOpen };
    case 'lighting': return { ...state, lighting: action.value };
    case 'space': return { ...state, space: action.value };
    case 'rotate': return { ...state, view: (state.view + 1) % 4 };
    case 'reset': return { ...initialShowcaseState, resetKey: state.resetKey + 1 };
  }
}

export function roofLiftOffset(progress: number): number {
  return Math.max(0, Math.min(1, progress)) * 3.8;
}
