# Football box-score XML reconciliation

The September 14 comparison of the Livingstone–Bluefield State Sidearm and Strata report packets exposed several export omissions and two report calculations that were inconsistent with individual statistics.

## Export contract

- Populate full-game first-down rushing, passing, and penalty categories from the same breakdown used by Team Stats. Quarter totals use the scorer event projection and classify against the complete series history.
- Derive red-zone opportunities from drives containing an offensive snap in the red zone. A long scoring play does not create a red-zone chance, and a defensive return touchdown is a failed offensive opportunity. Allocate a drive across quarters once, at its conclusion; retain current opportunities in live totals.
- StatCrew `sacka` is the number of assisted sacks, not fractional sack credit. Two solos and one assist serialize as `sackua=2`, `sacka=1`, `sacks=2.5`. Split loss yards once among recorded defenders. For odd-yard losses, assign the extra yard in recorded defender order, preserving whole yards and the team sum. The NCAA statistics manual permits the statistician to allocate the odd yard: https://fs.ncaa.org.s3.amazonaws.com/Docs/stats/Stats_Manuals/Football.pdf
- Accept both interception subtype spellings and populate team and player `ir`, `defense.int`, and `defense.intyds` along with the passer's interception charge.
- Derive gross kickoff distance when older touchbacks lack kickYards; exclude nullified re-kicks. Include field-goal and PAT blockers in defensive totals. Preserve the scorer's Points Off Turnover calculation.
- Use FGA for a missed field-goal drive result and acquisition, keeping FG for a made field goal. Serialize the safety's recorded loss distance instead of omitting yds; existing StatCrew safety examples include this attribute.
- Repair a legacy fumble-return rushing endpoint only in the report/export projection. Compute drive yards from the start and actual fumble spot, so an already-correct drive is not reduced a second time.

## Shared report calculations

`scripts/build-football-report-stats.mjs` generates the dashboard helper from scorer source. Team Stats now applies the existing offensive fumble-return yardage correction, resolves fumble return team from the recovering team, and excludes replayed kickoffs and punts from supplemental counts. Defensive reports and XML share whole-yard split behavior. No saved play, score, clock, ball context, roster, starter, or final status is rewritten.

## Game validation

Read-only mirror revision 278, 174 events, FB-eda8397c-c417-4446-abbd-59d0e9c53e59:

| Statistic | Livingstone | Bluefield State |
| --- | --- | --- |
| First downs (rush/pass/penalty) | 14 (5/5/4) | 20 (8/10/2) |
| Red-zone scores/chances | 1/1 | 2/4 |
| Rushing / total offense yards | 121 / 303 | 134 / 423 |
| Kickoffs / gross yards | 9 / 579 | 5 / 283 |
| Interceptions / yards / TD | 1 / 95 / 1 | 0 / 0 / 0 |
| Defensive sacks / yards | 9 / 56 | 3 / 14 |
| Defensive blocked kicks | 1 | 2 |
| Fumble returns / yards / TD | 1 / 92 / 1 | 0 / 0 / 0 |

Joshua Jackson: 2.5 sacks for 10 yards. Bluefield's final first-half drive starts FGA. The safety score contains yds=3. The fumble-ending drive retains 67 yards.

## Remaining source-data differences

The stored first Bluefield drive starts at H28 while its first snap is H35, and some saved play clocks differ from completed-drive clocks (including the made field goal). These are saved context/timing differences, not missing XML fields. They require operator review before changing historical game data. Sidearm PDF display itself must be rechecked after importing the corrected file; local exporter tests cannot prove a third-party import occurred.
