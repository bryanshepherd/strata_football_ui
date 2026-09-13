# Challenge readouts

Challenge descriptions use the recorded challenging team, independently of possession. Initiation reads `{TEAM} is challenging the previous play.` Resolutions identify that team and explicitly describe a successful/unsuccessful challenge or a ruling that stands, is confirmed, or is overturned.

The shared formatter is used for new summaries, existing scorer descriptions, report display, and the generated dashboard XML module. Repairing older text preserves the original ruling, clock, ball context, and event identity.

XML replaces an initiation with the matching team's subsequent resolution and omits the separate resolution row. It pairs only reviews before another football play occurs. Unresolved initiations and unpaired outcomes remain visible. Both saved events remain intact for challenge and timeout accounting.

Successful/overturned challenges now record a pending rescore linked to the challenged play. The scorer asks the operator to confirm the target and enter the corrected play through Replacement Entry. Cancellation leaves the saved play unchanged; pending corrections resume after refresh, and normal scoring pauses until they are complete. Older overturned challenge entries have a Rescore action in the game log.

The complete original event is retained under `envelope.playHistory`, with a history ID, challenge event ID, replacement event ID, timestamp and `overturned` status. The corrected event occupies the original active event position/number, with a source link back to its history record. The game log exposes the original as an expandable historical entry. Only active events feed statistics, participation and XML.

Corrections recalculate scores, drive totals and subsequent contexts. Explicit operator context corrections remain authoritative. If another play requires new actors or penalty/kick enforcement, Replacement Entry continues with that play; the entire batch remains uncommitted until finished. A changed game during a batch requires restarting against the latest envelope. Undo Last Change restores the whole pre-correction envelope.

New play events retain their prior live context and scores for accurate restoration, including an overtime series ended by an overturned score. Existing games fall back to their recorded starting context. The existing challenge and timeout totals are preserved during rescore replay rather than charged again.
