const registered = new Set<HTMLVideoElement>();
let current: HTMLVideoElement | null = null;

function onPlay(e: Event) {
  const el = e.target as HTMLVideoElement | null;
  if (!el || !registered.has(el)) return;
  if (current && current !== el && !current.paused) {
    current.pause();
  }
  current = el;
}

function onStop(e: Event) {
  const el = e.target as HTMLVideoElement | null;
  if (el && current === el) current = null;
}

if (typeof document !== "undefined") {
  document.addEventListener("play", onPlay, true);
  document.addEventListener("pause", onStop, true);
  document.addEventListener("ended", onStop, true);
  document.addEventListener("emptied", onStop, true);
}

export function registerVideo(el: HTMLVideoElement): () => void {
  registered.add(el);
  return () => registered.delete(el);
}
