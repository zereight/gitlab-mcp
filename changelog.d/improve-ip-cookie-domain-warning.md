### Changed

- A warning is now logged when a `GITLAB_AUTH_COOKIE_PATH` file entry uses an IP
  address as its domain; it shows the cookie name and domain, not the cookie
  value. Those cookies are still not used, same as before.
