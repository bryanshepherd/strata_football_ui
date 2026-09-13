# Replayed kickoff descriptions

Kickoff setup deliberately has no possession team. The play editor measures penalty enforcement from the saved origin and final spots, using a recorded kicker/primary team or fixed field coordinates when both spots are explicit. It must not erase a known five-yard enforcement solely because possession is null. Ambiguous goal-line spots and unresolved/deferred enforcement remain unresolved.

An accepted previous-spot/free-kick penalty that repeats the kickoff is described with `No play`, the penalty's name and enforcement, and `Re-kick from ...`. A receiving-team drive confirmed after the change of possession, declined penalty, or end-of-play enforcement is not labeled as a re-kick. The kick and return remain visible as the actions that were nullified.

`repairFootballPlayReadoutsInEnvelope` repairs missing accepted penalty yards only when the saved spots determine the distance, regenerates affected descriptions, and updates confirmation text. It preserves existing numeric yardage and every ball-context field. Scorer/report loads and XML use this projection without writing the server mirror. `scripts/build-football-actor-repair.mjs` exports the shared repair alongside the original actor-repair entry point.
