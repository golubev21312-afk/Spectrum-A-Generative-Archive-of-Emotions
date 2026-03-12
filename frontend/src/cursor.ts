const HOVER_TARGETS = "a, button, input[type='range'], .feed-card, .zodiac-btn, select, [role='button']";

export function initCursor() {
  if (window.matchMedia("(pointer: coarse)").matches) return;

  const dot = document.createElement("div");
  dot.className = "cursor-dot";
  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mx = -200, my = -200;
  let rx = -200, ry = -200;

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.left = mx + "px";
    dot.style.top = my + "px";
  });

  document.addEventListener("mousedown", () => dot.classList.add("cursor-dot--press"));
  document.addEventListener("mouseup", () => dot.classList.remove("cursor-dot--press"));

  document.addEventListener("mouseover", (e) => {
    const over = !!(e.target as Element).closest?.(HOVER_TARGETS);
    ring.classList.toggle("cursor-ring--hover", over);
  });

  let rafId = 0;
  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
  function tick() {
    rafId = requestAnimationFrame(tick);
    rx = lerp(rx, mx, 0.13);
    ry = lerp(ry, my, 0.13);
    ring.style.left = rx + "px";
    ring.style.top = ry + "px";
  }
  tick();

  return () => {
    cancelAnimationFrame(rafId);
    dot.remove();
    ring.remove();
  };
}
