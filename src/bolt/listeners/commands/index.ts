import type { App } from "@slack/bolt";
import prsCallback from "./prs.js";

const register = (app: App) => {
  app.command("/prs", prsCallback);
};

export default { register };
