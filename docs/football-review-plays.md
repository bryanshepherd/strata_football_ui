# Review Plays

Review Plays (V) sits beside Game Control. It is available for live and final
saved games when no play entry or replacement is in progress.

- All Plays lists the complete current game in sequence order, including all
  quarters and overtime. Search by play text, player identity, or context;
  `#67` finds exactly play 67.
- By Player offers Away/Home selection and a name/number search. Clicking a
  name filters the list to that player's recorded involvement and shows their
  roles. Duplicate jerseys remain separate identities. Players with no recorded
  involvement show zero plays.
- Involvement includes recorded participants, nested result player references,
  lateral roles and penalties, including declined and nullified-play penalties.
  A player appears once per play even when they fill multiple roles. No-stat
  roles such as target, holder and hurry remain searchable. TEAM recovery IDs
  do not become fictitious players. Deleted events and overturned historical
  copies are excluded from the active review list.
- Review uses the existing safe readout/actor-reference repair helpers and the
  same editor eligibility as the Game Log. Reviewing itself never writes to
  the envelope. Administrative records without an editor remain read-only.
- Edit opens the existing play or ball-context editor. Save, cancel, deletion
  and recalculation return to the same view, selected player, search and scroll
  position (clamped when the list becomes shorter). Player counts and roles
  derive again from the updated envelope. Structural replacement temporarily
  hides review while replacement entry is active, then restores it.

The review window owns keyboard focus and scrolling. Scorer hotkeys are blocked
while reviewing or editing from review. Changes still use the existing local
save, undo, envelope mirror, report/XML and final-game preservation paths.

Validation covers ID matching, nested actors, penalties, duplicate jerseys,
nullified/deleted/history records, live-entry guards, final-game actor editing,
mirroring, filter/scroll retention, reload, and desktop/mobile rendering.
