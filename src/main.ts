// Entry point. App shell wiring lands in src/app/ (boot → loading → menu).
const root = document.getElementById("app");
if (!root) throw new Error("#app root missing");
root.dataset.boot = "ready";
