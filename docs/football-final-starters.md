# Correcting starters after a final game

Game Control offers Starters (R) after the game is final. It opens the existing
team selector and 11-slot offense/defense editor. Save uses the same local
envelope persistence and mirror queue as pregame starter entry.

The correction survives reload and updates the starter lists used by the
Participation report, Report Packet and XML. Automatic participation follows
the current starters, play/penalty actors and statistics. Removing an incorrect
starter does not remove that player's recorded plays or statistics.

Final-game Game Control exposes abbreviations, participation and starters only.
Ordinary scoring and game-state commands remain locked. Editing starters keeps
the game final and preserves wrap-up data, scores, play history and ball context.
