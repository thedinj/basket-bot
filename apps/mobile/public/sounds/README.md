# Sound Effects Directory

Place sound effect files in this directory for use with overlay animations.

## Expected Files

Nine munitions share two files, mapped by family. Each effect names its own `soundPath`, so
giving any one of them its own audio later is a one-line edit in `src/animations/effects.ts` and
nothing else.

- `laser-zap.mp3` — beam family: ORBITAL LANCE, RAILGUN, NULL PULSE, SOLAR LENS, EQUATORIAL GUILLOTINE
- `explosion.mp3` — impact family: TACTICAL AIRBURST, KINETIC ROD, MIRV SALVO, EVENT HORIZON

## File Format

Supported formats: MP3, WAV, OGG
Recommended: MP3 (best compatibility across platforms)

## Usage

Sound files are referenced in the animation effects library (`src/animations/effects.ts`) with
paths like `/sounds/filename.mp3`, and are fetched and decoded ahead of use by
`src/animations/strikeAudio.ts`. A missing file is not fatal: playback rejects, the hook warns
and falls back to haptics, and the visual still plays.
