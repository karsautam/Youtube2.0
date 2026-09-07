// Persistent, anonymous device identifier used by the backend to detect
// when the same account signs in from a different device.
const KEY = "yourtube_device_id";

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}${Math.random()
        .toString(36)
        .slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  }
}

export function clearDeviceId() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}