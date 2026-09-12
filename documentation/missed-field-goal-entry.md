# Missed field-goal entry

After a missed field goal's descriptive reason, ask **Returned (R)** or **Spot the ball (S)**. A blocked field goal asks the same question after the blocker is recorded. These choices are available regardless of the legacy `fgReturn` setting. Made field goals and PAT entry keep their existing flows.

- **Returned** collects the returner, starting spot, return outcome, and final spot through the existing field-goal return flow, including its tackle, lateral, and fumble branches.
- **Spot the ball** requires the yardline where the receiving team will begin possession. This is the officials' awarded spot; the scorer does not infer it from the miss description or rules preset. The existing projection starts the receiving team's drive with first down and the configured distance to gain, or goal to go when appropriate.

The spot of the kick remains in `result.kick.kickSpot`, with the original attempt distance in `result.kick.attemptYards`. The entered next spot is stored separately in `result.endYardLine`, with the receiving team in `result.nextPossession`. This fixes the former fallback that reused the kick spot as the next possession's spot. It does not create a Game Control correction or convert the attempt into a punt.

The normal play summary, attached-foul possession questions, submission, possession-clock prompt, and local envelope persistence continue to apply. Editing the draft clears the prior next spot so it must be entered again. Existing saved plays and explicit Game Control corrections are not rewritten by this change.

## Verification

Regression coverage checks both R/S buttons and keyboard shortcuts, return availability with missing/false/true legacy flags, all miss descriptions, blocked attempts, invalid/goal-line spot rejection, team aliases, ordinary and goal-to-go drive starts, retained kick distance, and the existing penalty-on-change-of-possession flow. Browser QA uses a disposable copy of the reported game's pre-play-54 context and checks both spotting at V20 and a V04-to-V28 return, plus reload persistence.
