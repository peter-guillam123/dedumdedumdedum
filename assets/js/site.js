// Runs on every page: theme choice, the footer switch.
import { load, save } from "./store.js";

const root = document.documentElement;
function applyTheme(t) {
  if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
  else root.removeAttribute("data-theme");
}
applyTheme(load("theme", "auto"));

const sw = document.getElementById("theme");
if (sw) {
  sw.value = load("theme", "auto");
  sw.addEventListener("change", () => {
    save("theme", sw.value);
    applyTheme(sw.value);
  });
}
