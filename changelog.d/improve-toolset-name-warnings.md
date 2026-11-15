### Changed

- `GITLAB_TOOLSETS` (`--toolsets`) now logs a warning to stderr when it names a
  toolset that does not exist next to valid ones, for example `core,pipelnes` or
  `default,ci`, as `GITLAB_TOOLS` already does for unknown tool names. The
  warning lists the known toolsets, and for `all` combined with other names (such
  as `all,api`) it says that `all` only works on its own. The
  `No valid toolsets found` warning now also lists the known toolsets. These
  warnings and the `Unknown tool names in GITLAB_TOOLS` warning were printed
  twice on `doctor`; each one now prints once. The selected toolsets are unchanged: unknown
  names are still ignored.
