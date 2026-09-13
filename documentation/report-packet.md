# Report Packet

The scorer Reports menu and dashboard Football reports list include `report-packet`.
One Print / Save PDF action prints the following existing reports, in order:

1. Scoring Summary
2. Team Stats
3. Offensive Individual (Individual Offense)
4. Defensive Individual (Defensive Stats)
5. Drive Chart
6. Penalty Report (Penalty Chart)
7. Participation
8. Play-By-Play

The packet loads and normalizes one selected-game envelope through the shared
FootballReportLoader. Scorer links retain `source=local`; dashboard links fetch
the selected server game. All sections are built from that same loaded envelope.
There are no additional per-section requests or saved-game mutations. A loading
failure shows the shared error/retry state instead of sample or partial reports.

The packet reuses the standalone reports' builders and printable page components.
The full Drive Chart includes team breakdowns and the chronological ledger; the
Penalty Chart includes both teams. Play-By-Play retains all quarters and overtime,
including its existing per-quarter Quickie pages. Leftover quarter/scope URL
parameters do not limit the packet.

Each report starts on a new printed page and retains its internal page structure.
Long content continues naturally. Packet printing uses one page profile and one
branding footer, with repeated clearance below content to prevent overlapping
standalone footers. Standalone report formatting is preserved.
