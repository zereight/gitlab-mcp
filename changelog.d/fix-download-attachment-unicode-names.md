### Fixed

- `download_attachment` and the remote attachment download URL find an upload whose
  name uses another Unicode form than the one asked for, such as a macOS screenshot
  with decomposed accents, instead of returning 404. The `filename` parameter now asks
  for the name as encoded in the upload URL, so that it is usually right the first time.
