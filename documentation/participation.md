# Game participation

Game Control → Participation (I) lists both teams' active players, including in final games. Starters from every unit, players identified in accepted plays or penalties (including declined penalties and no-stat roles), and players with nonzero statistics are checked and locked. The modal explains each lock. Remaining players can be checked or unchecked by stable player ID, so duplicate jersey numbers remain independent.

Manual choices are saved in the local game envelope as `participation: { schemaVersion: 'football.participation.v1', manualPlayed: { H: string[], V: string[] }, updatedAt: string }`. Only manual choices are persisted. Automatic participation is derived from the current game, so removing or editing the last actor reference releases its lock when no other evidence remains. Save validates against the latest envelope, retains selections for inactive players hidden from the modal, and queues the complete envelope for the normal mirror/XML delivery. Undoing a play preserves separately saved participation.

Cancel and Escape discard draft changes; a save failure retains the modal and selection. The modal owns scoring hotkeys while open.

XML uses the same participation helper, supplemented by its legacy actor/stat projections. Played players receive `gp="1"` in the team node, and other roster players receive `gp="0"` under DNP. Manual participation does not create a statistic or scoring event. Sync the helper after changes with `node scripts/sync-football-participation.mjs <dashboard>/src/services/xml/builders/footballParticipation.js`; both copies must match.
