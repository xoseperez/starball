// Entry point. Boot the app on DOMContentLoaded.
import { App } from "./app";

function boot(): void {
  document.title = `Starball v${__APP_VERSION__}`;
  const canvas = document.getElementById("game");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("missing <canvas id='game'>");
  }
  const app = new App(canvas);
  app.run();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
