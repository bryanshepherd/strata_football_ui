# Coin-toss captains in play-by-play and XML

Print saved coin-toss captains before the first-quarter toss result, away team then home team, with one line per team: `Team Captains: Number - Name, Number - Name`. Omit a team's line when no captains were entered. Report Packet reuses the same play-by-play rows.

`footballCoinTossReadout.js` owns captain resolution and toss wording. Resolve selections by player ID within their team, preserving duplicate-jersey player identities, selected order, and jersey zero. Prefer current roster details and retain saved selection details when the roster entry is unavailable. This is display-only; do not add captain selections to participation or game events.

The generated dashboard helper exports the same lines to XML. Each line is a separate type `#`, `CMT:` informational row before the opening kickoff, with identical context and newcontext and no clock, score or actor elements. Pregame rows use drive/play zero and unique XML sequence numbers; the dashboard report parser excludes them from the play count.

Validation: 90 scorer test files / 1,235 tests and 44 dashboard XML/report tests pass. Production scorer build passes. Livingstone at Bluefield State mirror revision 261 produces all seven saved captains in the expected order; browser checks verify separate lines in play-by-play and Report Packet. XML schema validation passes and parsed totals, last play and the source envelope remain unchanged.
