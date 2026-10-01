// Entry point. App shell (loading → menu) mounts over this stage once UI art is approved.
import { createStage } from "./world/stage";

const root = document.getElementById("app");
if (!root) throw new Error("#app root missing");
const stage = createStage(root);
root.dataset.boot = "ready";
// Dev/test seam for browser smoke checks.
if (import.meta.env.DEV) Object.assign(window, { __stage: stage });
