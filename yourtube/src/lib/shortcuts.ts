export interface ShortcutRow {
  keys: string[];
  label: string;
}

export const GLOBAL_SHORTCUTS: ShortcutRow[] = [
  { keys: ["?"], label: "Show keyboard shortcuts" },
  { keys: ["/"], label: "Focus search" },
  { keys: ["g", "h"], label: "Go to Home" },
  { keys: ["g", "s"], label: "Go to Subscriptions" },
  { keys: ["g", "i"], label: "Go to History" },
  { keys: ["g", "l"], label: "Go to Liked videos" },
  { keys: ["g", "w"], label: "Go to Watch later" },
  { keys: ["h"], label: "Open History" },
  { keys: ["w"], label: "Open Watch later" },
  { keys: ["n"], label: "Start a meeting" },
];

export const PLAYER_SHORTCUTS: ShortcutRow[] = [
  { keys: ["Space", "k"], label: "Play / pause" },
  { keys: ["j", "l"], label: "Back / forward 10 seconds" },
  { keys: ["←", "→"], label: "Back / forward 5 seconds" },
  { keys: ["↑", "↓"], label: "Volume up / down" },
  { keys: ["m"], label: "Mute / unmute" },
  { keys: ["f"], label: "Toggle fullscreen" },
  { keys: ["t"], label: "Toggle theater mode" },
  { keys: ["c"], label: "Toggle captions" },
];

export const MOUSE_INTERACTIONS: ShortcutRow[] = [
  { keys: ["Click"], label: "Play / pause" },
  { keys: ["Double-click"], label: "Toggle fullscreen" },
  { keys: ["Scroll"], label: "Adjust volume" },
  { keys: ["Click / drag seek bar"], label: "Seek" },
  { keys: ["Hover seek bar"], label: "Preview timestamp" },
  { keys: ["Hover a video card"], label: "Play muted preview" },
];

export const G_PAGE_MAP: Record<string, string> = {
  h: "/",
  s: "/subscriptions",
  i: "/history",
  l: "/liked",
  w: "/watch-later",
};

export const SINGLE_KEY_MAP: Record<string, string> = {
  h: "/history",
  w: "/watch-later",
  n: "/meeting",
};
