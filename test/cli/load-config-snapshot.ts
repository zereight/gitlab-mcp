import { GITLAB_PERMISSION_MODE, OAUTH_DISABLE_REFRESH_TOKEN, USE_OAUTH } from "../../config.js";

process.stdout.write(
  JSON.stringify({
    GITLAB_PERMISSION_MODE,
    USE_OAUTH,
    OAUTH_DISABLE_REFRESH_TOKEN,
  })
);
