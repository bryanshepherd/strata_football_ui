# 04-State-Management.md - React Contexts, Reducers, and Custom Hooks

## State Management Architecture

The application uses React Context API with a three-layer architecture:

1. **FootballGameContext** - Core game state and data management
2. **FootballFlowContext** - Play input workflow orchestration
3. **GameClockContext** - Game timing management

## 1. FootballGameContext

**File**: `src/contexts/FootballGameContext.jsx`  
**Purpose**: Central game state management and API orchestration

### State Structure
```javascript
const initialState = {
  gameData: {
    game_info: {
      game_id: null,
      home_team_name: '',
      home_team_short: '',
      home_team_abbr: '',
      visitor_team_name: '',
      visitor_team_short: '',
      visitor_team_abbr: '',
      home_team_id: null,
      visitor_team_id: null,
      game_date: null,
      venue: ''
    },
    // Multi-user safety lock information
    lock_info: {
      is_locked: false,
      locked_by: null,
      locked_at: null,
      locked_by_user: null,
      can_edit: true
    },
    live_state: {
      game_status: 'pregame',
      quarter: 1,
      time_remaining: 900, // seconds
      possession: 'home',
      down: 1,
      distance: 10,
      yard_line: 'H35',
      home_score: 0,
      visitor_score: 0,
      home_timeouts: 3,
      visitor_timeouts: 3,
      play_clock: 40,
      drive_number: 1
    },
    recent_plays: [],
    team_stats: {},
    player_stats: {},
    rosters: { home: [], visitor: [] }
  },
  isSubmitting: false,
  error: null,
  debugMode: false,
  debugGameId: '999',
  apiStatus: 'connecting',
  currentDrive: null,
  lastPlayData: null
};
```

### Reducer Actions
```javascript
const gameReducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_GAME_STATE':
      // Full game state replacement
      return {
        ...state,
        gameData: action.payload,
        error: null,
        apiStatus: 'connected'
      };
      
    case 'UPDATE_LIVE_STATE':
      // Partial live state update
      return {
        ...state,
        gameData: {
          ...state.gameData,
          live_state: {
            ...state.gameData.live_state,
            ...action.payload
          }
        }
      };
      
    case 'ADD_PLAY':
      // Add play to history
      return {
        ...state,
        gameData: {
          ...state.gameData,
          recent_plays: [
            ...state.gameData.recent_plays,
            action.payload
          ]
        },
        lastPlayData: action.payload
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isSubmitting: false
      };
      
    case 'SET_SUBMITTING':
      return {
        ...state,
        isSubmitting: action.payload
      };
      
    case 'SET_API_STATUS':
      return {
        ...state,
        apiStatus: action.payload
      };
      
    case 'UPDATE_ROSTERS':
      return {
        ...state,
        gameData: {
          ...state.gameData,
          rosters: action.payload
        }
      };
      
    case 'SET_CURRENT_DRIVE':
      return {
        ...state,
        currentDrive: action.payload
      };
      
    case 'TOGGLE_DEBUG':
      return {
        ...state,
        debugMode: !state.debugMode
      };
      
    default:
      return state;
  }
};
```

### Public Hook Interface
```javascript
export const useGameState = () => {
  const context = useContext(FootballGameContext);
  
  return {
    // State
    gameData: context.state.gameData,
    isSubmitting: context.state.isSubmitting,
    error: context.state.error,
    apiStatus: context.state.apiStatus,
    currentDrive: context.state.currentDrive,
    canEdit: context.canEdit, // Multi-user safety flag
    
    // Actions
    loadGameState: context.loadGameState,
    submitEvent: context.submitEvent, // Enhanced with drive rules
    updateGameClock: context.updateGameClock,
    deletePlay: context.deletePlay,
    insertPlay: context.insertPlay,
    refreshRosters: context.refreshRosters,
    
    // Utilities
    getTeamName: context.getTeamName,
    getPlayerName: context.getPlayerName,
    isDebugMode: context.state.debugMode
  };
};
```

### Key Methods

#### loadGameState()
```javascript
const loadGameState = async () => {
  try {
    dispatch({ type: 'SET_API_STATUS', payload: 'connecting' });
    const response = await StandardizedAPIClient.loadGameState(gameId);
    dispatch({ type: 'LOAD_GAME_STATE', payload: response });
    dispatch({ type: 'SET_API_STATUS', payload: 'connected' });
  } catch (error) {
    dispatch({ type: 'SET_ERROR', payload: error.message });
    dispatch({ type: 'SET_API_STATUS', payload: 'error' });
  }
};
```

#### submitPlay()
```javascript
const submitPlay = async (playData) => {
  dispatch({ type: 'SET_SUBMITTING', payload: true });
  try {
    const transformedData = DataTransformer.frontendToBackend(playData);
    const response = await StandardizedAPIClient.submitPlay(gameId, transformedData);
    
    if (response.success) {
      dispatch({ type: 'ADD_PLAY', payload: response.play });
      dispatch({ type: 'UPDATE_LIVE_STATE', payload: response.gameState });
      await loadGameState(); // Refresh full state
    }
    return response;
  } catch (error) {
    dispatch({ type: 'SET_ERROR', payload: error.message });
    throw error;
  } finally {
    dispatch({ type: 'SET_SUBMITTING', payload: false });
  }
};
```

### State Invariants

1. **Possession Consistency**: Possession must be 'home' or 'visitor'
2. **Down Range**: Down must be 1-4
3. **Quarter Range**: Quarter must be 1+ (overtime supported)
4. **Timeout Range**: Timeouts 0-3 per team
5. **Score Non-negative**: Scores cannot be negative

## 2. FootballFlowContext

**File**: `src/contexts/FootballFlowContext.jsx`  
**Purpose**: Orchestrates play input workflows

### State Structure
```javascript
const initialState = {
  currentFlow: null, // 'rush' | 'pass' | 'punt' | 'kick' | 'penalty' | 'gamecontrol'
  flowStep: null, // Current step within flow
  eventData: {}, // Accumulated play data
  isModalOpen: false,
  availableShortcuts: ['R', 'P', 'U', 'K', 'E', 'G'],
  penaltyQueued: false,
  lastAction: null,
  flowHistory: []
};
```

### Actions
```javascript
// Flow lifecycle actions
START_FLOW: { flow: 'rush', step: 'rusher' }
ADVANCE_STEP: { step: 'global-result' }
UPDATE_EVENT_DATA: { key: 'rusher', value: playerData }
COMPLETE_FLOW: { success: true, data: eventData }
CANCEL_FLOW: {}

// Modal control
OPEN_MODAL: {}
CLOSE_MODAL: {}

// Penalty integration
QUEUE_PENALTY: {}
UNQUEUE_PENALTY: {}

// History tracking
ADD_TO_HISTORY: { entry: flowHistoryItem }
CLEAR_HISTORY: {}
```

### Public Hook Interface
```javascript
export const useFootballFlow = () => {
  const context = useContext(FootballFlowContext);
  
  return {
    // State
    currentFlow: context.currentFlow,
    flowStep: context.flowStep,
    eventData: context.eventData,
    isModalOpen: context.isModalOpen,
    penaltyQueued: context.penaltyQueued,
    
    // Actions
    startFlow: context.startFlow,
    advanceStep: context.advanceStep,
    updateEventData: context.updateEventData,
    completeFlow: context.completeFlow,
    cancelFlow: context.cancelFlow,
    queuePenalty: context.queuePenalty,
    
    // Utilities
    isFlowActive: context.currentFlow !== null,
    canAdvance: context.canAdvance,
    getShortcuts: context.getAvailableShortcuts
  };
};
```

### Flow Configuration
```javascript
const FLOW_CONFIGS = {
  rush: {
    steps: ['rusher', 'global-result', 'details'],
    shortcuts: {
      'rusher': [], // No shortcuts, jersey input
      'global-result': ['T', 'O', 'F', '.'],
      'details': ['Enter', 'Escape']
    }
  },
  pass: {
    steps: ['quarterback', 'receiver', 'pass-result', 'details'],
    shortcuts: {
      'pass-result': ['C', 'I', 'S', 'F', 'X']
    }
  },
  // ... other flows
};
```

## 3. GameClockContext

**File**: `src/contexts/GameClockContext.jsx`  
**Purpose**: Game clock and timing management

### State Structure
```javascript
const initialState = {
  quarter: 1,
  timeRemaining: '15:00',
  playClock: 40,
  isRunning: false,
  lastUpdate: null
};
```

### Public Hook Interface
```javascript
export const useGameClock = () => {
  const context = useContext(GameClockContext);
  
  return {
    // State
    quarter: context.quarter,
    timeRemaining: context.timeRemaining,
    playClock: context.playClock,
    isRunning: context.isRunning,
    
    // Actions
    setQuarter: context.setQuarter,
    setTimeRemaining: context.setTimeRemaining,
    startClock: context.startClock,
    stopClock: context.stopClock,
    resetPlayClock: context.resetPlayClock,
    
    // Utilities
    formatTime: context.formatTime,
    parseTime: context.parseTime,
    getSecondsRemaining: context.getSecondsRemaining
  };
};
```

### Time Formatting Utilities
```javascript
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const parseTime = (timeString) => {
  if (!timeString || typeof timeString !== 'string') return 900;
  const [mins, secs] = timeString.split(':').map(Number);
  return (mins * 60) + secs;
};
```

## Custom Hooks

### usePlayInputFlow

**File**: `src/hooks/usePlayInputFlow.jsx`  
**Purpose**: Shared logic for all play input flows

```javascript
export const usePlayInputFlow = ({
  initialStep,
  onComplete,
  onCancel,
  gameState,
  submitEvent,
  playType
}) => {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [errors, setErrors] = useState({});
  const [penaltyQueued, setPenaltyQueued] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  
  // Keyboard handler setup
  const setupKeyboardHandler = (handlers) => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT') return;
      
      const key = e.key.toUpperCase();
      if (handlers[key]) {
        e.preventDefault();
        handlers[key]();
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  };
  
  // Submit handler
  const handleSubmit = async (eventData) => {
    try {
      setErrors({});
      const result = await submitEvent(eventData);
      if (result.success) {
        onComplete(result);
      }
    } catch (error) {
      setErrors({ submit: error.message });
    }
  };
  
  // Penalty integration
  const handlePenaltySubmit = async (penaltyData) => {
    const combinedData = {
      ...eventData,
      penalty: penaltyData
    };
    await handleSubmit(combinedData);
  };
  
  return {
    currentStep,
    setCurrentStep,
    errors,
    setErrors,
    penaltyQueued,
    setPenaltyQueued,
    showPenaltyModal,
    setShowPenaltyModal,
    setupKeyboardHandler,
    handleSubmit,
    handlePenaltySubmit,
    debugLog: debug.log
  };
};
```

### usePlayerLookup

**File**: `src/hooks/usePlayerLookup.js`  
**Purpose**: Player search and resolution

```javascript
export const usePlayerLookup = (gameState) => {
  const lookupPlayer = async (jerseyNumber, team) => {
    try {
      const roster = gameState.rosters[team];
      const matches = roster.filter(p => p.jersey_number === jerseyNumber);
      
      if (matches.length === 0) {
        // Create synthetic unknown player
        return {
          player_id: -1,
          jersey_number: jerseyNumber,
          full_name: `UNKNOWN #${jerseyNumber}`,
          team: team
        };
      } else if (matches.length === 1) {
        return matches[0];
      } else {
        // Multiple matches - need disambiguation
        return { needsDisambiguation: true, matches };
      }
    } catch (error) {
      console.error('Player lookup failed:', error);
      throw error;
    }
  };
  
  return { lookupPlayer };
};
```

## Optimistic Updates vs Server Truth

### Optimistic Updates
Used in the following scenarios:
1. **Play submission feedback** - UI shows success immediately
2. **Clock updates** - Time changes reflected instantly
3. **Penalty queuing** - Visual feedback before submission

### Server Truth
Always fetched after operations:
1. **After play submission** - Full game state reload
2. **After play deletion** - Complete refresh
3. **On error recovery** - Reset to server state

### Example: Play Submission Flow
```javascript
// 1. Optimistic update
dispatch({ type: 'ADD_PLAY', payload: optimisticPlayData });
dispatch({ type: 'UPDATE_LIVE_STATE', payload: calculatedState });

try {
  // 2. Server submission
  const response = await submitPlay(playData);
  
  // 3. Server truth update
  await loadGameState(); // Overwrites optimistic updates
} catch (error) {
  // 4. Rollback on error
  await loadGameState(); // Reset to server truth
}
```

## State Update Patterns

### Batch Updates
```javascript
// Multiple state updates in single dispatch
dispatch({
  type: 'UPDATE_GAME_STATE',
  payload: {
    live_state: newLiveState,
    recent_plays: newPlays,
    stats: newStats
  }
});
```

### Incremental Updates
```javascript
// Single field update
dispatch({
  type: 'UPDATE_LIVE_STATE',
  payload: { down: 2, distance: 5 }
});
```

### Transaction Pattern
```javascript
const executeTransaction = async () => {
  dispatch({ type: 'BEGIN_TRANSACTION' });
  try {
    await operation1();
    await operation2();
    dispatch({ type: 'COMMIT_TRANSACTION' });
  } catch (error) {
    dispatch({ type: 'ROLLBACK_TRANSACTION' });
  }
};
```

## Known State Invariants

### Line-to-Gain Rules
1. **First Down Reset**: Distance resets to 10 on first down
2. **Goal-to-Go**: Distance = remaining yards when < 10 from goal
3. **Safety Position**: Special handling for plays in own end zone

### Possession Rules
1. **Turnover**: Possession flips on interception/fumble recovery
2. **Score**: Possession changes after scoring plays
3. **Kickoff**: Receiving team gets possession

### Clock Rules
1. **Stop Clock**: Incomplete pass, out of bounds, penalty
2. **Run Clock**: In-bounds tackle
3. **Quarter End**: Clock stops at 0:00

## Phase 2 Enhancements

### Multi-User Safety Features

#### Lock Status Integration
Added to FootballGameContext state structure:
```javascript
lock_info: {
  is_locked: Boolean(gameState.gameInfo?.locked_by),
  locked_by: gameState.gameInfo?.locked_by || null,
  locked_at: gameState.gameInfo?.locked_at || null,
  locked_by_user: gameState.gameInfo?.locked_by_user || null,
  can_edit: gameState.gameInfo?.can_edit !== false
}
```

#### Submission Protection
```javascript
const submitEvent = async (eventData) => {
  // Multi-user safety check
  if (state.gameData?.lock_info?.can_edit === false) {
    const errorMsg = `Cannot submit: Game is locked by ${state.gameData.lock_info.locked_by_user}`;
    return { success: false, error: errorMsg };
  }
  
  // Proceed with submission...
};
```

#### Public Interface Updates
Enhanced `useGameState` hook with lock awareness:
```javascript
export const useGameState = () => {
  const context = useContext(FootballGameContext);
  
  return {
    // Enhanced state
    gameData: context.state.gameData,
    canEdit: context.state.gameData?.lock_info?.can_edit !== false, // NEW
    lockInfo: context.state.gameData?.lock_info, // NEW
    
    // Existing state
    isSubmitting: context.state.isSubmitting,
    error: context.state.error,
    apiStatus: context.state.apiStatus,
    currentDrive: context.state.currentDrive,
    
    // Actions remain unchanged
    loadGameState: context.loadGameState,
    submitEvent: context.submitEvent,
    // ... other actions
  };
};
```

### Performance Optimizations

#### Play Log Pagination
**File**: `src/components/GameLog.jsx`  
**Purpose**: Efficient rendering of large play logs

```javascript
const PLAYS_PER_PAGE = 25;
const PERFORMANCE_THRESHOLD = 75;

const playMetrics = useMemo(() => ({
  totalPlays: recent_plays.length,
  shouldPaginate: recent_plays.length > PERFORMANCE_THRESHOLD,
  visiblePlays: recent_plays.slice(0, Math.min(visiblePlayCount, recent_plays.length)),
  hasMorePlays: visiblePlayCount < recent_plays.length
}), [recent_plays.length, visiblePlayCount]);
```

**Performance Rules**:
- Games ≤75 plays: Show all plays
- Games >75 plays: Paginate with 25 plays per page
- Load more button shows remaining count
- "Show All" option for complete view

#### Component Memoization
**File**: `src/components/PlayRow.jsx`  
**Purpose**: Prevent unnecessary re-renders of individual plays

```javascript
export default React.memo(function PlayRow({ 
  play, 
  index, 
  onEdit, 
  onDelete, 
  showEdit,
  gameState 
}) {
  // Memoized rendering logic
});
```

### Drive Rules Engine Integration

#### Automatic Drive Transitions
Enhanced `submitEvent` with drive awareness:
```javascript
const submitEvent = async (eventData) => {
  // ... safety checks
  
  try {
    const transformedData = DataTransformer.frontendToBackend(eventData);
    
    // Drive rules applied server-side
    const response = await StandardizedAPIClient.submitPlay(gameId, transformedData);
    
    if (response.success) {
      // Update with server-calculated drive state
      dispatch({ type: 'UPDATE_LIVE_STATE', payload: response.gameState });
      dispatch({ type: 'SET_CURRENT_DRIVE', payload: response.currentDrive });
      
      await loadGameState(); // Full refresh for consistency
    }
    
    return response;
  } catch (error) {
    // ... error handling
  }
};
```

#### Drive State Management
```javascript
const initialState = {
  // ... existing state
  currentDrive: {
    drive_number: null,
    possession: null,
    start_yard_line: null,
    start_quarter: null,
    start_time: null,
    plays: [],
    result: null // 'touchdown' | 'field_goal' | 'punt' | 'turnover' | 'safety'
  }
};
```

### Real-Time Lock Status Updates

#### Lock Status Polling
**File**: `src/components/LockStatus.jsx`  
**Purpose**: Real-time awareness of concurrent users

```javascript
export default function LockStatus() {
  const { gameState, currentGameId } = useGameState();
  const [lockStatus, setLockStatus] = useState(null);
  
  useEffect(() => {
    const pollLockStatus = async () => {
      try {
        const response = await StandardizedAPIClient.checkLockStatus(currentGameId);
        if (response.success) {
          setLockStatus(response.lockInfo);
        }
      } catch (error) {
        console.error('Lock status check failed:', error);
      }
    };
    
    if (currentGameId) {
      // Initial check
      pollLockStatus();
      
      // Poll every 30 seconds
      const interval = setInterval(pollLockStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [currentGameId]);
  
  // Visual status indicators
  const getStatusColor = () => {
    if (!lockStatus?.is_locked) return 'text-green-600'; // Available
    if (lockStatus.can_edit) return 'text-blue-600';     // Current user
    return 'text-red-600';                               // Locked by other
  };
}
```

### Enhanced Error Handling

#### Lock-Aware Error Messages
```javascript
const handleSubmissionError = (error) => {
  if (error.message?.includes('locked')) {
    return {
      type: 'LOCK_ERROR',
      message: `Game is locked by ${error.locked_by_user || 'another user'}`,
      action: 'SHOW_LOCK_STATUS'
    };
  }
  
  return {
    type: 'GENERAL_ERROR',
    message: error.message,
    action: 'RETRY'
  };
};
```

## Performance Considerations

### Context Split Benefits
- **Separation of Concerns**: Each context handles specific domain
- **Render Optimization**: Components only re-render for relevant changes
- **Memory Efficiency**: State split prevents large object updates

### Phase 2 Optimizations
1. **Play Log Virtualization**: Pagination for games >75 plays
2. **Memoized Components**: `React.memo` on PlayRow and other frequently rendered components
3. **Lock Status Caching**: 30-second poll intervals reduce API load
4. **Selective State Updates**: Granular context updates minimize re-renders

### Memory Management
1. **Bounded Play History**: Only recent plays kept in memory
2. **Drive State Separation**: Current drive tracked separately from history
3. **Lock Status Persistence**: Lock info cached to prevent redundant checks