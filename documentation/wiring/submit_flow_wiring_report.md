# Submit Flow Wiring Audit Report

## Executive Summary
This report documents the complete wiring of the submit flow from frontend to backend, including payload composition, down/distance calculation, yardline normalization, and lock status polling. The audit confirms all critical paths are properly connected with the recent yardline normalization enhancements.

## 1. Frontend → Backend Payload Composition

### 1.1 Submit Event Flow (FootballGameContext.jsx)

**Location:** `/src/contexts/FootballGameContext.jsx:283-550`

The submit flow begins when a play is submitted:

```javascript
const submitEvent = async (eventData) => {
  // Line 283: Entry point
  dispatch({ type: 'SET_SUBMITTING', payload: true });
  
  // Line 376-405: Down/Distance Calculation
  const postPlayState = DownDistanceCalculator.calculateDownDistance(
    gameStateForCalculation,
    playDataForCalculation
  );
  
  // Line 409-420: Enrich event with metadata
  let enrichedEvent = {
    ...enhancedEventData,
    post_yard_line: postPlayState?.postYardLine,
    possession: currentGameState.possession,
    timestamp: new Date().toISOString()
  };
  
  // Line 510-514: Transform and submit
  const bePayload = DataTransformer.frontendToBackend(enrichedEvent);
  const result = await StandardizedAPIClient.submitPlay(gameId, bePayload);
}
```

### 1.2 Data Transformation Layer

**Location:** `/src/utils/apiDataContract.ts`

The `DataTransformer.frontendToBackend()` method handles:

1. **Field name conversion** (camelCase → snake_case)
2. **Yardline normalization** (lines 165-190):
   ```typescript
   // Normalize all yardline fields to exactly 3 chars
   const yardlineFields = [
     'yard_line', 'start_yard_line', 'end_yard_line', 
     'post_yard_line', 'kicked_to_yard_line'
   ];
   
   yardlineFields.forEach(field => {
     if (transformed[field]) {
       transformed[field] = normalizeYardlineCode(transformed[field]);
     }
   });
   ```

3. **Jersey number conversion** (possession-relative → absolute)

### 1.3 API Client Layer

**Location:** `/src/utils/apiClient.js`

- **URL normalization** ensures proper routing through Vite proxy
- **Response handling** accommodates various backend response formats
- **Error propagation** with user-friendly messages

## 2. Backend Processing & Rules

### 2.1 Play Submission Endpoint

**Location:** `/Applications/XAMPP/xamppfiles/htdocs/strata_football/api/submit_play_enhanced.php`

**Key Processing Steps:**

1. **Input validation & normalization** (lines 1093-1106):
   ```php
   // Normalize all yardline fields to exactly 3 characters
   $playData['yard_line'] = normalize_yardline($playData['yard_line']);
   $playData['end_yard_line'] = normalize_yardline($playData['end_yard_line']);
   $playData['post_yard_line'] = normalize_yardline($playData['post_yard_line']);
   ```

2. **Kickoff validation guard** (lines 1126-1132):
   ```php
   if ($isKickoff && empty($playData['end_yard_line'])) {
       http_response_code(400);
       echo json_encode(['error' => 'Kickoff plays require end_yard_line']);
       exit;
   }
   ```

3. **Down/Distance persistence** (lines 838-899):
   ```php
   function updateGameStateAfterPlay($gameId, $playData, $driveEnded) {
       // Uses frontend-calculated post_down and post_distance
       if (isset($playData['post_down'])) {
           $updates[] = "CurrentDown = ?";
           $values[] = $playData['post_down'];
       }
       if (isset($playData['post_distance'])) {
           $updates[] = "YardsToGo = ?";
           $values[] = $playData['post_distance'];
       }
   }
   ```

### 2.2 Down/Distance Rules

**Frontend Calculation:** The backend **relies on** frontend `DownDistanceCalculator` results:
- Frontend calculates `post_down` and `post_distance`
- Backend persists these values directly to `game_state` table
- No independent backend down/distance calculation found

**LineToGain Calculation:** Backend has helper functions (lines 709-798):
- `calculateLineToGainForPossession()` - possession-aware calculation
- `calculateLineToGainFromRelative()` - relative field position system
- Used when first down achieved or turnovers occur

## 3. Database Write Verification

### 3.1 Plays Table Insert

**Location:** Lines 1174-1260 of `submit_play_enhanced.php`

Critical fields written:
- `PostDown` - from frontend calculation
- `PostDistance` - from frontend calculation  
- `PostYardLinePosition` - normalized to 3 chars
- `EndYardLinePosition` - normalized to 3 chars

### 3.2 Game State Updates

**Location:** Lines 838-1060 of `submit_play_enhanced.php`

Updates applied:
- `CurrentDown` = `post_down` from frontend
- `YardsToGo` = `post_distance` from frontend
- `YardLinePosition` = normalized `post_yard_line`
- `LineToGain` = calculated when first down achieved

## 4. Lock Status Poller

### 4.1 Frontend Component

**Location:** `/src/components/LockStatus.jsx`

**Current Implementation:**
```javascript
// Line 29: Polls for lock status
const response = await fetch(
  `/strata_football/api/football/get_lock_status.php?game_id=${currentGameId}`
);
```

**Issue Found:** The endpoint `/api/football/get_lock_status.php` **does not exist** in the backend.

### 4.2 Lock Status Display

The component properly handles three states:
1. **Available** (green) - No lock or not locked
2. **You are scoring** (blue) - Current user has lock  
3. **Locked** (red) - Another user has lock

## 5. Critical Findings

### 5.1 Working Correctly ✅

1. **Yardline Normalization** - All yardline values normalized to exactly 3 chars
2. **Frontend→Backend Transform** - Proper field mapping and data conversion
3. **Kickoff Guards** - Multiple layers prevent missing `end_yard_line`
4. **Database Writes** - PostDown/PostDistance properly persisted

### 5.2 Issues Found ⚠️

1. **Missing Lock Status Endpoint**
   - Frontend polls `/api/football/get_lock_status.php`
   - This file does not exist in backend
   - Lock status polling will fail with 404 errors

2. **Down/Distance Rules**
   - Backend has no independent down/distance calculation
   - Fully relies on frontend `DownDistanceCalculator`
   - Risk if frontend sends incorrect values

3. **JSON Response Parsing**
   - Lock poller expects `data.success` and `data.lock_info`
   - Without endpoint, no way to verify response format

## 6. Data Flow Diagram

```
Frontend Submit Event
        ↓
DownDistanceCalculator.calculateDownDistance()
        ↓
DataTransformer.frontendToBackend()
        ├→ Field name conversion (camelCase → snake_case)
        └→ Yardline normalization (to 3 chars)
        ↓
StandardizedAPIClient.submitPlay()
        ↓
/api/submit_play_enhanced.php
        ├→ Input validation
        ├→ Yardline normalization (backend guard)
        ├→ Insert into plays table
        └→ Update game_state table
        ↓
Response to Frontend
        ↓
Refetch Game State
```

## 7. Recommendations

### High Priority
1. **Create `/api/football/get_lock_status.php`** endpoint
2. **Add backend down/distance validation** as a safety check
3. **Test lock status poller** after endpoint creation

### Medium Priority  
1. **Add logging** for down/distance calculations
2. **Create integration tests** for submit flow
3. **Document API response contracts**

## Conclusion

The submit flow wiring is **mostly complete** with the yardline normalization working correctly end-to-end. The primary gap is the missing lock status endpoint, which will cause polling errors. The down/distance calculation relies entirely on frontend logic without backend validation, which could be a reliability concern.