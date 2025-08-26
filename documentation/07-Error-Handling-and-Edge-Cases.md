# 07-Error-Handling-and-Edge-Cases.md - Error Handling and Recovery Patterns

## Error Handling Architecture

The application implements multi-layer error handling:

1. **Network Layer**: API communication errors
2. **Data Layer**: Validation and transformation errors
3. **UI Layer**: User input and display errors
4. **Context Layer**: State management errors

## Network Error Handling

### API Call Error Pattern
**Location**: `src/utils/apiDataContract.ts:480-520`

```typescript
class StandardizedAPIClient {
  static async loadGameState(gameId: string): Promise<StandardGameState> {
    try {
      const response = await fetch(`/strata_football/api/load_game_state.php?game_id=${gameId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'API request failed');
      }
      
      return DataTransformer.transformGameState(data);
      
    } catch (error) {
      console.error('Failed to load game state:', error);
      throw new Error(`Game state loading failed: ${error.message}`);
    }
  }
}
```

### Network Failure Recovery
**Location**: `src/contexts/FootballGameContext.jsx:680-710`

```javascript
// Health check with automatic retry
const checkAPIHealth = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('/strata_football/health_check.php', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      dispatch({ type: 'SET_API_STATUS', payload: 'connected' });
    } else {
      dispatch({ type: 'SET_API_STATUS', payload: 'error' });
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Health check timeout');
    }
    dispatch({ type: 'SET_API_STATUS', payload: 'error' });
  }
};

// Periodic health monitoring
useEffect(() => {
  const interval = setInterval(checkAPIHealth, 30000);
  return () => clearInterval(interval);
}, []);
```

### API Status Display
**Location**: `src/components/APIStatus.jsx:15-35`

```javascript
const getStatusDisplay = (status) => {
  switch (status) {
    case 'connected':
      return { text: 'CONNECTED', color: 'text-green-500', icon: '●' };
    case 'connecting':
      return { text: 'CONNECTING', color: 'text-yellow-500', icon: '◐' };
    case 'error':
      return { text: 'ERROR', color: 'text-red-500', icon: '●' };
    case 'disconnected':
      return { text: 'OFFLINE', color: 'text-gray-500', icon: '○' };
    default:
      return { text: 'UNKNOWN', color: 'text-gray-500', icon: '?' };
  }
};
```

## Data Validation and Transformation Errors

### Input Validation
**Location**: `src/components/YardlineInput.jsx:25-45`

```javascript
const validateYardLine = (value) => {
  if (!value) {
    return { valid: false, error: 'Yard line is required' };
  }
  
  // Format validation
  const pattern = /^(H|V)\d{1,2}|50$/;
  if (!pattern.test(value.toUpperCase())) {
    return { 
      valid: false, 
      error: 'Invalid format. Use H35, V20, or 50' 
    };
  }
  
  // Range validation
  const match = value.match(/\d+/);
  if (match) {
    const num = parseInt(match[0]);
    if (num > 50) {
      return { 
        valid: false, 
        error: 'Yard line cannot exceed 50' 
      };
    }
  }
  
  return { valid: true };
};
```

### Data Transformation Error Handling
**Location**: `src/utils/apiDataContract.ts:200-230`

```typescript
class DataTransformer {
  static frontendToBackend(data: StandardPlayData): BackendPlayData {
    try {
      const transformed = {
        play_type: data.playType?.toLowerCase(),
        primary_player_id: data.primaryPlayerID || null,
        yards: data.yardsGained || 0,
        // ... other transformations
      };
      
      // Validate required fields
      if (!transformed.play_type) {
        throw new Error('Play type is required');
      }
      
      return transformed;
    } catch (error) {
      console.error('Data transformation failed:', error);
      throw new Error(`Invalid play data: ${error.message}`);
    }
  }
}
```

## Play Input Error Handling

### Flow Validation
**Location**: `src/hooks/usePlayInputFlow.jsx:80-120`

```javascript
const validateCurrentStep = (step, eventData) => {
  const errors = {};
  
  switch (step) {
    case 'rusher':
      if (!eventData.rusher?.player_id) {
        errors.rusher = 'Please select a rusher';
      }
      break;
      
    case 'final-yard-line':
      if (!eventData.finalYardLine) {
        errors.finalYardLine = 'Final yard line is required';
      } else {
        const validation = validateYardLine(eventData.finalYardLine);
        if (!validation.valid) {
          errors.finalYardLine = validation.error;
        }
      }
      break;
      
    case 'tackler':
      if (!eventData.tackler1) {
        errors.tackler1 = 'Primary tackler is required';
      }
      break;
  }
  
  return errors;
};

const handleSubmit = async (eventData) => {
  try {
    // Validate all steps
    const errors = validateCurrentStep(currentStep, eventData);
    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return;
    }
    
    setErrors({});
    const result = await submitEvent(eventData);
    
    if (result.success) {
      onComplete(result);
    } else {
      setErrors({ submit: result.message || 'Submission failed' });
    }
  } catch (error) {
    console.error('Submit failed:', error);
    setErrors({ submit: `Error: ${error.message}` });
  }
};
```

### Player Lookup Error Handling
**Location**: `src/utils/playerManager.js:90-130`

```javascript
const lookupPlayerByJersey = async (gameId, team, jerseyNumber) => {
  try {
    const response = await fetch(
      `/strata_football/api/get_player_by_jersey.php?gameId=${gameId}&team=${team}&jerseyNumber=${jerseyNumber}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      // Player not found - create unknown player
      return {
        player_id: -1,
        jersey_number: jerseyNumber,
        full_name: `UNKNOWN #${jerseyNumber}`,
        first_name: 'UNKNOWN',
        last_name: `#${jerseyNumber}`,
        position: 'UNK',
        team: team,
        is_unknown: true
      };
    }
    
    // Multiple players found
    if (Array.isArray(data.players) && data.players.length > 1) {
      return {
        needsDisambiguation: true,
        matches: data.players,
        jerseyNumber: jerseyNumber
      };
    }
    
    return data.player;
    
  } catch (error) {
    console.error('Player lookup failed:', error);
    
    // Fallback to unknown player
    return {
      player_id: -1,
      jersey_number: jerseyNumber,
      full_name: `UNKNOWN #${jerseyNumber}`,
      team: team,
      is_unknown: true,
      lookup_error: error.message
    };
  }
};
```

## Game State Edge Cases

### Clock and Time Handling
**Location**: `src/components/Scoreboard.jsx:45-70`

```javascript
const formatTimeDisplay = (timeRemaining) => {
  // Handle null/undefined time
  if (!timeRemaining) {
    return "15:00";
  }
  
  // Handle numeric seconds
  if (typeof timeRemaining === 'number') {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Handle string format
  if (typeof timeRemaining === 'string') {
    if (timeRemaining.includes(':')) {
      return timeRemaining;
    }
    
    // Parse as seconds
    const totalSeconds = parseInt(timeRemaining);
    if (!isNaN(totalSeconds)) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }
  
  // Fallback for invalid time
  console.warn('Invalid time format:', timeRemaining);
  return "15:00";
};
```

### Possession Edge Cases
**Location**: `src/contexts/FootballGameContext.jsx:200-230`

```javascript
const normalizePossession = (possession) => {
  if (!possession) return 'home';
  
  const normalized = possession.toLowerCase();
  
  switch (normalized) {
    case 'h':
    case 'home':
    case '1':
      return 'home';
    case 'v':
    case 'visitor':
    case 'away':
    case '2':
      return 'visitor';
    default:
      console.warn('Unknown possession value:', possession);
      return 'home'; // Default fallback
  }
};
```

### Down and Distance Validation
**Location**: `src/utils/DownDistanceCalculator.js:150-200`

```javascript
const validateGameState = (gameState) => {
  const errors = [];
  
  // Down validation
  if (!gameState.down || gameState.down < 1 || gameState.down > 4) {
    errors.push(`Invalid down: ${gameState.down}. Must be 1-4.`);
    gameState.down = 1; // Auto-correct
  }
  
  // Distance validation
  if (gameState.distance < 0) {
    errors.push(`Negative distance: ${gameState.distance}. Setting to 0.`);
    gameState.distance = 0;
  }
  
  if (gameState.distance > 50) {
    errors.push(`Excessive distance: ${gameState.distance}. Capping at 50.`);
    gameState.distance = 50;
  }
  
  // Yard line validation
  if (!isValidYardLine(gameState.yardLine)) {
    errors.push(`Invalid yard line: ${gameState.yardLine}. Using H35.`);
    gameState.yardLine = 'H35';
  }
  
  if (errors.length > 0) {
    console.warn('Game state validation errors:', errors);
  }
  
  return gameState;
};
```

## UI Error Display Patterns

### Form Error Display
**Location**: `src/components/PlayInputFlows/RushInputFlow.jsx:180-200`

```jsx
<div className="form-group">
  <label>Jersey Number</label>
  <input
    type="text"
    value={jerseyNumber}
    onChange={handleJerseyChange}
    className={errors.jerseyNumber ? 'error' : ''}
  />
  {errors.jerseyNumber && (
    <div className="error-message text-red-500 text-sm mt-1">
      {errors.jerseyNumber}
    </div>
  )}
</div>
```

### Loading State Error Handling
**Location**: `src/components/GameLog.jsx:50-80`

```jsx
const GameLog = ({ plays, onDeletePlay, onInsertPlay }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const loadPlays = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load play data
        await loadGameData();
        
      } catch (err) {
        console.error('Failed to load plays:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadPlays();
  }, []);
  
  if (loading) {
    return (
      <div className="game-log loading">
        <div className="spinner">Loading plays...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="game-log error">
        <div className="error-banner">
          <h4>Error loading plays</h4>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
  
  // Normal render
  return <div className="game-log">{/* play list */}</div>;
};
```

## Recovery Mechanisms

### Automatic Recovery Strategies

#### 1. State Refresh on Error
**Location**: `src/contexts/FootballGameContext.jsx:400-420`

```javascript
const recoverFromError = async (error) => {
  console.warn('Attempting automatic recovery from error:', error);
  
  try {
    // Clear error state
    dispatch({ type: 'SET_ERROR', payload: null });
    
    // Refresh game state from server
    await loadGameState();
    
    console.log('Recovery successful');
    return true;
  } catch (recoveryError) {
    console.error('Recovery failed:', recoveryError);
    
    // Set comprehensive error state
    dispatch({ 
      type: 'SET_ERROR', 
      payload: `Error recovery failed: ${recoveryError.message}` 
    });
    
    return false;
  }
};
```

#### 2. Optimistic Update Rollback
**Location**: `src/hooks/usePlayInputFlow.jsx:140-170`

```javascript
const submitWithOptimisticUpdate = async (playData) => {
  // Store current state for rollback
  const currentState = { ...gameData };
  
  try {
    // Optimistic update
    const optimisticState = calculateOptimisticState(currentState, playData);
    dispatch({ type: 'OPTIMISTIC_UPDATE', payload: optimisticState });
    
    // Server submission
    const result = await submitPlay(playData);
    
    if (result.success) {
      // Confirm with server truth
      await loadGameState();
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    // Rollback optimistic update
    console.warn('Rolling back optimistic update due to error:', error);
    dispatch({ type: 'LOAD_GAME_STATE', payload: currentState });
    throw error;
  }
};
```

### Manual Recovery Options

#### 1. Retry Button Pattern
```jsx
const RetryableComponent = ({ onRetry, error }) => (
  <div className="error-state">
    <p>Something went wrong: {error}</p>
    <button 
      onClick={onRetry}
      className="retry-button bg-blue-500 text-white px-4 py-2 rounded"
    >
      Try Again
    </button>
  </div>
);
```

#### 2. Refresh Game State
```jsx
const RefreshButton = () => {
  const { loadGameState, error } = useGameState();
  
  if (!error) return null;
  
  return (
    <button 
      onClick={loadGameState}
      className="refresh-button"
    >
      Refresh Game State
    </button>
  );
};
```

## Known Recovery Paths

### 1. Network Disconnection Recovery
- **Detection**: Health check failure
- **Recovery**: Periodic retry with exponential backoff
- **User Feedback**: API status indicator

### 2. Invalid Game State Recovery
- **Detection**: Validation errors during state updates
- **Recovery**: Fetch fresh state from server
- **User Feedback**: "Game state refreshed" message

### 3. Play Submission Failure Recovery
- **Detection**: API error response
- **Recovery**: Rollback optimistic updates, allow retry
- **User Feedback**: Error message with retry option

### 4. Player Lookup Failure Recovery
- **Detection**: Player not found in roster
- **Recovery**: Create "Unknown Player" entry
- **User Feedback**: Warning about unknown player

### 5. Modal State Corruption Recovery
- **Detection**: Invalid flow state
- **Recovery**: Reset flow context to initial state
- **User Feedback**: Modal closes, user can restart

## Error Logging and Monitoring

### Debug Logging
**Location**: `src/utils/debug.js:15-40`

```javascript
const debug = {
  log: (message, data = null) => {
    if (isDebugMode()) {
      console.log(`[DEBUG] ${message}`, data);
      // Could send to external logging service
    }
  },
  
  error: (message, error = null) => {
    console.error(`[ERROR] ${message}`, error);
    // Always log errors regardless of debug mode
    // Could send to error tracking service
  },
  
  warn: (message, data = null) => {
    if (isDebugMode()) {
      console.warn(`[WARN] ${message}`, data);
    }
  }
};
```

### Error Boundaries
**Location**: Error boundary implementation recommended

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error boundary caught error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Application
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

## Testing Edge Cases

### Key Test Scenarios
1. **Network Failure**: Simulate API timeouts and errors
2. **Invalid Data**: Test with malformed API responses
3. **Race Conditions**: Rapid user interactions
4. **State Corruption**: Invalid state transitions
5. **Browser Edge Cases**: Refresh during operations
6. **Partial Failures**: Some API calls succeed, others fail