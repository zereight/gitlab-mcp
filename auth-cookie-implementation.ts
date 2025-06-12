// Add this after the existing environment variables
const GITLAB_AUTH_COOKIE_PATH = process.env.GITLAB_AUTH_COOKIE_PATH;

/**
 * Read and parse the authentication cookie file
 * @returns {string|null} The cookie string or null if not available
 */
function readAuthCookie(): string | null {
  if (!GITLAB_AUTH_COOKIE_PATH) {
    return null;
  }

  try {
    // Expand tilde in path if present
    const cookiePath = GITLAB_AUTH_COOKIE_PATH.startsWith("~/")
      ? path.join(process.env.HOME || "", GITLAB_AUTH_COOKIE_PATH.slice(2))
      : GITLAB_AUTH_COOKIE_PATH;

    if (!fs.existsSync(cookiePath)) {
      console.error(`Auth cookie file not found at ${cookiePath}`);
      return null;
    }

    const cookieContent = fs.readFileSync(cookiePath, "utf8");
    const cookies = cookieContent
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => {
        const parts = line.split("\t");
        if (parts.length >= 7) {
          return `${parts[5]}=${parts[6]}`;
        }
        return null;
      })
      .filter(Boolean)
      .join("; ");

    return cookies;
  } catch (error) {
    console.error("Error reading auth cookie file:", error);
    return null;
  }
}

// Get the auth cookie if available
const authCookie = readAuthCookie();

// Add this to the DEFAULT_HEADERS section
// Add auth cookie if available
if (authCookie) {
  DEFAULT_HEADERS["Cookie"] = authCookie;
}
