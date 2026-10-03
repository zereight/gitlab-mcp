import { GITLAB_READ_ONLY_MODE, USE_OAUTH } from "../../config.js";

process.stdout.write(
  JSON.stringify({
    GITLAB_READ_ONLY_MODE,
    USE_OAUTH,
  })
);
