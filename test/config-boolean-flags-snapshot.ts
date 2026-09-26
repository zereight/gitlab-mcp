import { GITLAB_READ_ONLY_MODE } from "../config.js";

process.stdout.write(JSON.stringify({ GITLAB_READ_ONLY_MODE }));
