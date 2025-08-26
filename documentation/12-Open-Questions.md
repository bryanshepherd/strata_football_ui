# 12-Open-Questions.md - Ambiguities and Areas Needing Clarification

## Data Shape Uncertainties

### 1. Game State Synchronization
**Question**: How does the frontend handle concurrent game state updates?

**Context**: The application appears designed for single-user operation, but multiple scorers could theoretically access the same game.

**Observations**:
- No WebSocket or real-time update mechanism found
- Health check runs every 30 seconds but doesn't sync game state
- Optimistic updates followed by server refresh pattern

**Needs Confirmation**:
- Is multi-user concurrent scoring supported?
- Should the frontend poll for state changes?
- How are conflicts resolved if two users submit plays simultaneously?

**Suggested Probes**:
- Test with two browser sessions scoring the same game
- Check if backend implements locking or conflict resolution
- Verify if API returns version/timestamp for optimistic concurrency control

### 2. Player ID Assignment Strategy
**Question**: How are unknown players handled in the database?

**Context**: Frontend creates synthetic "UNKNOWN #XX" players with `player_id: -1`

**Current Implementation**:
```javascript
// src/utils/playerManager.js:95-105
return {
  player_id: -1,
  jersey_number: jerseyNumber,
  full_name: `UNKNOWN #${jerseyNumber}`,
  is_unknown: true
};
```

**Uncertainties**:
- Does backend accept `player_id: -1`?
- Are unknown players persisted in database?
- How are player IDs assigned for unknown players?
- Can unknown players be converted to known players later?

**Suggested Probes**:
- Submit play with unknown player and check database
- Examine backend player creation logic
- Test player disambiguation workflow end-to-end

### 3. Drive Calculation Logic
**Question**: What constitutes the start/end of a drive?

**Context**: Drive tracking appears complex with possession changes, turnovers, and special situations

**Current Logic** (inferred from code):
- New drive starts on possession change
- Drive ends on score, turnover, or punt
- Kickoffs may or may not count as drive plays

**Ambiguities**:
- Do penalty-only plays count toward drive statistics?
- How are onside kicks handled in drive calculation?
- What happens to drive stats on incomplete games?
- Are drives recalculated when plays are edited/deleted?

**Suggested Probes**:
- Test various drive scenarios (punt, turnover, score)
- Check drive stats after play deletion/editing
- Examine backend drive calculation triggers

## Behavioral Ambiguities

### 4. Clock Management Rules
**Question**: When does the game clock stop/start automatically?

**Context**: Clock display exists but automatic clock management unclear

**Code Analysis**:
- `GameClockContext` manages display time
- No automatic clock progression found
- Manual clock adjustment in `GameControlInputFlow`

**Uncertainties**:
- Should clock automatically stop on incomplete passes?
- Does clock run during play input?
- How is play clock managed?
- Are there timeout/end-of-quarter automatic stops?

**Current Behavior**: Manual clock control only
**Missing Behavior**: Football-specific clock rules

### 5. Penalty Enforcement Priority
**Question**: How are multiple penalties on same play handled?

**Context**: Penalty queuing system allows adding penalties to plays

**Current Implementation**:
- Single penalty can be queued during flow
- Combined submission includes penalty data
- PenaltyModal allows accept/decline/offset

**Unclear Cases**:
- Multiple penalties on same play (both teams)
- Penalty during penalty enforcement
- Pre-snap vs. post-snap penalty timing
- Dead ball penalties vs. live ball penalties

**Suggested Probes**:
- Test multiple penalty scenarios
- Check if backend supports penalty arrays
- Examine penalty precedence rules in code

### 6. Game Status Transitions
**Question**: How does game status change automatically?

**Context**: Game status tracked ('pregame', 'active', 'halftime', 'final') but transitions unclear

**Current Status Values**:
```javascript
status: 'pregame' | 'active' | 'halftime' | 'final' | 'suspended'
```

**Questions**:
- When does status automatically change from 'pregame' to 'active'?
- Is 'halftime' automatically triggered at end of 2nd quarter?
- How is 'final' status determined?
- Can games be reactivated after being marked 'final'?

## Technical Implementation Questions

### 7. Data Persistence Strategy  
**Question**: How is frontend state recovered after page refresh?

**Context**: React context used for state management, but persistence unclear

**Current Behavior**:
- Page refresh triggers game state reload
- Flow context resets to initial state
- No localStorage or sessionStorage observed

**Questions**:
- Should in-progress flows survive page refresh?
- Are there auto-save mechanisms for game state?
- How is data consistency maintained during network outages?

### 8. API Request Ordering
**Question**: Are API requests guaranteed to be processed in order?

**Context**: Multiple rapid submissions could cause race conditions

**Potential Issues**:
- User submits multiple plays quickly
- Network latency causes out-of-order arrival
- Optimistic updates conflict with delayed responses

**Current Mitigation**: 
- Submit button disabled during submission
- Error handling reverts optimistic updates

**Needs Investigation**:
- Does backend implement request sequencing?
- Are play numbers used to detect/prevent ordering issues?

### 9. Browser Compatibility Requirements
**Question**: What browsers and versions must be supported?

**Context**: Modern JavaScript and CSS features used

**Technical Stack Dependencies**:
- ES6+ features (arrow functions, async/await)
- Modern React patterns (hooks)
- Fetch API (no polyfill detected)
- TailwindCSS (modern CSS features)

**Assumptions**:
- Modern evergreen browsers only
- No Internet Explorer support
- Mobile browser support unclear

## Data Contract Inconsistencies

### 10. Field Name Mapping Gaps
**Question**: Are all field transformations properly handled?

**Context**: `apiDataContract.ts` handles camelCase ↔ snake_case conversion

**Observed Patterns**:
```javascript
// Frontend → Backend
gameId → game_id
playType → play_type
primaryPlayerID → primary_player_id
```

**Potential Gaps**:
- Custom field names in flows may not transform correctly
- Date/timestamp format conversions unclear
- Nested object transformation rules

**Needs Verification**:
- Test all flow submissions for correct field mapping
- Verify API response transformation completeness

### 11. Response Format Consistency
**Question**: Do all API endpoints return consistent response formats?

**Context**: Some endpoints use `{success: true, data: {...}}` others may differ

**Expected Format**:
```json
{
  "success": true,
  "data": {...},
  "message": "optional",
  "error": "if success=false"
}
```

**Inconsistencies Found**:
- Some endpoints may return data directly
- Error format standardization unclear
- Timestamp format variations possible

## User Experience Questions

### 12. Undo/Redo Functionality
**Question**: Should users be able to undo recent actions?

**Context**: Play editing and deletion exist, but no undo system

**Current Capabilities**:
- Edit individual plays via PlayEditModal
- Delete plays (with confirmation)
- Insert blank plays in sequence

**Missing Capabilities**:
- Undo last play submission
- Undo game state changes
- History of recent actions

**User Need Assessment Required**: 
- How frequently do users need to undo actions?
- What types of mistakes are most common?

### 13. Keyboard Shortcut Discoverability
**Question**: How do users learn available keyboard shortcuts?

**Context**: Extensive keyboard shortcuts but limited help system

**Current Help System**:
- EventControls shows basic shortcuts (R, P, U, K, E, G)
- InputAssistant shows context-sensitive help
- No comprehensive shortcut reference

**Missing Features**:
- Help modal with all shortcuts
- Shortcut hints in UI
- Progressive disclosure of advanced shortcuts

## Performance and Scalability

### 14. Large Game Handling
**Question**: How does performance degrade with large numbers of plays?

**Context**: Game log displays all plays, no pagination observed

**Potential Issues**:
- Memory usage with 100+ plays
- Rendering performance of long play lists
- Statistics calculation overhead
- API response size for complete game state

**Testing Scenarios Needed**:
- Simulate games with 150+ plays
- Monitor memory usage over time
- Test statistics calculation performance

### 15. Offline Capability
**Question**: Should the application work offline?

**Context**: Real-time scoring suggests network dependency, but offline capability could be valuable

**Current Dependencies**:
- Player roster data (could be cached)
- Play submission (requires connectivity)
- Game state synchronization (network dependent)

**Offline Possibilities**:
- Cache roster data for offline use
- Queue plays for submission when online
- Local-first with sync when connected

## Integration Questions

### 16. External System Integration
**Question**: Does this integrate with other sports management systems?

**Context**: References to "strata football" suggest larger ecosystem

**Unknown Integrations**:
- Team management systems
- Statistics reporting platforms
- Live streaming/broadcast integration
- Official game record systems

**API Namespace**: `/strata_football/` suggests broader platform

### 17. User Authentication and Permissions
**Question**: How is user access controlled?

**Context**: No authentication UI visible in frontend

**Assumptions**:
- Authentication handled by backend/server
- Single-user or trusted environment
- Session management via PHP sessions

**Questions**:
- Can multiple users score simultaneously?
- Are there different permission levels (scorer vs. viewer)?
- How are user sessions managed?

## Suggested Investigation Priorities

### High Priority (Affects Core Functionality)
1. **Multi-user concurrency** - Critical for production use
2. **Data persistence and recovery** - Data integrity concerns  
3. **Drive calculation rules** - Core business logic
4. **API response consistency** - System reliability

### Medium Priority (Affects User Experience)
1. **Clock management rules** - User expectations
2. **Penalty handling complexity** - Specialized workflows
3. **Browser compatibility** - Deployment considerations
4. **Performance with large games** - Scalability planning

### Low Priority (Enhancement Opportunities)
1. **Offline capability** - Nice-to-have feature
2. **Undo functionality** - User convenience
3. **External integrations** - Future expansion
4. **Advanced help system** - User training

## Recommended Resolution Process

### For Each Question:
1. **Code Investigation**: Examine related source files
2. **Backend Testing**: Test API endpoints directly
3. **Integration Testing**: Test with real backend
4. **User Research**: Observe actual usage patterns  
5. **Documentation**: Update specs based on findings
6. **Implementation**: Address gaps or ambiguities

### Documentation Updates Needed:
- **API specification** with all endpoint contracts
- **Business rules documentation** for football logic  
- **User guide** with comprehensive workflow documentation
- **Deployment guide** with browser/environment requirements