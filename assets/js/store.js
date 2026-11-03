// Small, safe wrapper round localStorage. Everything here is a convenience:
// the site must work when storage is missing, full or blocked.
const PREFIX = "dedum:";

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function update(key, fallback, fn) {
  const next = fn(load(key, fallback));
  save(key, next);
  return next;
}
