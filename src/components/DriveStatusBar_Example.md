# DriveStatusBar Component Usage Examples

## Basic Usage

The `DriveStatusBar` component displays a visual progress bar showing drive progress from end zone to end zone, with data sourced from the backend through the `buildDriveModel` utility.

### Example Data Structure

```javascript
// Example drive model from buildDriveModel()
const sampleDriveModel = {
  offense: 'H',           // 'H' for Home, 'V' for Visitor
  number: 3,              // Drive number
  start: 'H25',           // Starting field position
  current: 'V45',         // Current ball position  
  down: 2,                // Current down
  distance: 6,            // Yards to go
  yardsSoFar: 30,         // Total yards gained this drive
  events: [               // Key events during drive
    { t: 'fd', atPct: 25 },    // First down at 25% progress
    { t: 'flag', atPct: 60 },  // Penalty at 60% progress
    { t: 'score', atPct: 100 } // Touchdown at goal line
  ],
  breakdown: {            // Optional: how yards were gained
    rush: 15,             // Rush yards
    pass: 20,             // Pass yards  
    pen: -5,              // Penalty yards
    fdRush: 1,            // First downs by rushing
    fdPass: 2,            // First downs by passing
    fdPen: 0              // First downs by penalty
  }
};
```

### Usage in Components

```jsx
import DriveStatusBar from './components/DriveStatusBar';
import { useDriveModel } from './hooks/useDriveModel';

function GameView({ gameState }) {
  const driveModel = useDriveModel(gameState, gameState?.plays);
  
  return (
    <div>
      <DriveStatusBar model={driveModel} />
    </div>
  );
}
```

## Visual Elements

### Progress Bar
- **Background**: Red-to-green gradient representing field (red zones at both ends)
- **Fill**: Blue overlay showing drive progress from start to current position
- **Ball**: White circle showing current ball position
- **Midfield**: White line at 50% mark
- **Start Marker**: Yellow line showing where drive started

### Chips (Info Pills)
- **Team**: "Home" or "Visitor" 
- **Drive #**: "Drive 3"
- **Down & Distance**: "2&6" or "D&D n/a" if missing
- **Position**: "H25 → V45" (start → current)
- **Yards**: "+30 yds" (total drive yards)
- **Breakdown**: "R:+15 (1) · P:+20 (2) · ⚑:-5 (0)" (rush/pass/penalty yards with first downs)

### Event Markers
- **Green**: First downs (fd)
- **Yellow**: Penalties (flag)  
- **Red with white border**: Scores (score)

## Data Sources

The component gets data from:
1. **game_state table**: CurrentDown, YardsToGo, Possession, YardLinePosition
2. **drives table**: DriveNumber, StartYardLinePosition, TotalYards, IsActive=1
3. **plays table**: For event markers and breakdown stats (filtered by DriveID)

## Field Position Logic

Uses `toPossessionRelative()` from DownDistanceCalculator:
- 0% = Own goal line (defending)  
- 50% = Midfield
- 100% = Opponent goal line (scoring)

For Home team on H25: 25% progress (25 yards from own goal)
For Visitor team on V30: 30% progress (30 yards from own goal)