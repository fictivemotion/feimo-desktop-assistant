# Bloub

Original project: https://github.com/jeremy-prt/bloub

Pinned revision: `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`.

Copyright © 2026 Jérémy Perret. MIT license in LICENSE.

The complete framework independent bot engine, shape profiles, states, expressions, particles, arcs and morphing logic are preserved in `upstream/`. Feimo's `avatar.js` renders the original engine's SVG frames and maps assistant states to its animations. `engine.js` is built with `npm run build:bloub`. The page background is transparent; the original paper backing is applied only to the body silhouette to occlude particles behind the eyes. Settings/header thumbnails sample an idle frame without an animation loop.

`scenes.js` schedules all 15 original states (14 catalogue actions plus the original settings transition, swirl) from real assistant contexts. Finite orbit/comet/play actions replay through idle bridges; upstream minimum reassembly durations are preserved for lower-priority transitions. `lib/pet-scenes.js` routes voice phases, first-token/streaming responses, focus/break timers, audio playback and workbench contexts. The native look override brings every state's eyes toward the face center, looking at the viewer with a slight left/up bias (yaw −10°, pitch +10°), including orbit and transitions. Idle/swirl retain small pointer tracking (±3° yaw, ±2° pitch). Native expressions, blinking, body morphing, particles and orbital arcs remain intact. The initial gaze settles before the first visible frame; preview thumbnails share the same direction. The upstream animation source remains unchanged.
