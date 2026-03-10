/**
 * Generative avatar — deterministic 5×5 pixel-art pattern from username hash.
 * Symmetric (left-right mirrored) for a balanced look.
 */
export function drawAvatar(canvas: HTMLCanvasElement, username: string): void {
  const ctx = canvas.getContext("2d")!;
  const size = canvas.width;

  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash + username.charCodeAt(i)) | 0;
  }
  const rng = (n: number) => {
    hash = ((hash * 1664525 + 1013904223) | 0) + n;
    return (hash >>> 0) / 0xffffffff;
  };

  const hue = Math.floor(rng(0) * 360);
  ctx.fillStyle = `hsl(${hue}, 30%, 12%)`;
  ctx.fillRect(0, 0, size, size);

  const cell = size / 5;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (rng(row * 3 + col) > 0.45) {
        const h2 = (hue + Math.floor(rng(col) * 60) - 30 + 360) % 360;
        const l = 45 + Math.floor(rng(row) * 30);
        ctx.fillStyle = `hsl(${h2}, 80%, ${l}%)`;
        ctx.fillRect(col * cell, row * cell, cell, cell);
        ctx.fillRect((4 - col) * cell, row * cell, cell, cell);
      }
    }
  }
}

/** Create a ready-made canvas element with the avatar drawn on it. */
export function createAvatarCanvas(username: string, size = 32): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.className = "avatar-canvas";
  canvas.title = username;
  drawAvatar(canvas, username);
  return canvas;
}
