# Participation report

Available as `participation` in the scorer Reports menu and dashboard Football
reports list. It uses the shared selected-game loader, Suite header and Football
footer.

Away is on the left; home is on the right. Each team has Offensive starters above
Defensive starters, with Pos, # and Name columns. Starter order follows the saved
starter selections. Positions use the saved offensive/defensive position, falling
back to the roster position. A two-way starter appears in both relevant tables.

Other participants are listed below the starter tables in jersey-number order.
The report uses the same `footballParticipationForEnvelope` helper as Game
Control: starters, play/penalty actors, players with stats, and manually selected
participants count as played. Displayed offensive/defensive starters are omitted
from the other-participants list. A special-teams-only starter is included in that
list. Previously participating players remain included if later marked inactive.
Duplicate jersey numbers retain separate player identities; missing numbers do
not remove a player. The total counts each player once.

The report does not infer starters from play order or add overturned history. It
does not change saved starters, participation or game state. Empty units state
that no starters were entered. Longer lists flow onto additional pages with no
player limit and reserved footer space.
