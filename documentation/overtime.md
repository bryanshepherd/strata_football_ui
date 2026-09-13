# Possession overtime

The scorer now owns overtime in its local envelope. The separate dashboard scorer implementation is not the production embedded scorer.

End Q4 through Quarter Functions. A tied game with possession overtime enabled remains in progress and opens the overtime confirmation. Choose the team that the officials award first offense to, confirm the spot, and start. Every later series opens the same confirmation with the other team fixed; a new round asks for the officials' first-offense choice again. The normal Game Control corrections are not needed. The confirmation accepts a penalty-adjusted spot.

For NCAA games, OT1/OT2 start at the opponent 25. OT2 requires two-point tries following touchdowns. OT3 and later consist of one two-point try per team from the opponent 3. There are no kickoffs; scores, missed kicks, turnovers and failed fourth downs advance the possession. A winning second-series touchdown or a defensive score outside a try ends the game immediately. Replayed tries remain active. Each team has one timeout in OT1, one in OT2, and one shared across OT3 and all subsequent rounds (2026 rule). The clock remains untimed, and the scoreboard displays the overtime round.

Overtime round, series, first team and next team are stored in `liveState.overtime`, so save/reload and the normal envelope mirror retain them. A tied game incorrectly marked final by the previous scorer can reopen directly into overtime confirmation after refresh. Actual completed game data is not rewritten by deployment.

The NFHS preset uses the basic opponent-10 possession series with one timeout per round; state-specific variations are not certified by this change. Timed-period overtime is outside this possession-series implementation.

Reference: [2026 NCAA Football Rules Book, Rule 3-1-3](https://ncaa.soutronglobal.net/Public/Default/en-US/RecordView/Index/60556).

Verification includes the actual scorer shell confirmation, local projection, first and later rounds, touchdowns/tries, field goals, interceptions, fumbles, fourth downs, defensive scores, replayed tries, timeouts, saved-state normalization, invalid kick guards, and XML final/quarter output. Existing local-authority and normal-regulation behavior remain covered by the full scorer suite.
