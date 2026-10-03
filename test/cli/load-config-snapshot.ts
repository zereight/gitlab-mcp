import { GITLAB_PERMISSION_MODE, USE_OAUTH } from "../../config.js";

process.stdout.write(
  JSON.stringify({
    GITLAB_PERMISSION_MODE,
    USE_OAUTH,
  })
);
