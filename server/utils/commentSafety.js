// Comment safety: content filtering, duplicate detection, rate limiting and
// a lightweight math CAPTCHA. All in-memory; fine for a single-instance server.

const EDITABLE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h edit window

// Normalize text for matching: lowercase, collapse leet-speak, drop
// punctuation/whitespace so "h3ll0", "h-e-l-l-o" and "HELLO" all match "hello".
function normalize(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/[^a-z]/g, "");
}

const PROFANITY = [
  "ass",
  "bastard",
  "bitch",
  "bloody",
  "bollocks",
  "crap",
  "damn",
  "dick",
  "dumbass",
  "fuck",
  "fag",
  "hell",
  "idiot",
  "moron",
  "nazi",
  "nigga",
  "nigger",
  "piss",
  "retard",
  "shit",
  "slut",
  "twat",
  "whore",
  "wanker",
];

const URL_RE = /(https?:\/\/|www\.)\S+/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const EMOJI_RE =
  /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

function countRepeatedRun(text) {
  const m = /(.)\1{6,}/.exec(text);
  return m ? m[0].length : 0;
}

// Returns { blocked: true, reason } or { blocked: false }.
export function filterCommentContent(body) {
  const text = String(body || "");
  const trimmed = text.trim();
  if (!trimmed) return { blocked: true, reason: "Comment cannot be empty" };

  const norm = normalize(trimmed);

  // Profanity: substring match against normalized text tolerates spacing/leet.
  for (const word of PROFANITY) {
    if (norm.includes(word)) {
      return { blocked: true, reason: "Your comment contains inappropriate language" };
    }
  }

  // Malicious links / contact details.
  if (URL_RE.test(trimmed)) {
    return { blocked: true, reason: "Links are not allowed in comments" };
  }
  if (EMAIL_RE.test(trimmed)) {
    return { blocked: true, reason: "Contact details are not allowed in comments" };
  }

  // Emoji flooding.
  const emojiCount = (trimmed.match(EMOJI_RE) || []).length;
  if (emojiCount >= 15) {
    return { blocked: true, reason: "Too many emoji — please reduce them" };
  }

  // Repeated characters / special-char flooding.
  if (countRepeatedRun(trimmed) >= 7) {
    return { blocked: true, reason: "Please avoid repeated characters" };
  }
  const alphaNumeric = (trimmed.match(/[a-z0-9]/gi) || []).length;
  const specialRatio = alphaNumeric > 0 ? 1 - alphaNumeric / trimmed.length : 1;
  if (specialRatio >= 0.6 && trimmed.length >= 12) {
    return { blocked: true, reason: "Comment looks like spam" };
  }

  return { blocked: false };
}

// Duplicate detection: same normalized body posted by the same user to the
// same video within a short window is considered spam.
export const recentComments = new Map(); // key -> { userId, videoId, norm, at }
export const RATE_POSTS_PER_MINUTE = 8;
export const RATE_POSTS_PER_HOUR = 40;

export const postTimes = new Map(); // userId -> array of timestamps

export function checkRate(userId) {
  const now = Date.now();
  let times = postTimes.get(String(userId));
  if (!times) return { limited: false, minuteCount: 0, hourCount: 0 };
  times = times.filter((t) => now - t < 3600000);
  const minuteCount = times.filter((t) => now - t < 60000).length;
  return {
    limited: minuteCount >= RATE_POSTS_PER_MINUTE || times.length >= RATE_POSTS_PER_HOUR,
    minuteCount,
    hourCount: times.length,
  };
}

export function hitRate(userId) {
  const key = String(userId);
  const now = Date.now();
  const times = (postTimes.get(key) || []).filter((t) => now - t < 3600000);
  times.push(now);
  postTimes.set(key, times);
  if (postTimes.size > 20000) {
    for (const [k, arr] of postTimes) {
      if (arr.filter((t) => now - t < 3600000).length === 0) postTimes.delete(k);
    }
  }
}

export function isDuplicate(userId, videoId, body) {
  const norm = normalize(body);
  const now = Date.now();
  let found = false;
  for (const [key, rec] of recentComments) {
    if (
      String(rec.userId) === String(userId) &&
      String(rec.videoId) === String(videoId) &&
      rec.norm === norm &&
      now - rec.at < 5 * 60 * 1000
    ) {
      found = true;
      break;
    }
  }
  recentComments.set(`${userId}:${videoId}:${norm}:${now}`, {
    userId,
    videoId,
    norm,
    at: now,
  });
  if (recentComments.size > 10000) {
    const cutoff = now - 10 * 60 * 1000;
    for (const [key, rec] of recentComments) {
      if (rec.at < cutoff) recentComments.delete(key);
    }
  }
  return found;
}

// ---------------- CAPTCHA ----------------
const captchas = new Map(); // token -> { answer, expiresAt }

export function createCaptcha() {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  const answer = a + b;
  const token = `cap_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  captchas.set(token, { answer, expiresAt: Date.now() + 3 * 60 * 1000 });
  if (captchas.size > 1000) {
    const now = Date.now();
    for (const [k, v] of captchas) {
      if (v.expiresAt < now) captchas.delete(k);
    }
  }
  return { token, prompt: `${a} + ${b}` };
}

export function verifyCaptcha(token, answer) {
  if (!token || answer === undefined || answer === null || answer === "") {
    return false;
  }
  const cap = captchas.get(token);
  if (!cap) return false;
  captchas.delete(token);
  if (cap.expiresAt < Date.now()) return false;
  return Number(answer) === cap.answer;
}

export { EDITABLE_WINDOW_MS };