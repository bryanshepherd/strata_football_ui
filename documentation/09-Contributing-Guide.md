# 09-Contributing-Guide.md - Contributing and Development Guidelines

## Project Overview

The Strata Football UI is a React-based scoring application for real-time football game management. It provides keyboard-driven workflows for rapid play entry and comprehensive statistics tracking.

## Development Setup

### Prerequisites
1. **Node.js 18+** and npm 9+
2. **Git** for version control
3. **Code Editor** (VS Code recommended)
4. **PHP/MySQL Backend** for full functionality

### Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd strata-football-ui-new

# Install dependencies
npm install

# Start development server
npm run dev
```

## Code Style and Standards

### JavaScript/React Conventions

#### Component Structure
```javascript
// Functional components with hooks (preferred)
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const ComponentName = ({ prop1, prop2, onAction }) => {
  // 1. State declarations
  const [localState, setLocalState] = useState(initialValue);
  
  // 2. Context usage
  const { gameData, submitPlay } = useGameState();
  
  // 3. Effect hooks
  useEffect(() => {
    // Effect logic
  }, [dependencies]);
  
  // 4. Event handlers
  const handleAction = (event) => {
    // Handler logic
  };
  
  // 5. Render
  return (
    <div className="component-name">
      {/* JSX content */}
    </div>
  );
};

// PropTypes validation
ComponentName.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number,
  onAction: PropTypes.func.isRequired
};

export default ComponentName;
```

#### Naming Conventions
- **Components**: PascalCase (`PlayerInput`, `GameLog`)
- **Functions**: camelCase (`handleSubmit`, `calculateYards`)
- **Variables**: camelCase (`jerseyNumber`, `gameState`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`, `API_ENDPOINTS`)
- **Files**: PascalCase for components, camelCase for utilities

#### Import Organization
```javascript
// 1. React imports
import React, { useState, useEffect } from 'react';

// 2. Third-party imports
import PropTypes from 'prop-types';

// 3. Internal imports - utilities first
import debug from '../utils/debug';
import { playerManager } from '../utils/playerManager';

// 4. Internal imports - contexts
import { useGameState } from '../contexts/FootballGameContext';

// 5. Internal imports - components
import PlayerName from './PlayerName';
import YardlineInput from './YardlineInput';
```

### CSS/Styling Guidelines

#### TailwindCSS Usage
```jsx
// Use Tailwind utility classes
<button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
  Submit
</button>

// Component-specific styles
<div className="game-log max-h-96 overflow-y-auto bg-gray-50 p-4">
  {/* content */}
</div>

// Conditional styles
<input 
  className={`border px-3 py-2 ${errors.field ? 'border-red-500' : 'border-gray-300'}`}
/>
```

#### Custom CSS Classes
```css
/* Use semantic class names for complex components */
.play-input-flow {
  /* Flow-specific styles */
}

.penalty-queued-banner {
  @apply bg-yellow-100 border-yellow-400 text-yellow-800 px-4 py-2;
}
```

### TypeScript Guidelines

#### When to Use TypeScript
- **API contracts** (required): `apiDataContract.ts`
- **Complex data structures**: Interface definitions
- **Utility functions**: Type-safe helpers
- **New files**: Prefer `.ts`/`.tsx` for new development

#### Type Definitions
```typescript
// Interface for props
interface ComponentProps {
  gameId: number;
  onSubmit: (data: PlayData) => void;
  isLoading?: boolean;
}

// Type for data structures
type PlayType = 'rush' | 'pass' | 'punt' | 'kick' | 'penalty';

// Extend existing interfaces
interface ExtendedGameState extends StandardGameState {
  customField: string;
}
```

## Git Workflow

### Branch Naming Convention
```bash
# Feature branches
feature/add-fumble-recovery-flow
feature/improve-penalty-modal

# Bug fixes
bugfix/fix-clock-display-overflow
bugfix/resolve-player-lookup-race-condition

# Hotfixes
hotfix/critical-submission-error

# Refactoring
refactor/extract-play-validation-logic
```

### Commit Message Format
```
type(scope): brief description

Detailed explanation of changes if needed.

- List specific changes
- Reference issues: Fixes #123
- Breaking changes: BREAKING CHANGE: details
```

#### Commit Types
- **feat**: New feature
- **fix**: Bug fix  
- **docs**: Documentation updates
- **style**: Code style changes (no logic changes)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Build process, dependencies, etc.

#### Examples
```bash
feat(flows): add fumble recovery workflow

- Implement fumble recovery in RushInputFlow
- Add recovery team selection
- Update state machine diagram
- Closes #45

fix(api): handle network timeout in health check

- Increase timeout to 5 seconds
- Add retry logic with exponential backoff
- Improve error messaging
- Fixes #67

refactor(utils): extract common validation logic

BREAKING CHANGE: validateYardLine function signature changed
- Now returns {valid: boolean, error?: string}
- Previously returned boolean only
```

### Pull Request Process

#### Before Opening PR
1. **Self-review**: Review your own changes
2. **Testing**: Test all affected functionality
3. **Documentation**: Update relevant docs
4. **Clean commits**: Squash/rebase if needed

#### PR Template
```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] This change requires a documentation update

## Testing
- [ ] Manual testing completed
- [ ] All flows tested
- [ ] Edge cases considered
- [ ] Cross-browser testing (if UI changes)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.log statements (use debug utility)
```

## How to Add New Features

### Adding a New Play Flow

#### 1. Create Flow Component
```bash
# Create new file
touch src/components/PlayInputFlows/NewPlayFlow.jsx
```

#### 2. Implement Flow Structure
```javascript
import React from 'react';
import { usePlayInputFlow } from '../../hooks/usePlayInputFlow';

const NewPlayFlow = ({ onComplete, onCancel, gameState }) => {
  const {
    currentStep,
    setCurrentStep,
    errors,
    setupKeyboardHandler,
    handleSubmit
  } = usePlayInputFlow({
    initialStep: 'first-step',
    onComplete,
    onCancel,
    gameState,
    submitEvent: submitNewPlay,
    playType: 'newplay'
  });

  // Step-specific rendering
  const renderStep = () => {
    switch(currentStep) {
      case 'first-step':
        return <FirstStepComponent />;
      case 'second-step':
        return <SecondStepComponent />;
      default:
        return null;
    }
  };

  return (
    <div className="new-play-flow">
      <h3>New Play Type</h3>
      {renderStep()}
    </div>
  );
};

export default NewPlayFlow;
```

#### 3. Register Flow in Modal
**File**: `src/components/FootballFlowModal.jsx`
```javascript
// Add import
import NewPlayFlow from './PlayInputFlows/NewPlayFlow';

// Add to switch statement
case 'newplay':
  return <NewPlayFlow {...flowProps} />;
```

#### 4. Add Keyboard Shortcut
**File**: `src/components/FootballHotkeyHandler.jsx`
```javascript
// Add new shortcut (example: N key)
case 'N':
  startFlow('newplay');
  break;
```

#### 5. Update Flow Context
**File**: `src/contexts/FootballFlowContext.jsx`
```javascript
// Add to available shortcuts
availableShortcuts: ['R', 'P', 'U', 'K', 'E', 'G', 'N']

// Add flow configuration
const FLOW_CONFIGS = {
  // ... existing flows
  newplay: {
    steps: ['first-step', 'second-step'],
    shortcuts: {
      'first-step': [],
      'second-step': ['Enter', 'Escape']
    }
  }
};
```

### Adding API Endpoint Integration

#### 1. Add to API Contract
**File**: `src/utils/apiDataContract.ts`
```typescript
class StandardizedAPIClient {
  static async newEndpoint(data: NewDataType): Promise<ResponseType> {
    try {
      const response = await fetch('/strata_football/api/new_endpoint.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('New endpoint failed:', error);
      throw error;
    }
  }
}
```

#### 2. Add Context Integration
```javascript
// In FootballGameContext
const callNewEndpoint = async (data) => {
  try {
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    const result = await StandardizedAPIClient.newEndpoint(data);
    
    if (result.success) {
      // Handle success
      dispatch({ type: 'UPDATE_GAME_STATE', payload: result.gameState });
    }
    
    return result;
  } catch (error) {
    dispatch({ type: 'SET_ERROR', payload: error.message });
    throw error;
  } finally {
    dispatch({ type: 'SET_SUBMITTING', payload: false });
  }
};
```

### Adding New Component

#### 1. Create Component File
```javascript
// src/components/NewComponent.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../contexts/FootballGameContext';

const NewComponent = ({ prop1, prop2, onAction }) => {
  const [localState, setLocalState] = useState('');
  const { gameData } = useGameState();

  const handleClick = () => {
    onAction(localState);
  };

  return (
    <div className="new-component bg-white p-4 rounded shadow">
      <h3>New Component</h3>
      <input
        value={localState}
        onChange={(e) => setLocalState(e.target.value)}
        className="border px-3 py-2 w-full"
      />
      <button 
        onClick={handleClick}
        className="bg-blue-500 text-white px-4 py-2 mt-2 rounded"
      >
        Submit
      </button>
    </div>
  );
};

NewComponent.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number,
  onAction: PropTypes.func.isRequired
};

export default NewComponent;
```

#### 2. Add to Parent Component
```javascript
import NewComponent from './NewComponent';

// Use in render
<NewComponent 
  prop1="value"
  prop2={123}
  onAction={handleNewComponentAction}
/>
```

## Development Guidelines

### Error Handling
```javascript
// Always wrap async operations
const handleAsyncOperation = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const result = await apiCall();
    // Handle success
    
  } catch (error) {
    console.error('Operation failed:', error);
    setError(error.message);
    
    // Optionally trigger recovery
    
  } finally {
    setLoading(false);
  }
};
```

### State Management
```javascript
// Use contexts for global state
const { gameData, submitPlay } = useGameState();

// Use local state for UI-only state
const [isExpanded, setIsExpanded] = useState(false);

// Use reducer for complex state
const [state, dispatch] = useReducer(reducer, initialState);
```

### Performance Considerations
```javascript
// Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(prop1, prop2);
}, [prop1, prop2]);

// Memoize callbacks passed to children
const handleCallback = useCallback((data) => {
  // Handle callback
}, [dependency]);

// Consider React.memo for frequently updated components
export default React.memo(Component);
```

## Testing Guidelines

### Manual Testing Checklist

#### Before Every Commit
- [ ] All affected flows work end-to-end
- [ ] Keyboard shortcuts function correctly
- [ ] Error states display properly
- [ ] Loading states work
- [ ] Data validation works
- [ ] API calls succeed/fail gracefully

#### New Feature Testing
- [ ] Happy path works
- [ ] Edge cases handled
- [ ] Error conditions tested
- [ ] Accessibility keyboard navigation
- [ ] Mobile responsiveness (if applicable)

### Writing Tests (Future Enhancement)
```javascript
// Component test example
import { render, screen, fireEvent } from '@testing-library/react';
import NewComponent from './NewComponent';

describe('NewComponent', () => {
  test('renders with required props', () => {
    const mockOnAction = jest.fn();
    render(<NewComponent prop1="test" onAction={mockOnAction} />);
    
    expect(screen.getByText('New Component')).toBeInTheDocument();
  });
  
  test('calls onAction when button clicked', () => {
    const mockOnAction = jest.fn();
    render(<NewComponent prop1="test" onAction={mockOnAction} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnAction).toHaveBeenCalled();
  });
});
```

## Code Review Guidelines

### As a Reviewer
1. **Functionality**: Does it work as intended?
2. **Code Quality**: Is it readable and maintainable?
3. **Performance**: Are there obvious performance issues?
4. **Security**: Any security concerns?
5. **Testing**: Are edge cases covered?
6. **Documentation**: Is documentation updated?

### Review Checklist
- [ ] Code follows style guidelines
- [ ] No console.log statements in production code
- [ ] Error handling implemented
- [ ] PropTypes defined for React components
- [ ] Documentation updated if needed
- [ ] No obvious performance issues
- [ ] Accessibility considerations

## Common Patterns

### Context Hook Usage
```javascript
// Custom hook for context
export const useGameState = () => {
  const context = useContext(FootballGameContext);
  if (!context) {
    throw new Error('useGameState must be used within FootballGameProvider');
  }
  return context;
};
```

### Conditional Rendering
```javascript
// Loading states
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;

// Conditional content
return (
  <div>
    {showOptional && <OptionalComponent />}
    {items.length > 0 ? (
      <ItemList items={items} />
    ) : (
      <EmptyState />
    )}
  </div>
);
```

### Event Handling
```javascript
// Prevent default for forms
const handleSubmit = (e) => {
  e.preventDefault();
  // Handle submission
};

// Async event handlers
const handleAsyncClick = async () => {
  try {
    setLoading(true);
    await performAction();
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

## Documentation Standards

### Component Documentation
```javascript
/**
 * PlayerInput - Component for selecting players by jersey number
 * 
 * Handles player lookup, disambiguation, and unknown player creation.
 * Integrates with roster management and provides keyboard navigation.
 * 
 * @param {string} team - 'home' or 'visitor'
 * @param {function} onPlayerSelected - Callback when player selected
 * @param {string} placeholder - Input placeholder text
 */
const PlayerInput = ({ team, onPlayerSelected, placeholder }) => {
```

### README Updates
When adding major features, update the main README.md with:
- Feature description
- Usage instructions
- Configuration options
- Known limitations

## Getting Help

### Resources
1. **Codebase Documentation**: `/documentation` folder
2. **API Documentation**: `03-APIs-and-Endpoints.md`
3. **Component Catalog**: `06-Components-Catalog.md`
4. **Architecture Overview**: `01-Architecture.md`

### Debugging
1. **Enable Debug Mode**: Set `window.STRATA_CONFIG.debug = true`
2. **Check Network Tab**: Monitor API calls
3. **React DevTools**: Inspect component state
4. **Console Errors**: Check browser console

### Common Issues
- **Build errors**: Check Node.js version and dependencies
- **API errors**: Verify backend is running
- **State issues**: Check context providers are properly nested
- **Flow issues**: Verify keyboard handlers and step progression