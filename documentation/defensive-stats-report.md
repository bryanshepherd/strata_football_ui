# Defensive Stats report

Available in the scorer Reports menu and the dashboard Football reports list as
`defensive-stats`. It uses the common selected-game report loader and the existing
Suite header / Football footer branding.

Visitor and home tables print every player with a nonzero displayed defensive
stat, ordered by total tackles descending, then solo tackles, jersey number, and
name. Missing numbers do not exclude players. Columns are #, Name, Solo, Ast,
Total, Sacks-Yds, TFL-Yds, FF, FR-Yds, Int-Yds, BrUp, Blks, QBH. Totals appear
under each team. Blks includes punts, field goals, and extra points.

Attribution reuses the MaxPreps defensive event calculation. Sack and TFL yardage
shares retain fractional credit; display rounds to at most two decimal places.
Only accepted active events contribute. Superseded challenge history and cached
player totals are not added back into the report. Previous-spot nullified plays
are suppressed by the shared calculation.

The report uses letter portrait with natural pagination, repeating table headers
and keeping rows together. There are no forced breaks between teams or player
limits. Names wrap rather than being truncated. A longer report continues onto
additional pages with reserved margins for the branding footer.
