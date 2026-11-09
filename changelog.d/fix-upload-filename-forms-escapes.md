### Fixed

- `download_attachment` and the remote attachment download URL no longer try a
  Unicode form of an upload's name that holds a percent escape the asked name
  does not (`50%1Á.txt` decomposed reads `50%1A…`), which made a missing upload
  fail with a path error instead of not found.
