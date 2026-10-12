# Mochi UI Sounds

Source: https://github.com/lyx404/Mochi-UI-Sounds

Pinned revision: `00a9dfde0e8f5fcdbd905007c776b2dc2fd01981`.

The upstream README and skill explicitly describe copying and integrating the sound module. The requested atmosphere recipes are `sounds.powerUp` (能量), `sounds.pop` (弹泡), and `sounds.coin` (金币) from `src/lib/sounds.ts`. The skill was installed using the user's requested global command.

The original sound module header is retained in `renderer/soundscape/mochi-sounds.ts`. Local additions track and stop scheduled audio sources for microphone safety. A separate upstream LICENSE was not supplied; this third-party module is not relabeled as the application's original MIT code.
