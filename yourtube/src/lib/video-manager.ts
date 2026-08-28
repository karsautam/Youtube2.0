const registered = new Set<HTMLMediaElement>();
let current: HTMLMediaElement | null = null;

function onPlay(e: Event) {
  const el = e.target as HTMLMediaElement | null;
  if (!el || !registered.has(el)) return;
  if (el.muted) return;
  if (current && current !== el && !current.paused && registered.has(current)) {
    current.pause();
  }
  current = el;
}

function onStop(e: Event) {
  const el = e.target as HTMLMediaElement | null;
  if (el && current === el) current = null;
}

if (typeof document !== "undefined") {
  document.addEventListener("play", onPlay, true);
  document.addEventListener("pause", onStop, true);
  document.addEventListener("ended", onStop, true);
  document.addEventListener("emptied", onStop, true);

  const tagOf = (el: HTMLMediaElement | null | undefined) =>
    `[${el?.dataset?.playerRole || "other"}] ${
      el ? (el.getAttribute("src") || el.currentSrc || "").split("/").pop() : "?"
    }`;

  const stack = (n: number) =>
    new Error().stack?.split("\n").slice(1, n + 1).join(" | ");

  const origPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
    console.warn("[debug] .pause()", tagOf(this), "t=" + this.currentTime.toFixed(2), stack(5));
    return origPause.call(this);
  };
  const origLoad = HTMLMediaElement.prototype.load;
  HTMLMediaElement.prototype.load = function (this: HTMLMediaElement) {
    console.warn("[debug] .load()", tagOf(this), stack(5));
    return origLoad.call(this);
  };
  for (const evt of ["play", "pause", "emptied", "error", "stalled", "waiting", "canplay", "abort"]) {
    document.addEventListener(
      evt,
      (e) => {
        const el = e.target as HTMLMediaElement | null;
        if (el && registered.has(el)) {
          console.warn(
            "[debug]",
            evt,
            tagOf(el),
            "t=" + el.currentTime.toFixed(2), "paused=" + el.paused,
            "readyState=" + el.readyState,
            "error=" + (el.error ? el.error.code : "null")
          );
        }
      },
      true
    );
  }
}

export function registerVideo(el: HTMLVideoElement): () => void {
  registered.add(el);
  return () => registered.delete(el);
}
