<?php
/**
 * YARD LINE CONVERSION UTILITIES
 * Compatible with PHP 7.4
 * 
 * Converts between string format (H25, V35) and relative yard line (0-100)
 * 
 * RELATIVE YARD LINE SYSTEM:
 * 0   = Home team's goal line
 * 25  = Home team's 25 yard line  
 * 50  = Midfield (50 yard line)
 * 75  = Visitor team's 25 yard line
 * 100 = Visitor team's goal line
 */

class YardLineConverter {
    
    /**
     * Convert string position (H25, V35) to relative yard line (0-100)
     * 
     * @param string $position Format: H25, V35, H50, etc.
     * @return int Relative yard line (0-100)
     * @throws InvalidArgumentException
     */
    public static function stringToRelative($position) {
        if (empty($position) || strlen($position) < 2) {
            throw new InvalidArgumentException("Invalid yard line position: $position");
        }
        
        $side = strtoupper(substr($position, 0, 1));
        $yard = (int)substr($position, 1);
        
        // Validate side
        if ($side !== 'H' && $side !== 'V') {
            throw new InvalidArgumentException("Invalid side '$side'. Must be 'H' or 'V'");
        }
        
        // Validate yard line (1-50, or 0 for goal line in some contexts)
        if ($yard < 0 || $yard > 50) {
            throw new InvalidArgumentException("Invalid yard line '$yard'. Must be 0-50");
        }
        
        // Convert to relative position
        if ($side === 'H') {
            return $yard; // Home side: H25 = 25 yards from home goal
        } else {
            return 100 - $yard; // Visitor side: V25 = 75 yards from home goal
        }
    }
    
    /**
     * Convert relative yard line (0-100) to string position (H25, V35)
     * 
     * @param int $relative Relative yard line (0-100)
     * @return string Format: H25, V35, etc.
     * @throws InvalidArgumentException
     */
    public static function relativeToString($relative) {
        if ($relative < 0 || $relative > 100) {
            throw new InvalidArgumentException("Invalid relative yard line '$relative'. Must be 0-100");
        }
        
        if ($relative <= 50) {
            // Home side of field
            return 'H' . $relative;
        } else {
            // Visitor side of field  
            $visitorYard = 100 - $relative;
            return 'V' . $visitorYard;
        }
    }
    
    /**
     * Calculate yards gained between two positions
     * 
     * @param string $startPosition Starting position (H25, V35, etc.)
     * @param string $endPosition Ending position (H30, V20, etc.)
     * @param string $possessionTeam 'HOME' or 'VISITOR'
     * @return int Yards gained (positive) or lost (negative)
     */
    public static function calculateYardsGained($startPosition, $endPosition, $possessionTeam) {
        $startRelative = self::stringToRelative($startPosition);
        $endRelative = self::stringToRelative($endPosition);
        
        if ($possessionTeam === 'HOME') {
            // For home team, advancing toward visitor goal (100) is positive
            return $endRelative - $startRelative;
        } else {
            // For visitor team, advancing toward home goal (0) is positive
            return $startRelative - $endRelative;
        }
    }
    
    /**
     * Calculate distance to goal line
     * 
     * @param string $position Current position (H25, V35, etc.)
     * @param string $possessionTeam 'HOME' or 'VISITOR' 
     * @return int Distance to goal in yards
     */
    public static function distanceToGoal($position, $possessionTeam) {
        $relative = self::stringToRelative($position);
        
        if ($possessionTeam === 'HOME') {
            // Home team attacking toward visitor goal (100)
            return 100 - $relative;
        } else {
            // Visitor team attacking toward home goal (0)
            return $relative;
        }
    }
    
    /**
     * Check if position is in red zone (within 20 yards of goal)
     * 
     * @param string $position Current position (H25, V35, etc.)
     * @param string $possessionTeam 'HOME' or 'VISITOR'
     * @return bool True if in red zone
     */
    public static function isRedZone($position, $possessionTeam) {
        return self::distanceToGoal($position, $possessionTeam) <= 20;
    }
    
    /**
     * Check if it's goal-to-go situation (within 10 yards of goal)
     * 
     * @param string $position Current position
     * @param string $possessionTeam 'HOME' or 'VISITOR'
     * @return bool True if goal-to-go
     */
    public static function isGoalToGo($position, $possessionTeam) {
        return self::distanceToGoal($position, $possessionTeam) <= 10;
    }
    
    /**
     * Get field position description for display
     * 
     * @param string $position Current position (H25, V35, etc.)
     * @return string Human-readable description
     */
    public static function getPositionDescription($position) {
        $side = substr($position, 0, 1);
        $yard = (int)substr($position, 1);
        
        if ($yard === 50) {
            return "50 Yard Line (Midfield)";
        } elseif ($yard === 0) {
            return ($side === 'H') ? "Home Goal Line" : "Visitor Goal Line";
        } else {
            $teamName = ($side === 'H') ? "Home" : "Visitor";
            return "$teamName $yard Yard Line";
        }
    }
    
    /**
     * Parse yard line string into components
     * 
     * @param string $position Yard line position (H25, V35, etc.)
     * @return array ['side' => 'H'|'V', 'yard' => int, 'relative' => int]
     */
    public static function parsePosition($position) {
        $side = strtoupper(substr($position, 0, 1));
        $yard = (int)substr($position, 1);
        $relative = self::stringToRelative($position);
        
        return [
            'side' => $side,
            'yard' => $yard,
            'relative' => $relative,
            'description' => self::getPositionDescription($position)
        ];
    }
}

// ============================================================================
// USAGE EXAMPLES & TESTS
// ============================================================================

if (php_sapi_name() === 'cli') {
    echo "=== YARD LINE CONVERTER EXAMPLES ===\n\n";
    
    // Example 1: Basic conversions
    echo "1. STRING TO RELATIVE CONVERSIONS:\n";
    $positions = ['H25', 'H50', 'V25', 'V10', 'H01', 'V01'];
    foreach ($positions as $pos) {
        $relative = YardLineConverter::stringToRelative($pos);
        echo "  $pos -> $relative yard line\n";
    }
    
    echo "\n2. RELATIVE TO STRING CONVERSIONS:\n";
    $relatives = [0, 25, 50, 75, 99];
    foreach ($relatives as $rel) {
        $string = YardLineConverter::relativeToString($rel);
        echo "  $rel -> $string\n";
    }
    
    // Example 2: Yards gained calculation
    echo "\n3. YARDS GAINED CALCULATIONS:\n";
    $scenarios = [
        ['H25', 'H30', 'HOME', '5 yard gain'],
        ['H25', 'H20', 'HOME', '5 yard loss'],
        ['V25', 'V30', 'VISITOR', '5 yard gain'],
        ['H25', 'V25', 'HOME', '50 yard gain (crossed midfield)']
    ];
    
    foreach ($scenarios as [$start, $end, $team, $expected]) {
        $yards = YardLineConverter::calculateYardsGained($start, $end, $team);
        echo "  $start to $end ($team): $yards yards ($expected)\n";
    }
    
    // Example 3: Field position analysis
    echo "\n4. FIELD POSITION ANALYSIS:\n";
    $testPositions = ['H15', 'H45', 'V20', 'V05'];
    foreach ($testPositions as $pos) {
        $parsed = YardLineConverter::parsePosition($pos);
        $homeDistance = YardLineConverter::distanceToGoal($pos, 'HOME');
        $visitorDistance = YardLineConverter::distanceToGoal($pos, 'VISITOR');
        $homeRedZone = YardLineConverter::isRedZone($pos, 'HOME') ? 'YES' : 'NO';
        $visitorRedZone = YardLineConverter::isRedZone($pos, 'VISITOR') ? 'YES' : 'NO';
        
        echo "  Position: {$parsed['description']}\n";
        echo "    Relative: {$parsed['relative']}\n";
        echo "    Distance to goal (HOME): $homeDistance yards (Red Zone: $homeRedZone)\n";
        echo "    Distance to goal (VISITOR): $visitorDistance yards (Red Zone: $visitorRedZone)\n";
        echo "\n";
    }
}

// ============================================================================
// INTEGRATION WITH DRIVES AND PLAYS
// ============================================================================

/**
 * Example: Calculate drive distance
 */
function calculateDriveDistance($startPosition, $endPosition, $possessionTeam) {
    return YardLineConverter::calculateYardsGained($startPosition, $endPosition, $possessionTeam);
}

/**
 * Example: Update game state flags based on position
 */
function updateGameStateFlags($position, $possessionTeam) {
    return [
        'IsRedZone' => YardLineConverter::isRedZone($position, $possessionTeam) ? 1 : 0,
        'IsGoalToGo' => YardLineConverter::isGoalToGo($position, $possessionTeam) ? 1 : 0
    ];
}

/**
 * Example: Format position for DriveStatusBar
 */
function formatPositionForDisplay($position) {
    $parsed = YardLineConverter::parsePosition($position);
    return [
        'display' => $parsed['description'],
        'relative' => $parsed['relative'],
        'side' => $parsed['side'],
        'yard' => $parsed['yard']
    ];
}
?>
