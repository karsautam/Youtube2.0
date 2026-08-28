export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function readRect(el: Element | null | undefined): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

const FLIP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export function flipFrom(
  el: HTMLElement,
  from: Rect,
  { duration = 800, ease = FLIP_EASING, onDone }: {
    duration?: number;
    ease?: string;
    onDone?: () => void;
  } = {}
): (() => void) | undefined {
  const to = el.getBoundingClientRect();
  if (to.width === 0 || to.height === 0 || from.width === 0 || from.height === 0) {
    return;
  }
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  const dx = from.x - to.x;
  const dy = from.y - to.y;

  el.style.transition = "none";
  el.style.transformOrigin = "top left";
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  void el.getBoundingClientRect();
  el.style.transition = `transform ${duration}ms ${ease}`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transform = "translate(0, 0) scale(1)";
    });
  });

  const timer = setTimeout(() => {
    el.style.transition = "";
    el.style.transform = "";
    el.style.transformOrigin = "";
    onDone?.();
  }, duration + 30);

  return () => clearTimeout(timer);
}