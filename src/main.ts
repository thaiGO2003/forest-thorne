// Production entry point: restore the application shell over the existing 3D stage.
import { boot } from "./app/app";
import { createBootWatchdog } from "./app/bootWatchdog";
const root = document.getElementById("app");
if (!root) throw new Error("#app root missing");
let failed = false;
const fatal = (error: unknown) => {
  failed = true;
  root.dataset.boot = "failed";
  root.replaceChildren();
  const message = document.createElement("div"); message.className = "recovery-fatal";
  message.textContent = `Không thể mở trò chơi: ${error instanceof Error ? error.message : String(error)}`;
  const retry = document.createElement("button"); retry.textContent = "Tải lại";
  retry.addEventListener("click", () => location.reload()); message.append(retry); root.append(message);
};
const watchdog = createBootWatchdog({ isBootComplete: () => root.dataset.boot === "ready", hasAppInstance: () => false,
  onTimeout: () => fatal(new Error("Quá thời gian tải trò chơi")) });
void boot(root).then((app) => {
  watchdog.dispose();
  if (failed) { app.dispose(); return; }
  root.dataset.boot = "ready";
  if (import.meta.env.DEV) Object.assign(window, { __app: app, __stage: app.stage });
  const lost = (event: Event) => { event.preventDefault(); app.dispose(); fatal(new Error("WebGL đã mất kết nối. Hãy tải lại trò chơi.")); };
  app.stage.renderer.domElement.addEventListener("webglcontextlost", lost, { once: true });
  window.addEventListener("pagehide", () => app.dispose(), { once: true });
  import.meta.hot?.dispose(() => app.dispose());
}).catch((error: unknown) => { watchdog.dispose(); fatal(error); });
