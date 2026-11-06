### Fixed

- `download_attachment` and the remote attachment download URL find an upload whose
  name uses another Unicode form than the one asked for, such as a macOS screenshot
  with decomposed accents, instead of returning 404.
