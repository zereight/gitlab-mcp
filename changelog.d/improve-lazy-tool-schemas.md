### Changed

- Tool input schemas are now built on first read instead of for every tool at
  startup. A default `tools/list` lists 40 of the 288 registry entries, so it
  builds at most 40 of them. In local runs, stdio startup to the `initialize`
  response is about 30 ms faster (397 ms → 365 ms median) and importing the tool
  registry keeps about 0.8 MB less heap. `tools/list` output is byte-for-byte
  unchanged.
