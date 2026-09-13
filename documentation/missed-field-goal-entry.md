# Missed field-goal entry

After a missed field goal's descriptive reason, ask **Returned (R)** or **Spot the ball (S)**. A blocked field goal asks the same question after the blocker is recorded. These choices are available regardless of the legacy `fgReturn` setting. Made kicks keep their existing flows. NCAA missed/blocked extra points ask **Attempted Return (Y)** or **No Return (N)** after the miss reason or blocker. The NCAA preset enables try returns even when older return flags are missing; NFHS does not offer defensive try returns. Legacy/custom games retain their explicit try-return setting.

- **Returned** collects the returner, starting spot, return outcome, and final spot through the existing field-goal return flow, including its tackle, lateral, and fumble branches.
- **Spot the ball** requires the yardline where the receiving team will begin possession. The field is prefilled and selected with the previous line of scrimmage, so Enter confirms it and typing replaces it with the officials’ awarded spot. This is a suggestion, not automatic NCAA enforcement: the operator can adjust a kick inside the 20 or another special outcome. The existing projection starts the receiving team's drive with first down and the configured distance to gain, or goal to go when appropriate.

The spot of the kick remains in `result.kick.kickSpot`, with the original attempt distance in `result.kick.attemptYards`. The entered next spot is stored separately in `result.endYardLine`, with the receiving team in `result.nextPossession`. This fixes the former fallback that reused the kick spot as the next possession's spot. It does not create a Game Control correction or convert the attempt into a punt.

The normal play summary, attached-foul possession questions, submission, possession-clock prompt, and local envelope persistence continue to apply. Editing the draft clears the prior next spot so the proposed spot must be confirmed again. Existing saved plays and explicit Game Control corrections are not rewritten by this change.

## Verification

Regression coverage checks both R/S buttons and keyboard shortcuts, return availability with missing/false/true legacy flags, all miss descriptions, blocked attempts, invalid/goal-line spot rejection, team aliases, ordinary and goal-to-go drive starts, retained kick distance, and the existing penalty-on-change-of-possession flow. Additional regressions cover accepting the previous scrimmage spot, replacing it, team alias display, NCAA/NFHS preset behavior, and a missed extra-point return ending in the field or scoring two points while retaining the original kicking team for the next kickoff.

Rules reference: [2026 NCAA Football Rules Book](https://ncaa.soutronglobal.net/Public/Default/en-US/RecordView/Index/60556), Rule 8 scoring and field-goal provisions. The operator confirms the awarded field-goal spot rather than the app silently enforcing an inferred spot.
