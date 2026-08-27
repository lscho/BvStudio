# Bundled media tools

`npm run prepare:media-sidecars` generates this directory before a Tauri development or release build. FFmpeg and FFprobe use Tauri's target-triple `externalBin` naming so the bundler can place and sign them as native sidecars. Generated executables, manifest and copied license are intentionally ignored by Git because they are platform-specific large files.

The executables are supplied by `ffmpeg-static` and the platform package selected by `@ffprobe-installer/ffprobe`. See the generated `media-sidecars.json` for the exact package versions, licenses, binary architecture and upstream source locations.
