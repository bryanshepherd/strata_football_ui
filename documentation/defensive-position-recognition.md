# Defensive position recognition

Starter selection and play entry share defensive position recognition through `src/utils/footballPositions.js`. Both contextual duplicate-jersey lookup and its position-priority helper use the same keys. Operator-entered position labels remain unchanged in the roster and reports.

The configured meanings are:

- NG: Nose Guard.
- NT: Nose Tackle.
- WS: Wide Safety.
- MIKE, WILL, SPUR, NKL and RVR (Rover): DB aliases for recognition and recommendation priority, as specified by the operator.

The existing DE, DT, DL, LB, CB and safety abbreviations remain supported, with left/right defensive line and linebacker variants, EDGE, nickel/dime labels and full position names. Recognition ignores capitalization, surrounding whitespace and punctuation; slash-separated positions can match either listed role. Unknown labels do not acquire a defensive classification through partial-word matching.

Duplicate-number prompts continue to show all active candidates. The recommendation favors the defender for defensive entry and preserves offensive recommendations and roster ordering for ties. This does not automatically choose a duplicate player during play entry.

Validation: all 22 saved defensive starters in Bluefield State–Livingstone mirror revision 259 are recognized, including the eight starter jersey numbers with duplicate active candidates. Tested all seven previously missing labels through the starter modal; tested the operator-defined DB aliases, Nose Guard, Nose Tackle and Wide Safety; 89 test files / 1,229 tests pass. Production scorer build passes. Reading and checking the roster does not modify the saved game.
