# Turnover returns and drive scoring

A defensive touchdown does not turn the opposing offense's drive into a scoring
drive. Fumble and interception returns close that drive as `turnover`; the Drive
Chart labels the loss as Fumble or Interception. A punt return closes the kicking
team's drive as Punt. The scoring team still receives the touchdown and ensuing
try setup, without creating a synthetic offensive drive for the return.

Drive yardage stops at the fumble loss spot or the line of scrimmage for an
intercepted pass. Return yards belong to the returning player. The saved-game
normalizer repairs older touchdown-labeled drives while retaining their recorded
play counts and clocks. Drive Chart and red-zone calculations also handle an
unrepaired envelope directly. Recalculating an edited drive retains its corrected
ending result.

Points Off Turnover includes fumble/interception return touchdowns and points
scored by the same team on the associated try, plus offensive scores on a drive
obtained through a fumble or interception. It excludes ordinary punt/kickoff
returns, possession gained on downs, missed field goals, nullified or deleted
plays, and an opponent's score on the same drive. Replayed tries retain their
touchdown association without duplicating points; the next regular play clears
that association. Current drives are included if a scoring event is already
recorded before the drive metadata is finalized.

The standalone reports and Report Packet use these same calculations. Building
a report does not rewrite the saved envelope or alter the game's actual score.
