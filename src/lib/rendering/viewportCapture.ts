/** Lets the studio modals read a frame of the live 3D viewer (if it is mounted) to anchor AI renders to the real model. */
let capture: (() => string | null) | null = null;

export const registerViewportCapture = (fn: (() => string | null) | null) => { capture = fn; };

/** JPEG data URL of the current 3D view, or null when the 3D viewer is not open. */
export function captureViewport(): string | null {
  try { return capture ? capture() : null; } catch { return null; }
}
