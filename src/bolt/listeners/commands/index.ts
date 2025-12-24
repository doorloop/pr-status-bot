import type { App } from "@slack/bolt";
import prStatusCallback from "./pr-status.js";

const register = (app: App) => {
  app.command("/pr-status", prStatusCallback);
};

export default { register };
