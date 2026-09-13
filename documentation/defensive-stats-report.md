# Defensive Stats report

Available in the scorer Reports menu and the dashboard Football reports list as
`defensive-stats`. It uses the common selected-game report loader and the existing
Suite header / Football footer branding.

Visitor and home tables print every player with a nonzero displayed defensive
stat, ordered by total tackles descending, then solo tackles, jersey number, and
name. Missing numbers do not exclude players. Columns are #, Name, Solo, Ast,
Total, Sacks-Yds, TFL-Yds, FF, FR-Yds, Int-Yds, BrUp, Blks, QBH. Totals appear
under each team. Blks includes punts, field goals, and extra points.
BrUp is pass breakups; QBH is quarterback hurries.

Incomplete passes retain breakup/hurry player IDs and defender roles through the
canonical event builder. Older plays whose descriptions contain these credits
recover the missing references only when the defending roster's number and name
uniquely match. Explicit replacements and cleared credits take precedence over
old descriptions. The same recovery serves the standalone report, Report Packet,
MaxPreps export, participation and play editing; no saved game is rewritten just
to display a report. Editing hurries keeps the participant list, statistic IDs
and play description aligned. A player can receive one of each credit on a play.

Attribution reuses the MaxPreps defensive event calculation. Sack and TFL yardage
shares retain fractional credit; display rounds to at most two decimal places.
Only accepted active events contribute. Superseded challenge history and cached
player totals are not added back into the report. Previous-spot nullified plays
are suppressed by the shared calculation.

The report uses letter portrait with natural pagination, repeating table headers
and keeping rows together. There are no forced breaks between teams or player
limits. Names wrap rather than being truncated. A longer report continues onto
additional pages with reserved margins for the branding footer.
