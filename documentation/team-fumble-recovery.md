# Team fumble recovery

At the recovery-player prompt, choose **T — Team recovery (no player)**, then enter the spot awarded to the recovering team. Player jersey entry remains available. A team recovery skips the return question because no player returned the loose ball. The existing own-goal clarification still handles a safety or touchback. The shared recovery flow supports rushes, passes and kicks.

The play editor's **Recovered by** field includes the same team choice. Saving synchronizes recovery references, removes any old recovery actor, and regenerates the description. Switching back to a player restores a roster-resolved actor. A recorded player return must be removed by replacing the play before crediting that recovery to the team.

The canonical fumble retains `recoveredByTeam` and stores `recoveredByPlayerId: "TM"`, with no synthetic player participant. The original fumbler keeps the fumble charge. An offense retaining the ball keeps its drive and normal down progression; it has no fumble lost or defensive takeaway. Team recovery counts are derived in `stats.teams[team].fumbles.teamRecoveries`. An actual opposing-team recovery appears on a TEAM row in the defensive report, with zero return yards.

XML emits `FUMB:...TM` and `p_fumb` with the recovery team and `frname="TEAM"`, including retained offensive fumbles. A TEAM aggregate entry identifies the credit without assigning it to a roster player. Defensive recovery totals only increment for an opposing-team recovery.

Validation: 90 scorer test files / 1,241 tests and 45 XML/report tests. Coverage includes player-free team recovery, correct next down and possession, retained fumble statistics, editor changes in both directions, recovery actor cleanup, report credit and XML schema validation. No production game is changed by this feature release.
