# Play context review and recalculation

## Saving an edited play

Save Changes recalculates the edited play's ending context from its recorded
starting context and revised result, updates statistics and drive totals, and
refreshes live entry from the latest accepted ending context. Later Game Control
ball/possession corrections are applied in order and remain authoritative.
Saving resets the quick-input state so its next play uses the corrected state.
Starting context, entered clocks, event identity, and final status stay intact.
An explicitly edited first-down credit is honored; a copied calculated credit
is recomputed when the play outcome changes.

The latest play does not require a separate Recalculate click. For example,
editing a five-yard run from the 21 to a six-yard run ending at the 27 immediately
shows second-and-four. The following run to the 30 counts as three yards, giving
nine rushing yards and third-and-one. Existing later plays retain their recorded
starts and are flagged for the per-play repair workflow below. Saving an older
play uses the latest ending context for live entry, not the older edited play.

## Repairing recorded starting contexts

The game log marks a play **Context mismatch** when its recorded starting
possession, down, distance, spot, line to gain, or goal-to-go status differs from
the preceding ending context. Quarter tabs do not limit this check. Clock values
and drive counters are not mismatch criteria.

In the play editor, **Recalculate this play** shows the recorded and expected
starting contexts, copies the expected context into this play, and recalculates
its ending context from its recorded result and penalties. Calculated first-down
and unconfirmed penalty-outcome shortcuts are discarded. Confirmed penalty
outcomes remain authoritative. Following plays keep their recorded contexts and
are checked again; the operator can repair the resulting chain one play at a time.

Older events without `postState` are projected from their own `preState`.
Game Control records act on the preceding result. Explicit ball-context,
possession, and drive-start corrections become authoritative; timeouts and clock
changes cannot restore an obsolete starting context or change possession to the
team calling timeout.

Each repair preserves event IDs, sequence numbers, entered clocks, final status,
and player identities. Context-only repairs preserve the existing description.
Statistics and drive totals are rebuilt. The current ball context changes only
when there are no subsequent plays, with trailing controls still applied.
Persistence uses the existing local save, full-envelope mirror, and Undo Last
Change workflow. Loading or displaying a flag never edits the game.

Unsaved detail edits must be saved or reset before recalculation. A missing or
incomplete history cannot supply a reliable preceding context. If the expected
team conflicts with the recorded players, or a changed starting spot requires
reinterpreting kicks, penalties, turnovers, fumbles, or laterals, the editor
directs the operator to Replace This Play to confirm those details. Simple
scrimmage yardage can be recomputed from the recorded ending spot.

A drive's first snap is checked against the preceding result just like any
other play. There is no unconditional reset to ten yards: a valid goal-to-go
context or a penalty after the series was established remains intact.

Regression coverage includes the kickoff 1st-and-20 mismatch, a two-yard run
from 1st-and-10 followed by a three-yard run from 2nd-and-8, explicit Game Control
corrections, administrative records, quarter transitions, missing ending states,
stale-editor protection, statistics, Undo, reload, and full-envelope mirroring.
