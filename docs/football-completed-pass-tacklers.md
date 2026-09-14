# Completed-pass tackle retention and recovery

Completed passes selected tacklers in quick input and retained their names in the readout, but the canonical completed-pass builder saved an empty `participants.defenders` list. Reports, participation, and XML therefore missed those credits.

The builder now saves selected defenders on completed passes. `result.passDefenseRecorded` marks an explicit selection, including no tacklers; completed-pass editor saves set the same marker so later operator corrections or removals remain authoritative.

For accepted legacy completed passes with no recorded selection and no defenders, the shared pass-defense repair recovers a tackle clause only when every jersey and full name uniquely matches the defending roster. Ambiguous, unknown, or partially resolved shared tackles are left unchanged. Penalty actors are excluded. Recovery is idempotent and respects deleted events and existing structured defenders. Existing accepted previous-spot penalty exclusions still govern statistical credit.

The same repair feeds the scorer, play editor, defensive/participation reports, Review Plays, and dashboard XML. It operates on the report/export projection without writing to the production mirror or changing game status, score, plays, clocks, context, drive calculations, or wrap-up data. New scorer submissions persist the structured actors normally.

## Validation — September 14, 2026

- Scorer: 94 test files, 1,278 passing tests, and production build.
- Football XML: 47 passing tests, including schema validation, shared-tackle/DNP recovery, explicit removal, and unresolved shared-tackle exclusion.
- Sidearm delivery and public/report XML feeds: 22 passing tests; focused football XML typecheck.
- Read-only Livingstone–Bluefield State game mirror at revision 278: 15 completed passes recover 20 individual tackle credits. Livingstone totals become 41 solo + 32 assists = 73, TFL 15 for 67 yards; Bluefield State becomes 25 solo + 14 assists = 39, TFL 5 for 21 yards. Sacks, all non-defensive team statistics, final 44–30 score, drives, and context remain unchanged.
- Joseph Flood receives two solo tackles (one TFL for three yards). Xzaivion Betts receives three solo tackles and appears as a participant rather than DNP. Joshua Jackson has 11 total tackles and 3 TFL for 11 yards.
- The independent acceptance fixture gains 35 tackle XML entries and four participating defenders formerly classified DNP: Keyshon Washington, Daesean Jackson, Jeremiah Covington-Griggs, and Connor Lowe. All 114 roster entries remain present exactly once.

The general dashboard typecheck still reports unrelated existing errors outside the football XML scope; the focused football XML check and production Next build are the release checks.
