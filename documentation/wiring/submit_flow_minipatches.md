# Submit Flow Mini-Patches

## 1. Create Missing Lock Status Endpoint

**File:** `/Applications/XAMPP/xamppfiles/htdocs/strata_football/api/football/get_lock_status.php` (NEW)

```php
<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../db_pdo.php';

$gameId = $_GET['game_id'] ?? null;

if (!$gameId) {
    echo json_encode(['success' => false, 'error' => 'Missing game_id']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT 
            IsLocked as is_locked,
            LockedBy as locked_by,
            LockedByUser as locked_by_user,
            LockedAt as locked_at,
            CASE 
                WHEN LockedBy = ? THEN 1 
                ELSE 0 
            END as can_edit
        FROM game_state 
        WHERE GameID = ?
    ");
    
    $currentUser = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $stmt->execute([$currentUser, $gameId]);
    $lockInfo = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'lock_info' => $lockInfo ?: [
            'is_locked' => false,
            'locked_by' => null,
            'locked_by_user' => null,
            'locked_at' => null,
            'can_edit' => true
        ]
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
```

## 2. Add Backend Down/Distance Validation

**File:** `/Applications/XAMPP/xamppfiles/htdocs/strata_football/api/submit_play_enhanced.php`

**Location:** After line 1160, add validation:

```diff
 // Calculate yards gained from field positions
 $yardsGained = calculateNetYards($yardLine, $endYardLine, $possessionTeam);
 $netYards = $yardsGained; // Same as yards gained for most plays
 
+// Validate frontend down/distance calculations
+if (isset($playData['post_down']) && isset($playData['post_distance'])) {
+    // Basic sanity checks
+    if ($playData['post_down'] < 1 || $playData['post_down'] > 4) {
+        error_log("WARNING: Invalid post_down from frontend: " . $playData['post_down']);
+        $playData['post_down'] = min(4, max(1, $playData['post_down']));
+    }
+    if ($playData['post_distance'] < 0 || $playData['post_distance'] > 99) {
+        error_log("WARNING: Invalid post_distance from frontend: " . $playData['post_distance']);
+        $playData['post_distance'] = min(99, max(0, $playData['post_distance']));
+    }
+}
+
 // Calculate if first down was achieved
```

## 3. Add Missing DB Columns for Lock Status

**File:** SQL Migration (run in phpMyAdmin)

```sql
-- Add lock columns to game_state if missing
ALTER TABLE game_state 
ADD COLUMN IF NOT EXISTS IsLocked BOOLEAN DEFAULT 0,
ADD COLUMN IF NOT EXISTS LockedBy VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS LockedByUser VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS LockedAt TIMESTAMP NULL DEFAULT NULL;

-- Add index for lock queries
CREATE INDEX IF NOT EXISTS idx_game_lock 
ON game_state(GameID, IsLocked);
```

## 4. Fix Lock Status Component Error Handling

**File:** `/Users/bryanshepherd/strata-football-ui-new/src/components/LockStatus.jsx`

**Location:** Lines 28-40, improve error handling:

```diff
 const pollInterval = setInterval(async () => {
   try {
     const response = await fetch(`/strata_football/api/football/get_lock_status.php?game_id=${currentGameId}`);
+    
+    // Check if response is OK before parsing
+    if (!response.ok) {
+      debug.warn('[LockStatus] Lock endpoint not available (HTTP ' + response.status + ')');
+      return;
+    }
+    
     const data = await response.json();
     
     if (data.success && data.lock_info) {
       setLockStatus(data.lock_info);
       setLastPollTime(new Date());
       debug.debug('[LockStatus] Lock status updated:', data.lock_info);
     }
   } catch (error) {
-    debug.error('[LockStatus] Error polling lock status:', error);
+    // Silently fail - endpoint might not exist yet
+    debug.debug('[LockStatus] Lock polling skipped:', error.message);
   }
 }, 30000); // Poll every 30 seconds
```

## 5. Add Debug Logging for Down/Distance

**File:** `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx`

**Location:** After line 405, add detailed logging:

```diff
 debug.log('Down-Distance Calculation (Possession-Relative + LineToGain):', {
   current: gameStateForCalculation,
   play: playDataForCalculation,
   calculated: postPlayState,
   netYards: netYards
 });
+
+// Add validation warning
+if (postPlayState) {
+  if (postPlayState.postDown < 1 || postPlayState.postDown > 4) {
+    debug.warn('⚠️ Calculated invalid down:', postPlayState.postDown);
+  }
+  if (postPlayState.postDistance < 0 || postPlayState.postDistance > 99) {
+    debug.warn('⚠️ Calculated invalid distance:', postPlayState.postDistance);
+  }
+}
```

## Summary

These mini-patches address the critical gaps found in the wiring audit:

1. **Creates the missing lock status endpoint** that the frontend is polling
2. **Adds backend validation** for down/distance values as a safety check
3. **Creates database schema** for lock status fields if missing
4. **Improves error handling** so missing endpoint doesn't spam console
5. **Adds debug logging** to catch calculation issues early

Total lines changed: ~100 lines across 5 files