/** Keeps the uploaded site sketch in this browser so the 2D plan can draw it under the house. */

const key = (projectId: string) => `siteplan_${projectId}`;
const MAX_SIDE = 1400;

/** Shrinks an image file to a JPEG data URL small enough for localStorage. Resolves null when it cannot. */
export function shrinkImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function saveSitePlan(projectId: string, dataUrl: string): boolean {
  try {
    localStorage.setItem(key(projectId), dataUrl);
    return true;
  } catch {
    return false;
  }
}

export function loadSitePlan(projectId: string): string | null {
  try {
    return localStorage.getItem(key(projectId));
  } catch {
    return null;
  }
}

export function clearSitePlan(projectId: string) {
  try {
    localStorage.removeItem(key(projectId));
  } catch { /* nothing stored */ }
}
