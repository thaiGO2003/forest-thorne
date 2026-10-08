// Entry point: boots the app shell (loading → menu) over the 3D stage.
import { boot } from "./app/app";
import "./app/screens";

const root = document.getElementById("app");
if (!root) throw new Error("#app root missing");
const app = await boot(root);
root.dataset.boot = "ready";
// Dev/test seam for browser smoke checks.
if (import.meta.env.DEV) Object.assign(window, { __app: app, __stage: app.stage });
