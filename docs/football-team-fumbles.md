# Team fumbles in Individual Offense

Individual Offense includes a Team row in its Fumbles table for accepted,
team-charged fumbles, including aborted plays. The row contributes to NUM and
LOST totals and is shared by the standalone report and Report Packet.

An aborted play nullified by an accepted previous-spot penalty does not count.
Deleted events and overturned historical originals do not count. An individual
player's fumble recovered by the team stays charged to that individual; a team
recovery alone never creates a Team fumble charge.

The report derives these values from the event ledger without changing the
saved game. The XML exporter likewise includes team-charged fumbles in the
TEAM player aggregate and team totals.

Regression coverage checks retained and lost aborted-play fumbles, penalty
nullification, deleted events, individual fumbles with team recoveries, totals,
and preservation of the input envelope.
