// Lightweight user-agent parsing for device/session logging (no external deps).

function parseUserAgent(ua) {
  const s = String(ua || "");
  let browser = "Unknown";
  let os = "Unknown";
  let deviceLabel = "Unknown device";

  if (/edg\//i.test(s)) browser = "Microsoft Edge";
  else if (/opr\//i.test(s)) browser = "Opera";
  else if (/chrome\//i.test(s)) browser = "Chrome";
  else if (/firefox\//i.test(s)) browser = "Firefox";
  else if (/safari\//i.test(s)) browser = "Safari";

  if (/windows nt 10/i.test(s)) os = "Windows 10/11";
  else if (/windows/i.test(s)) os = "Windows";
  else if (/android/i.test(s)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(s)) os = "iOS";
  else if (/mac os x/i.test(s)) os = "macOS";
  else if (/linux/i.test(s)) os = "Linux";

  if (/iphone/i.test(s)) deviceLabel = "iPhone";
  else if (/ipad/i.test(s)) deviceLabel = "iPad";
  else if (/android(?=.*mobile)/i.test(s)) deviceLabel = "Android phone";
  else if (/android/i.test(s)) deviceLabel = "Android tablet";
  else if (/mobile/i.test(s)) deviceLabel = "Mobile";
  else if (/macintosh|windows/i.test(s)) deviceLabel = "Computer";

  return { browser, os, deviceLabel };
}

// Approximate a friendly location from an IP via the ip-api free endpoint.
// Best effort — never blocks login if it fails.
async function ipToLocation(ip) {
  if (!ip || ip === "unknown" || ip === "::1" || ip === "127.0.0.1" || ip.includes("::ffff:127")) {
    return "";
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,regionName,city&lang=en`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const data = await res.json();
    if (data.status !== "success") return "";
    return [data.city, data.regionName, data.country].filter(Boolean).join(", ");
  } catch {
    return "";
  }
}

function getIpFromRequest(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export { parseUserAgent, ipToLocation, getIpFromRequest };