# 10-Glossary-and-Domain-Notes.md - Terms and Domain Knowledge

## Football Terminology

### Basic Game Concepts

**Down**: One of four attempts a team has to advance the ball 10 yards
- **1st and 10**: First down with 10 yards needed
- **4th and inches**: Fourth down with very short distance

**Distance**: Yards needed to achieve first down
- **Goal-to-go**: When distance equals or exceeds remaining yards to goal line
- **Short yardage**: Typically 3 yards or less

**Field Position**: Location on the 100-yard field
- **Own territory**: Team's defending half (H1-H50)
- **Opponent territory**: Attacking half (V1-V49)
- **Red zone**: Within 20 yards of opponent's goal line

**Possession**: Which team currently has the ball
- **Offense**: Team with possession
- **Defense**: Team without possession

### Yard Line Notation

**Format**: `[Team][Number]` or `50`
- **H35**: Home team's 35-yard line (65 yards from their goal)
- **V20**: Visitor team's 20-yard line (80 yards from their goal)  
- **50**: Midfield (50 yards from both goals)

**Direction Convention**:
- Lower numbers = closer to that team's goal line
- H1 = Home team's goal line
- V1 = Visitor team's goal line

**Possession-Relative Positioning**:
```javascript
// If Home has possession:
"H35" = Own 35-yard line
"V20" = Opponent 20-yard line (in red zone)

// If Visitor has possession:  
"V35" = Own 35-yard line
"H20" = Opponent 20-yard line (in red zone)
```

## Play Types and Result Codes

### Rush Plays
**Definition**: Running plays where ball carrier attempts to advance

**Result Codes**:
- **T**: Tackle - Runner brought down by contact
- **O**: Out of bounds - Runner stepped out
- **F**: Fumble - Ball carrier lost possession
- **.**: End of play - Touchdown, safety, or other score

### Pass Plays  
**Definition**: Plays where quarterback throws the ball forward

**Result Codes**:
- **C**: Complete - Pass caught by intended receiver
- **I**: Incomplete - Pass not caught
- **S**: Sack - Quarterback tackled behind line of scrimmage
- **F**: Fumble - Quarterback fumbled ball
- **X**: Intercepted - Defense caught the pass

**Pass Sub-results** (for complete passes):
- **T**: Tackled after catch
- **O**: Receiver went out of bounds
- **F**: Fumbled after catch
- **.**: Scored after catch

### Punt Plays
**Definition**: Fourth down kicking play to give up possession

**Result Codes**:
- **R**: Returned - Receiving team returned the punt
- **D**: Downed - Punt team stopped ball without return
- **C**: Fair catch - Receiver signaled for no return
- **T**: Touchback - Punt into end zone, no return
- **M**: Muffed - Receiver dropped/mishandled punt
- **K**: Kicking error - Bad snap, blocked punt, etc.

### Kick Plays
**Definition**: Field goals, extra points, and kickoffs

**Field Goal/Extra Point Codes**:
- **G**: Good - Kick went through uprights
- **M**: Missed - Kick failed
- **B**: Blocked - Defense blocked the kick

**Kickoff Codes**:
- **R**: Returned - Receiving team returned kickoff
- **T**: Touchback - Kick into end zone, no return  
- **D**: Downed - Kick downed without return
- **O**: Out of bounds - Kick went out of bounds
- **N**: Onside - Short kickoff attempt
- **M**: Muffed - Receiving team mishandled kickoff

## Statistics Terminology

### Team Statistics

**First Downs**: Successful conversions resulting in new set of downs
- **Rushing first downs**: Via running plays
- **Passing first downs**: Via forward passes  
- **Penalty first downs**: Via defensive penalties

**Total Offense**: Combined rushing and passing yards
**Net Punting**: Average punt distance minus return yards
**Time of Possession**: How long each team held the ball

### Individual Statistics

**Quarterback Stats**:
- **Completions/Attempts**: 15/23 (15 completed out of 23 attempts)
- **Completion %**: Percentage of passes completed
- **Yards**: Total passing yards
- **TD/INT**: Touchdowns thrown / Interceptions thrown
- **Rating**: Quarterback efficiency rating

**Rushing Stats**:
- **Attempts**: Number of rushing plays  
- **Yards**: Total rushing yards
- **Average**: Yards per attempt
- **Long**: Longest rush
- **TD**: Rushing touchdowns

**Receiving Stats**:
- **Catches**: Number of receptions
- **Yards**: Receiving yards
- **Average**: Yards per catch
- **Long**: Longest reception
- **TD**: Receiving touchdowns

**Defensive Stats**:
- **Tackles**: Solo tackles + assisted tackles
- **Solo**: Unassisted tackles
- **Assists**: Assisted tackles
- **TFL**: Tackles for loss (behind line of scrimmage)
- **Sacks**: Quarterback tackles behind line

## Application-Specific Terms

### UI/UX Terms

**Input Assistant**: Help panel showing available actions and shortcuts
**Game Control Mode**: Administrative functions (timeouts, clock management)
**Flow**: Step-by-step play input workflow
**Modal**: Overlay window for play input
**HUD**: Heads-up display showing game status

**Event Controls**: Main control panel with play type buttons
**Drive Status**: Current drive statistics display
**Play Log**: Historical play-by-play list
**Roster Bar**: Team player listing

### Technical Terms

**Flow Context**: React context managing play input workflows
**Game Context**: React context managing core game state
**Clock Context**: React context managing game timing

**API Contract**: Standardized data transformation layer
**Roster Manager**: Player data caching system  
**Debug Mode**: Development logging and diagnostics

**Penalty Queuing**: Adding penalties to existing plays
**Disambiguation**: Resolving multiple players with same jersey
**Optimistic Update**: UI changes before server confirmation

## Data Structure Terms

### Game State Fields

**period**: Quarter number (1-4, 5+ for overtime)
**timeRemaining**: Clock time in "MM:SS" format
**possession**: 'H' (home) or 'V' (visitor)  
**down**: Current down (1-4)
**yardsToGo**: Distance needed for first down
**yardLinePosition**: Field position (H35, V20, 50)

### Play Data Fields

**playType**: Type of play (rush, pass, punt, kick, penalty)
**primaryPlayerID**: Main participant (rusher, passer, kicker)
**secondaryPlayerID**: Secondary participant (receiver, target)
**resultCode**: Outcome of play (T, O, F, C, I, etc.)
**yardsGained**: Net yardage on play
**endYardLine**: Final field position

### Flags and Modifiers

**is_first_down**: Play resulted in first down
**is_touchdown**: Play scored touchdown
**is_turnover**: Play changed possession
**is_safety**: Play scored safety
**has_fumble**: Play included fumble
**is_kickoff**: Special kickoff play handling

## Football Rules Context

### Down and Distance Rules

**First Down Achievement**:
- Advance ball 10+ yards from line to gain
- Defensive penalty with automatic first down
- Successful fourth down conversion

**Goal-to-Go Situations**:
- When yards to go ≥ distance to goal line
- Distance becomes yards to goal instead of 10

**Turnover Rules**:
- Interception: Defense gets ball at spot of catch
- Fumble recovery: Team recovering gets possession
- Turnover on downs: Defense gets ball at spot

### Clock Management

**Clock Stops On**:
- Incomplete pass
- Player goes out of bounds
- Penalty
- Timeout
- First down (briefly)
- End of quarter

**Clock Runs On**:
- In-bounds tackle
- Completed pass with tackle in bounds
- Rushing plays ending in bounds

### Special Situations

**Safety**: Offense tackled in own end zone (2 points to defense)
**Touchback**: Ball becomes dead in end zone (receiving team gets ball at 25-yard line)
**Fair Catch**: Receiving player signals no return on punt/kickoff

## Penalty Classifications

### Common Penalties

**Offensive Penalties**:
- **False Start**: Player moves before snap (5 yards)
- **Holding**: Illegal grabbing/restraining (10 yards)
- **Pass Interference**: Illegal contact on receiver (spot foul)

**Defensive Penalties**:
- **Offsides**: Player crosses line before snap (5 yards)
- **Pass Interference**: Illegal contact on receiver (spot foul)
- **Roughing the Passer**: Illegal hit on QB (15 yards + automatic 1st)

**Special Teams Penalties**:
- **Kick Catch Interference**: Hitting punt returner (15 yards)
- **Offsides**: Early rush on kick (5 yards)

### Penalty Enforcement

**Automatic First Down**: Certain penalties grant new first down
**Spot Foul**: Penalty enforced from where it occurred
**Previous Spot**: Penalty enforced from line of scrimmage
**Half Distance**: When penalty yardage would exceed half field distance

## Application Business Rules

### Data Validation Rules

**Jersey Numbers**: 0-99, must exist in roster or create unknown player
**Yard Lines**: Must match pattern H##|V##|50, number ≤ 50
**Down**: Must be 1-4
**Distance**: Must be 1-50 (typically)
**Time**: Must be valid MM:SS format

### Game Logic Rules

**Possession Changes**:
- Interception: Defense gets ball at spot
- Fumble recovery: Recovering team gets possession
- Turnover on downs: Defense gets ball at spot
- Score: Possession changes via kickoff

**Drive Tracking**:
- New drive starts with possession change
- Drive ends with possession change or score
- Statistics accumulated per drive

**First Down Calculation**:
- Line to gain = current position + distance
- First down achieved when ball advances past line to gain
- Distance resets to 10 (or goal line if closer)

## Position Abbreviations

### Offensive Positions
- **QB**: Quarterback
- **RB**: Running Back  
- **FB**: Fullback
- **WR**: Wide Receiver
- **TE**: Tight End
- **C**: Center
- **G**: Guard (LG, RG)
- **T**: Tackle (LT, RT)

### Defensive Positions
- **DE**: Defensive End
- **DT**: Defensive Tackle
- **NT**: Nose Tackle
- **LB**: Linebacker (MLB, OLB, ILB)
- **CB**: Cornerback
- **S**: Safety (FS, SS)
- **NB**: Nickelback
- **DB**: Defensive Back (general)

### Special Teams
- **K**: Kicker
- **P**: Punter
- **LS**: Long Snapper
- **KR**: Kick Returner
- **PR**: Punt Returner

## Context-Specific Usage Notes

### User Interface Context
- **Game Control**: Use for timeouts, clock changes, administrative functions
- **Play Entry**: Primary workflow for recording plays
- **Statistics View**: Read-only display of accumulated data

### Data Context  
- **Frontend**: camelCase field names (gameId, playType)
- **Backend**: snake_case field names (game_id, play_type)
- **Display**: Human-readable formats ("John Smith #23")

### Error Context
- **Validation Errors**: Field-level input problems
- **Network Errors**: API communication failures  
- **Business Logic Errors**: Rule violations or impossible states