# 06-Components-Catalog.md - Component Responsibilities and Usage

## Component Architecture Overview

The application uses a component-based architecture with clear separation of concerns:

- **Display Components**: Read-only data presentation
- **Input Components**: Form fields and user interactions
- **Modal Components**: Overlay interfaces
- **Container Components**: Layout and orchestration

## Main Display Components

### 1. Scoreboard

**File**: `src/components/Scoreboard.jsx`  
**Purpose**: Main game status display

#### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| gameData | object | Yes | - | Complete game state |
| isLoading | boolean | No | false | Loading state |

#### Responsibilities
- Display current score (home/visitor)
- Show quarter and time remaining
- Indicate possession with football emoji 🏈
- Display down and distance
- Show timeout chips (yellow indicators)
- Format yard line display (H35, V20, etc.)

#### Context Usage
- `useGameClock()` - Time formatting and display
- Debug utility for logging

#### Key Features
```javascript
// Possession indicator
{possession === 'home' ? '🏈' : ''} HOME 14
AWAY {possession === 'visitor' ? '🏈' : ''} 10

// Timeout display
{[...Array(homeTimeouts)].map(() => '🟡')}

// Time formatting
const displayTime = time_remaining || "15:00";

// Down and distance
{down} & {distance} at {formatYardLine(yard_line)}
```

#### Loading State
```jsx
if (isLoading) {
  return <div>Loading scoreboard...</div>;
}
```

### 2. GameLog

**File**: `src/components/GameLog.jsx`  
**Purpose**: Play-by-play display with editing capabilities

#### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| plays | array | Yes | Array of play objects |
| onDeletePlay | function | Yes | Play deletion handler |
| onInsertPlay | function | Yes | Play insertion handler |

#### Responsibilities
- Chronological play display
- Play editing interface (edit/delete/replace/insert)
- Player name resolution and display
- Play type icons and formatting
- Statistics summary footer

#### Context Usage
- `useGameState()` - Game data and operations
- PlayerManager for player lookups

#### Component Structure
```jsx
<div className="game-log">
  <div className="log-header">
    <h3>Play by Play</h3>
    <div className="stats-summary">
      Rushes: {rushCount} | Passes: {passCount} | Penalties: {penaltyCount}
    </div>
  </div>
  
  <div className="play-list">
    {plays.map(play => (
      <PlayItem 
        key={play.id}
        play={play}
        onEdit={handleEdit}
        onDelete={onDeletePlay}
      />
    ))}
  </div>
</div>
```

#### Action Buttons
- **Edit**: Opens PlayEditModal
- **Delete**: Confirms and removes play
- **Replace**: Inserts then deletes original
- **Insert**: Adds blank play above current

### 3. TeamPlayerStats

**File**: `src/components/TeamPlayerStats.jsx`  
**Purpose**: Comprehensive statistics display

#### Responsibilities
- Quarter-by-quarter scoring breakdown
- Team statistics (rushing, passing, penalties)
- Individual player statistics
- Top performers ranking
- Time of possession tracking

#### Stats Categories

**Team Stats**:
```javascript
{
  first_downs: 12,
  rushing_attempts: 25,
  rushing_yards: 156,
  passing_completions: 15,
  passing_attempts: 23,
  passing_yards: 234,
  penalties: 7,
  penalty_yards: 65
}
```

**Player Stats**:
```javascript
{
  passing: [{ player_name: "John Smith", attempts: 15, completions: 12, yards: 234 }],
  rushing: [{ player_name: "Mike Jones", attempts: 18, yards: 95 }],
  receiving: [{ player_name: "Bob Wilson", catches: 6, yards: 78 }],
  tackles: [{ player_name: "Sam Davis", tackles: 8, assists: 3 }]
}
```

#### Display Sections
1. **Scoring Summary**: Quarter-by-quarter breakdown
2. **Team Comparison**: Side-by-side team stats
3. **Top Performers**: Leading players by category
4. **Drive Summary**: Time of possession and efficiency

### 4. DriveStatusBar

**File**: `src/components/DriveStatusBar.jsx`  
**Purpose**: Current drive information and recent play participants

#### Responsibilities
- Display current drive statistics
- Show drive start time and field position
- List participants in most recent play
- Calculate possession-relative drive yards

#### API Integration
Makes direct API calls for:
- Drive statistics
- Play participants
- Player stat lines

#### Display Format
```jsx
<div className="drive-status">
  <div className="drive-info">
    Drive: {plays} plays, {yards} yards
    Started: {startTime} at {startPosition}
  </div>
  
  <div className="recent-participants">
    <h4>Last Play Participants:</h4>
    {participants.map(player => (
      <div key={player.id}>
        #{player.jersey} {player.name} - {player.statLine}
      </div>
    ))}
  </div>
</div>
```

## Input and Control Components

### 5. EventControls

**File**: `src/components/EventControls.jsx`  
**Purpose**: Main control panel for initiating play inputs

#### Responsibilities
- Display available play type buttons
- Show keyboard shortcuts
- Indicate current flow status
- Provide flow status feedback

#### Button Layout
```jsx
<div className="event-controls">
  <div className="play-buttons">
    <button onClick={() => startFlow('rush')}>
      <kbd>R</kbd> Rush
    </button>
    <button onClick={() => startFlow('pass')}>
      <kbd>P</kbd> Pass
    </button>
    <button onClick={() => startFlow('punt')}>
      <kbd>U</kbd> Punt
    </button>
    <button onClick={() => startFlow('kick')}>
      <kbd>K</kbd> Kick
    </button>
    <button onClick={() => startFlow('penalty')}>
      <kbd>E</kbd> Penalty
    </button>
    <button onClick={() => startFlow('gamecontrol')}>
      <kbd>G</kbd> Game Control
    </button>
  </div>
  
  {currentFlow && (
    <div className="flow-status">
      Active: {currentFlow} - {flowStep}
    </div>
  )}
</div>
```

#### Context Usage
- `useFootballFlow()` - Flow state and controls

### 6. InputAssistant

**File**: `src/components/InputAssistant.jsx`  
**Purpose**: Context-sensitive help and guidance

#### Responsibilities
- Show available keyboard shortcuts
- Provide step-by-step instructions
- Display current data collection status
- Show submission status and loading states

#### Dynamic Content
```javascript
const getInstructions = (currentFlow, flowStep) => {
  if (!currentFlow) return "Press R, P, U, K, E, or G to start";
  
  switch(currentFlow) {
    case 'rush':
      switch(flowStep) {
        case 'rusher': return "Enter jersey number of rusher";
        case 'global-result': return "T=Tackle, O=Out, F=Fumble, .=Score";
        case 'tackle-details': return "Enter final yard line and tackler";
      }
      break;
    // ... other flows
  }
};
```

## Modal Components

### 7. FootballFlowModal

**File**: `src/components/FootballFlowModal.jsx`  
**Purpose**: Central modal container for all flows

#### Responsibilities
- Render appropriate flow component based on currentFlow
- Handle modal open/close state
- Pass common props to all flows
- Manage modal backdrop and styling

#### Flow Routing
```javascript
const renderFlowComponent = () => {
  switch(currentFlow) {
    case 'rush':
      return <RushInputFlow {...flowProps} />;
    case 'pass':
      return <PassInputFlow {...flowProps} />;
    case 'punt':
      return <PuntInputFlow {...flowProps} />;
    case 'kick':
      return <KickInputFlow {...flowProps} />;
    case 'penalty':
      return <PenaltyInputFlow {...flowProps} />;
    case 'gamecontrol':
      return <GameControlInputFlow {...flowProps} />;
    default:
      return null;
  }
};
```

### 8. PenaltyModal

**File**: `src/components/PenaltyModal.jsx`  
**Purpose**: Penalty selection and enforcement

#### Responsibilities
- Load penalty chart from API
- Handle penalty selection
- Manage enforcement options (accept/decline/offset)
- Calculate penalty enforcement spots

#### Penalty Data Structure
```javascript
{
  penalty_code: "HOLD",
  penalty_name: "Holding",
  penalty_yards: 10,
  automatic_first_down: false,
  offending_team: "offense",
  offending_player: "#75",
  enforcement: "accept", // accept, decline, offset
  enforcement_spot: "previous" // previous, spot, kickoff
}
```

### 9. PlayerDisambiguationModal

**File**: `src/components/PlayerDisambiguationModal.jsx`  
**Purpose**: Resolve multiple players with same jersey number

#### Responsibilities
- Display multiple player matches
- Allow user selection
- Handle "create new player" option
- Pass selected player back to flow

#### Display Format
```jsx
<div className="disambiguation-modal">
  <h3>Multiple players found for #{jerseyNumber}</h3>
  {matches.map(player => (
    <button key={player.id} onClick={() => selectPlayer(player)}>
      {player.full_name} - {player.position}
    </button>
  ))}
  <button onClick={createNewPlayer}>
    Create Unknown Player #{jerseyNumber}
  </button>
</div>
```

## Specialized Input Components

### 10. JerseyNumberInput

**File**: `src/components/JerseyNumberInput.jsx`  
**Purpose**: Jersey number input with validation

#### Features
- Numeric input validation (0-99)
- Auto-lookup on blur/enter
- Visual feedback for valid/invalid numbers
- Integration with disambiguation system

#### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| value | string | No | Current value |
| onChange | function | Yes | Value change handler |
| onPlayerSelected | function | Yes | Player selection callback |
| team | string | Yes | 'home' or 'visitor' |
| placeholder | string | No | Input placeholder |

### 11. YardlineInput

**File**: `src/components/YardlineInput.jsx`  
**Purpose**: Field position input with format validation

#### Features
- Format validation (H##, V##, 50)
- Auto-formatting (h35 → H35)
- Visual feedback for invalid formats
- Integration with down/distance calculator

#### Validation Pattern
```javascript
const YARDLINE_PATTERN = /^(H|V)\d{1,2}|50$/;

const validateYardline = (value) => {
  if (!value) return { valid: false, message: "Required" };
  if (!YARDLINE_PATTERN.test(value)) {
    return { valid: false, message: "Format: H35, V20, or 50" };
  }
  return { valid: true };
};
```

### 12. PlayerInput

**File**: `src/components/PlayerInput.jsx`  
**Purpose**: Combined player selection (jersey + name)

#### Features
- Jersey number input
- Player name display
- Disambiguation handling
- "Unknown player" creation

## Utility Components

### 13. PlayerName

**File**: `src/components/PlayerName.jsx`  
**Purpose**: Consistent player name display

#### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| playerId | number | Yes | Player identifier |
| fallbackName | string | No | Fallback if not found |

#### Features
- Async player lookup
- Loading state display
- Fallback to "Unknown Player"
- Caching for performance

### 14. PlayDescription

**File**: `src/components/PlayDescription.jsx`  
**Purpose**: Formatted play descriptions

#### Responsibilities
- Generate human-readable play descriptions
- Handle all play types (rush, pass, punt, kick)
- Include player names and yardage
- Format special situations (penalties, scores)

#### Example Outputs
```javascript
"#23 Johnson rush for 5 yards to H35 (tackle by #45 Smith)"
"#12 Wilson pass complete to #81 Brown for 12 yards to V20"
"#4 Davis punt 45 yards, returned by #21 for 8 yards"
"#9 Miller 35-yard field goal GOOD"
```

## Layout Components

### 15. APIStatus

**File**: `src/components/APIStatus.jsx`  
**Purpose**: API connection status indicator

#### Status Display
```jsx
const getStatusColor = (status) => {
  switch(status) {
    case 'connected': return 'green';
    case 'connecting': return 'yellow';
    case 'error': return 'red';
    case 'disconnected': return 'gray';
  }
};

<div className={`api-status ${getStatusColor(apiStatus)}`}>
  {apiStatus.toUpperCase()}
</div>
```

### 16. DebugPanel

**File**: `src/components/DebugPanel.jsx`  
**Purpose**: Development debugging interface

#### Features (Debug Mode Only)
- Game state display
- API call logging
- Manual state manipulation
- Performance metrics
- Error logs

#### Debug Controls
```jsx
{debugMode && (
  <div className="debug-panel">
    <button onClick={clearLogs}>Clear Logs</button>
    <button onClick={exportState}>Export State</button>
    <button onClick={simulateError}>Simulate Error</button>
    <pre>{JSON.stringify(gameState, null, 2)}</pre>
  </div>
)}
```

## Component Integration Patterns

### Context Integration
Most components follow this pattern:
```javascript
const Component = () => {
  const { gameData, submitPlay } = useGameState();
  const { currentFlow, startFlow } = useFootballFlow();
  const { formatTime } = useGameClock();
  
  // Component logic
};
```

### Error Boundary Pattern
```javascript
<ErrorBoundary fallback={<ErrorDisplay />}>
  <Component />
</ErrorBoundary>
```

### Loading State Pattern
```javascript
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
return <ComponentContent />;
```

## Performance Considerations

### Memoization Opportunities
- **PlayerName**: Expensive lookups should be memoized
- **PlayDescription**: String generation could be cached
- **TeamPlayerStats**: Statistics calculations

### Re-render Optimization
- Split contexts to minimize unnecessary renders
- Use React.memo for pure display components
- Implement proper dependency arrays in useEffect

## Known Edge Cases

### Player Lookup
- Multiple players with same jersey
- Unknown/missing players
- Invalid jersey numbers

### Data Display
- Missing or null game data
- Network errors during loading
- Partial data states

### User Input
- Invalid field position formats
- Out-of-range numeric inputs
- Race conditions in rapid input