# Football Lateral Stat Allocation

## Purpose

This document defines how Football Confirmed Quick Input models laterals and how downstream stat projection should allocate yards across the original play or return family, the lateral exchange, and the continuing ball carrier.

Laterals are a global live-ball continuation mechanic. They are not pass-specific and should not be modeled as a special branch of only completed passes.

## Scope

Laterals can occur on any live-ball play family, including:

- Rush
- Pass
- Fumble return
- Interception return
- Kickoff return
- Punt return
- Field goal return
- Any other return or live-ball continuation

Kickoff and punt receiving use a separate Kick Receive result model. Touchback, fair catch, and downed receive results are terminal receive outcomes and do not enter this lateral allocation model. Kickoff return and punt return lateral allocation begins only after Kick Receive `R` Return starts a live return.

FCQI should store spots and participants. The projection/stat layer should derive official stat allocation later from those typed fields.

Universal allocation rule:

- The original play or return family owns the first advancement segment.
- On rushes and returns, the lateral exchange itself is miscellaneous yards.
- On a completed forward pass, receiving yards are split at the spot where each backward pass is caught, and the passer keeps the full passing gain.
- The player receiving the lateral owns the next advancement segment in the continuation stat family.
- Receiving a lateral does not create a new attempt.
- The sum of all allocated segments must equal total play gain or return gain.

## General Lateral Model

Each lateral segment should carry:

- `lateralFromPlayer`
- `lateralToPlayer`
- `lateralFromSpot`
- `lateralToSpot`
- `continuationType`
  - `rush`
  - `receiving`
  - `fumbleReturn`
  - `interceptionReturn`
  - `kickReturn`
  - `puntReturn`
  - `fieldGoalReturn`
  - `misc`
- `continuationResult`
- `finalSpot` or a next lateral segment

Multiple laterals should be represented as ordered segments. A segment's `finalSpot` is terminal only when no next lateral segment exists.

## Core Allocation Rule

For rushes and returns, the lateral exchange itself creates miscellaneous yards:

```text
miscellaneous yards = lateralToSpot - lateralFromSpot
```

The player receiving the lateral receives yardage from:

```text
lateralToSpot -> next terminal spot
```

For every continuation segment after the lateral:

```text
continuation yards = nextTerminalSpot - lateralToSpot
```

The original play or return family owns the advancement before the lateral leaves the original player. A rush owns rushing yardage to the lateral-from spot, and a return owns return yardage to the lateral-from spot.

Completed passes are the exception to the lateral-exchange miscellaneous-yard rule. The passer receives the entire gain from the line of scrimmage to the dead-ball spot. The player who caught the forward pass receives one reception and receiving yards from the line of scrimmage to the spot where the backward pass is caught. Each subsequent lateral recipient receives no reception but does receive receiving yards from that catch spot to the next lateral catch spot or the dead-ball spot.

Receiving a lateral does not create a new attempt.

Do not treat all post-catch or post-return advancement as miscellaneous yards. Only the spot difference from `lateralFromSpot` to `lateralToSpot` is miscellaneous. The lateral receiver's advancement after receiving the lateral belongs to the continuation stat family.

## Continuation Stat Families

The continuation stat family controls how the lateral receiver's post-lateral advancement is allocated:

| Continuation type | Lateral receiver yardage |
| --- | --- |
| `rush` | rushing yards |
| `receiving` | receiving yards; a completed-pass lateral uses this family and creates no additional reception |
| `fumbleReturn` | fumble return yards |
| `interceptionReturn` | interception return yards |
| `kickReturn` | kickoff return yards |
| `puntReturn` | punt return yards |
| `fieldGoalReturn` | field goal return yards |
| `misc` | miscellaneous yards |

No additional rushing, receiving, or return attempt is charged merely because a player receives a lateral.

## Completed Pass Lateral Example

```text
LOS H30 = engine 30
Catch H40 = engine 40
Lateral received H38 = engine 38
Final V35 = engine 65
```

Stats:

- QB passing yards = 35
- WR receiving yards = 8 and one reception
- RB receiving yards = 27 and no reception
- Team miscellaneous yards = 0
- Rushing yards = 0
- Total play gain = 35

Accounting:

```text
8 receiving + 27 receiving = 35
65 - 30 = 35
```

The original receiver gets receiving yards through the spot where the backward pass is caught. The next player receives receiving yards but no reception. The team and passer retain the full passing gain.

## Rush Lateral Example

```text
Start H30
Runner laterals at H40
Lateral received at H38
Second runner ends at V35
```

Stats:

- Original rusher rushing attempt: 1
- Original rusher rushing yards: 10
- Team miscellaneous yards: -2
- Lateral receiver rushing yards: 27
- Lateral receiver rushing attempts: 0
- Total play gain: 35

Accounting:

```text
10 rushing + (-2 misc) + 27 rushing = 35
65 - 30 = 35
```

Only the original rusher receives the rushing attempt. The second runner receives rushing yards after the lateral but no attempt.

## Interception Return Lateral Example

```text
Interception at H45 = engine 45
Interceptor laterals at V45 = engine 55
Lateral received at midfield = engine 50
Second returner ends at V30 = engine 70
```

Stats:

- Original returner interception return yards: 10
- Team miscellaneous yards: -5
- Lateral receiver interception return yards: 20
- Lateral receiver interception return attempts: 0
- Total return gain: 25

Accounting:

```text
10 interception return + (-5 misc) + 20 interception return = 25
70 - 45 = 25
```

## Fumble Return Lateral Example

```text
Fumble recovered at H35 = engine 35
Recoverer laterals at H45 = engine 45
Lateral received at H43 = engine 43
Second returner ends at V40 = engine 60
```

Stats:

- Original returner fumble return yards: 10
- Team miscellaneous yards: -2
- Lateral receiver fumble return yards: 17
- Lateral receiver fumble return attempts: 0
- Total return gain: 25

Accounting:

```text
10 fumble return + (-2 misc) + 17 fumble return = 25
60 - 35 = 25
```

## Kickoff Return Lateral Example

```text
Kick return starts at H10 = engine 10
Returner laterals at H28 = engine 28
Lateral received at H25 = engine 25
Second returner ends at H42 = engine 42
```

Stats:

- Original returner kickoff return yards: 18
- Team miscellaneous yards: -3
- Lateral receiver kickoff return yards: 17
- Lateral receiver kickoff return attempts: 0
- Total return gain: 32

Accounting:

```text
18 kickoff return + (-3 misc) + 17 kickoff return = 32
42 - 10 = 32
```

## Punt Return Lateral Example

```text
Punt return starts at H20 = engine 20
Returner laterals at H35 = engine 35
Lateral received at H33 = engine 33
Second returner ends at H48 = engine 48
```

Stats:

- Original returner punt return yards: 15
- Team miscellaneous yards: -2
- Lateral receiver punt return yards: 15
- Lateral receiver punt return attempts: 0
- Total return gain: 28

Accounting:

```text
15 punt return + (-2 misc) + 15 punt return = 28
48 - 20 = 28
```

## Field Goal Return Lateral Example

```text
Missed field goal return starts at H5 = engine 5
Returner laterals at H22 = engine 22
Lateral received at H20 = engine 20
Second returner ends at H39 = engine 39
```

Stats:

- Original returner field goal return yards: 17
- Team miscellaneous yards: -2
- Lateral receiver field goal return yards: 19
- Lateral receiver field goal return attempts: 0
- Total return gain: 34

Accounting:

```text
17 field goal return + (-2 misc) + 19 field goal return = 34
39 - 5 = 34
```

## Multiple Laterals

Multiple laterals produce multiple miscellaneous-yard segments.

Example:

```text
Start H30 = engine 30
Carrier A laterals at H40 = engine 40
Carrier B receives at H38 = engine 38
Carrier B laterals at V48 = engine 52
Carrier C receives at midfield = engine 50
Carrier C ends at V35 = engine 65
```

Stats:

- Carrier A family yards: 10
- First miscellaneous segment: -2
- Carrier B continuation yards: 14
- Second miscellaneous segment: -2
- Carrier C continuation yards: 15
- Total play gain: 35

Accounting:

```text
10 + (-2) + 14 + (-2) + 15 = 35
65 - 30 = 35
```

## Sanity Check

The sum of all allocated stat segments must equal:

```text
terminalSpot - startSpot
```

Implementations should use the same canonical field-position normalization for every segment. If a play's direction of advance requires signed yard conversion, apply that conversion consistently to the original segment, miscellaneous lateral segment, continuation segment, and total-play sanity check.

## FCQI And Event Builder Boundaries

FCQI should collect and validate:

- lateral participants
- lateral-from spot
- lateral-to spot
- continuation type
- continuation result
- final spot or next segment

FCQI should not calculate official stat allocation beyond optional preview math. The Event Builder should preserve the lateral segment data in the canonical draft event and reject incomplete lateral continuations. Projection/stat engines should allocate rushing, receiving, return, and miscellaneous yards from the typed segment data.

## Summary Wording Boundary

FPSG should summarize the lateral sequence in human-readable order, but the summary text is not the stat source of truth. Downstream layers must allocate stats from typed lateral fields and canonical spots, not from prose.
