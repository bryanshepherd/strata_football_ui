# Penalty names in saved plays and reports

RTK is Roughing the Kicker; BSB is Illegal Blind-Side Block. Both now have codes in the existing NCAA/NFHS catalog, with the existing rule definitions unchanged.

The quick-input canonical mapper previously dropped the selected penalty name. The two catalog entries also had blank codes, leaving the summary grammar unable to resolve saved RTK/BSB entries. The penalty chart used a separate legacy lookup and accepted an already abbreviated narrative as a full name.

The mapper now retains the selected name with the code. Shared display resolution preserves explicit operator names and historical full names, then uses the active catalog and legacy fallbacks. Unknown codes remain visible. Code changes in the play editor refresh the name; saving regenerates the narrative and confirmation while retaining explicitly entered wording.

Existing readouts replace only code-only foul-name clauses, including immediate penalties, multiple fouls, and confirmation text. The game log normalization, Penalty Report, Play-By-Play, Report Packet and XML projection share this behavior. Reading reports or exporting XML does not modify the saved mirror. Context, enforcement, yards, player references and XML penalty tokens remain unchanged.

The XML helper is generated from the scorer with `scripts/build-football-actor-repair.mjs`; regenerate it when changing the shared repair or summary grammar.

Validation: 89 scorer test files / 1,169 tests; 43 dashboard XML/report tests; production scorer build. Checked the selected Bluefield State–Livingstone game mirror revision 257: play 61 BSB and play 81 RTK have expanded names in the editor save, standalone reports, packet and XML; original data and ball contexts are preserved. No direct game-record repair is required.
