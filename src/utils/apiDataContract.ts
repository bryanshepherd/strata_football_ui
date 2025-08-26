/**
 * STRATA FOOTBALL - API DATA CONTRACT STANDARDS
 * Phase 1: Establish unified data contracts between frontend and backend
 * 
 * This module defines the standard data structures and field mappings
 * to resolve the mismatch between JSON legacy and SQL systems
 */

// ===========================
// 1. STANDARDIZED FIELD NAMES
// ===========================

/**
 * Official field name mappings to resolve frontend/backend mismatches
 */
export const FIELD_MAPPING = {
  // Game State Fields
  gameState: {
    // Frontend -> Backend mapping
    quarter: 'period',           // React uses 'quarter', backend prefers 'period'
    clock: 'timeRemaining',      // React: "15:00", Backend: seconds or "15:00"
    possession: 'possession',    // Both use 'H' or 'V'
    down: 'down',               // 1-4
    distance: 'yardsToGo',      // React: 'distance', Backend: 'yardsToGo'
    spot: 'yardLinePosition',   // React: "H35", Backend: "yardLinePosition"
    score: 'score'              // Both use {H: 0, V: 0}
  },
  
  // Play Data Fields
  playData: {
    // Core play fields
    playType: 'playType',       // rush, pass, punt, kick, etc.
    result: 'resultCode',       // Backend sometimes expects 'resultCode'
    resultCode: 'result',       // Frontend sometimes sends 'resultCode'
    
    // Player fields (multiple naming conventions)
    rusher: 'primaryPlayerID',  
    passer: 'primaryPlayerID',
    kicker: 'primaryPlayerID',
    receiver: 'secondaryPlayerID',
    target: 'secondaryPlayerID',
    
    // Yardage fields
    yardsGained: 'yardsGained',
    sackYards: 'sackYardage',   // Frontend: 'sackYards', Backend: 'sackYardage'
    sackYardage: 'sackYards',   // Reverse mapping
    
    // Tackle fields
    tackler1: 'tackler1',
    tackler2: 'tackler2',
    sackBy: ['tackler1', 'tackler2'], // Array conversion
    
    // Position fields
    startSpot: 'startYardLine',
    endSpot: 'endYardLine',
    spot: 'yardLinePosition'
  },
  
  // Statistics Fields
  stats: {
    // Team stats
    'first_downs': 'firstDowns',
    'pass_completions': 'passComp',
    'pass_attempts': 'passAtt',
    'passing_yards': 'passYds',
    'rushing_attempts': 'rushAtt',
    'rushing_yards': 'rushYds',
    'timeOfPossession': 'timeOfPossession' // Keep consistent
  }
};

// ===========================
// 2. DATA STRUCTURE TYPES
// ===========================

/**
 * Standardized Game State Structure
 */
export interface StandardGameState {
  // Core game state
  gameId: number;
  period: number;              // 1-4 (quarters) or 1+ (OT)
  timeRemaining: string;       // "MM:SS" format
  possession: 'H' | 'V';       // Home or Visitor
  down: number;                // 1-4
  yardsToGo: number;          // Distance to first down
  yardLinePosition: string;    // "H35", "V20", etc.
  
  // Scoring
  score: {
    H: number;  // Home score
    V: number;  // Visitor score
  };
  
  // Game status
  status: 'pregame' | 'active' | 'halftime' | 'final' | 'suspended';
  
  // Timeouts & challenges
  timeouts: {
    H: number;  // Home timeouts remaining
    V: number;  // Visitor timeouts remaining
  };
  
  // Optional metadata
  metadata?: {
    isGoalToGo?: boolean;
    isRedZone?: boolean;
    lastUpdated?: string;
  };
}

/**
 * Frontend Play Data Structure (camelCase)
 */
export interface StandardPlayData {
  // Required fields
  playType: 'rush' | 'pass' | 'punt' | 'kick' | 'penalty' | 'timeout' | 'other';
  description: string;         // Human-readable play description
  
  // Core play details
  resultCode?: string;         // Result code (C, I, F, T, etc.)
  yardsGained?: number;        // Net yards gained/lost
  
  // Player involvement
  primaryPlayerID?: number;    // Main player (rusher, passer, kicker)
  secondaryPlayerID?: number;  // Secondary player (receiver, target)
  tertiaryPlayerID?: number;   // Third player (tackler, etc.)
  
  // Position information
  startYardLine?: string;      // Starting field position
  endYardLine?: string;        // Ending field position
  
  // Play context
  playContext?: string;        // "H,1,10,H25" (team,down,dist,spot)
  newContext?: string;         // Context after play
  
  // Special flags
  isScoring?: boolean;
  isTurnover?: boolean;
  isFirstDown?: boolean;
  isSafety?: boolean;
  isPenalty?: boolean;
  
  // Timing
  timeElapsed?: number;        // Seconds elapsed during play
  timestamp?: string;          // When play occurred
  
  // Raw data for debugging
  rawData?: any;              // Original frontend data
}

/**
 * Backend Play Data Structure (snake_case)
 */
export interface BackendPlayData {
  // Core fields
  play_type: 'rush' | 'pass' | 'punt' | 'kick' | 'penalty' | 'timeout' | 'other';
  primary_player_id?: number;
  secondary_player_id?: number;
  result?: string;
  
  // Position fields
  yard_line?: string;
  end_yard_line?: string;
  post_yard_line?: string;
  
  // Yardage fields
  yards?: number;
  net_yards?: number;
  
  // Down and distance
  post_down?: number;
  post_distance?: number;
  
  // Flags
  has_fumble: boolean;
  is_first_down: boolean;
  is_touchdown: boolean;
  is_turnover: boolean;
  is_safety: boolean;
  
  // Tackle data
  tackler1?: number;
  tackler2?: number;
  tackler1_jersey?: string;
  tackler2_jersey?: string;
  
  // Metadata
  timestamp: string;
  possession?: string;
  is_kickoff: boolean;
  session_id: string;
  user_id: string;
  
  [key: string]: any; // Allow additional fields
}

/**
 * API Response Structure
 */
export interface StandardAPIResponse {
  success: boolean;
  error?: string;
  
  // Data payloads
  gameState?: StandardGameState;
  playLog?: StandardPlayData[];
  stats?: any;
  
  // Metadata
  timestamp: string;
  debug?: any;
}

// ===========================
// 3. DATA TRANSFORMATION UTILITIES
// ===========================

/**
 * Transform frontend data to backend format
 */
export class DataTransformer {
  
  /**
   * Convert React game state to backend format
   */
  static transformGameState(frontendData: any): StandardGameState {
    const transformed: StandardGameState = {
      gameId: frontendData.gameId || frontendData.GameID,
      period: frontendData.quarter || frontendData.period || 1,
      timeRemaining: this.clockToString(frontendData.clock || frontendData.timeRemaining || frontendData.time_remaining || "15:00"),
      possession: this.normalizePossession(frontendData.possession || 'H'),
      down: frontendData.down || 1,
      yardsToGo: frontendData.distance || frontendData.yardsToGo || frontendData.yards_to_go || 10,
      yardLinePosition: frontendData.spot || frontendData.yardLinePosition || frontendData.yard_line || 'H35',
      score: frontendData.score || { H: 0, V: 0 },
      status: frontendData.status || 'pregame',
      timeouts: frontendData.timeouts || { H: 3, V: 3 }
    };
    
    return transformed;
  }
  
  /**
   * Convert frontend data to backend format (snake_case)
   */
  static frontendToBackend(frontendData: any): any {
    const transformed: any = {
      // Core game state mappings - backend fields take precedence
      period: frontendData.period || frontendData.quarter,
      time_remaining: frontendData.time_remaining || this.clockToSeconds(frontendData.clock || frontendData.timeRemaining),
      possession: this.possessionToBackend(frontendData.possession),
      down: frontendData.down,
      distance: frontendData.distance || frontendData.yardsToGo,
      yard_line: frontendData.yardLinePosition || frontendData.spot,
      
      // Play data mappings - backend fields take precedence
      play_type: frontendData.playType,
      primary_player_id: frontendData.primary_player_id || frontendData.primaryPlayerID,
      secondary_player_id: frontendData.secondary_player_id || frontendData.secondaryPlayerID,
      yards: frontendData.yards || frontendData.yardsGained,
      net_yards: frontendData.yardsGained,
      post_down: frontendData.postDown,
      post_distance: frontendData.postDistance,
      post_yard_line: frontendData.postYardLine || frontendData.endYardLine,
      
      // Backend flags - backend fields take precedence
      is_touchdown: frontendData.hasOwnProperty('is_touchdown') ? frontendData.is_touchdown : (frontendData.isTouchdown || false),
      is_first_down: frontendData.hasOwnProperty('is_first_down') ? frontendData.is_first_down : (frontendData.isFirstDown || false),
      is_turnover: frontendData.hasOwnProperty('is_turnover') ? frontendData.is_turnover : (frontendData.isTurnover || false),
      has_fumble: frontendData.hasOwnProperty('has_fumble') ? frontendData.has_fumble : (frontendData.hasFumble || false),
      is_safety: frontendData.hasOwnProperty('is_safety') ? frontendData.is_safety : (frontendData.isSafety || false),
      is_kickoff: frontendData.hasOwnProperty('is_kickoff') ? frontendData.is_kickoff : (frontendData.isKickoff || false),
      
      // Ensure drive meta is included if present
      ...(frontendData.drive_ends !== undefined ? { drive_ends: !!frontendData.drive_ends } : {}),
      ...(frontendData.drive_result ? { drive_result: String(frontendData.drive_result) } : {})
    };
    
    // Remove undefined values
    Object.keys(transformed).forEach(key => {
      if (transformed[key] === undefined) {
        delete transformed[key];
      }
    });
    
    return transformed;
  }
  
  /**
   * Convert backend data to frontend format (camelCase) 
   */
  static backendToFrontend(backendData: any): any {
    const transformed = {
      // Core game state mappings
      quarter: backendData.period || backendData.quarter,
      clock: this.secondsToClock(backendData.time_remaining) || backendData.timeRemaining,
      possession: this.possessionToFrontend(backendData.possession),
      down: backendData.down,
      yardsToGo: backendData.distance || backendData.yards_to_go,
      yardLinePosition: backendData.yard_line,
      
      // Play data mappings
      playType: backendData.play_type,
      primaryPlayerID: backendData.primary_player_id,
      secondaryPlayerID: backendData.secondary_player_id,
      yardsGained: backendData.yards || backendData.net_yards,
      postDown: backendData.post_down,
      postDistance: backendData.post_distance,
      endYardLine: backendData.post_yard_line,
      
      // Frontend flags
      isTouchdown: backendData.is_touchdown || false,
      isFirstDown: backendData.is_first_down || false,
      isTurnover: backendData.is_turnover || false,
      hasFumble: backendData.has_fumble || false,
      isSafety: backendData.is_safety || false,
      isKickoff: backendData.is_kickoff || false
    };
    
    // Remove undefined values
    Object.keys(transformed).forEach(key => {
      if (transformed[key] === undefined) {
        delete transformed[key];
      }
    });
    
    return transformed;
  }
  
  /**
   * Convert React play data to backend format
   * Transforms camelCase frontend fields to snake_case backend fields
   */
  static transformPlayData(frontendData: any): any {
    // Transform to backend expected format with snake_case fields
    const transformed: any = {
      // Core play fields - map camelCase to snake_case
      play_type: frontendData.playType || frontendData.play_type || 'other',
      primary_player_id: frontendData.primaryPlayerID || frontendData.primary_player_id || this.getPrimaryPlayer(frontendData),
      secondary_player_id: frontendData.secondaryPlayerID || frontendData.secondary_player_id || this.getSecondaryPlayer(frontendData),
      
      // Result mapping - backend expects 'result' not 'resultCode'
      result: frontendData.resultCode || frontendData.result,
      
      // Yard line fields
      yard_line: frontendData.yardLine || frontendData.yard_line || frontendData.startSpot,
      end_yard_line: frontendData.endYardLine || frontendData.end_yard_line || frontendData.finalSpot,
      post_yard_line: frontendData.post_yard_line || frontendData.endYardLine,
      
      // Yardage fields
      yards: frontendData.yardsGained || frontendData.yards || 0,
      net_yards: frontendData.netYards || frontendData.net_yards || frontendData.yardsGained || 0,
      
      // Down and distance
      post_down: frontendData.postDown || frontendData.post_down,
      post_distance: frontendData.postDistance || frontendData.post_distance,
      
      // Flags - maintain snake_case
      has_fumble: frontendData.has_fumble !== undefined ? frontendData.has_fumble : false,
      is_first_down: frontendData.isFirstDown || frontendData.is_first_down || false,
      is_touchdown: frontendData.isTouchdown || frontendData.is_touchdown || false,
      is_turnover: frontendData.isTurnover || frontendData.is_turnover || false,
      is_safety: frontendData.isSafety || frontendData.is_safety || false,
      
      // Play type specific fields
      sub_type: frontendData.sub_type || frontendData.subType,
      
      // Penalty fields
      penaltyQueued: frontendData.penaltyQueued || false,
      
      // Timing and metadata
      timestamp: frontendData.timestamp || new Date().toISOString(),
      
      // Context from enriched data
      possession: frontendData.possession,
      is_kickoff: frontendData.is_kickoff || false,
      session_id: frontendData.session_id || 'current-session',
      user_id: frontendData.user_id || 'current-user'
    };
    
    // Handle tackler data - preserve IDs as primary data
    if (frontendData.tackler1_id) {
      transformed.tackler1 = frontendData.tackler1_id;
      transformed.tackler1_jersey = frontendData.tackler1_jersey;
    }
    if (frontendData.tackler2_id) {
      transformed.tackler2 = frontendData.tackler2_id;
      transformed.tackler2_jersey = frontendData.tackler2_jersey;
    }
    
    // Preserve additional fields that might be needed
    const additionalFields = [
      'forcedBy', 'recoveringTeam', 'recoveringPlayer', 'recoverySpot',
      'blockingPlayer', 'kickType', 'kicked_to_yard_line', 'kickResult',
      'drive_ends', 'drive_result', 'is_goal_to_go', 'is_red_zone',
      'line_to_gain'
    ];
    
    additionalFields.forEach(field => {
      if (frontendData[field] !== undefined) {
        transformed[field] = frontendData[field];
      }
    });
    
    return transformed;
  }
  
  /**
   * Convert backend data to frontend format
   */
  static transformToFrontend(backendData: any): any {
    const transformed = {
      gameId: backendData.GameID || backendData.gameId,
      quarter: backendData.period || backendData.quarter || 1,
      clock: backendData.timeRemaining || backendData.clock || "15:00",
      possession: backendData.possession || 'H',
      down: backendData.down || 1,
      distance: backendData.yardsToGo || backendData.distance || 10,
      spot: backendData.yardLinePosition || backendData.spot || 'H35',
      score: backendData.score || { H: 0, V: 0 }
    };
    
    return transformed;
  }
  
  /**
   * Helper: Extract primary player from various field names
   */
  private static getPrimaryPlayer(data: any): number | undefined {
    return data.primaryPlayerID || 
           data.rusher || 
           data.passer || 
           data.kicker || 
           data.playerID ||
           data.playerId;
  }
  
  /**
   * Helper: Extract secondary player from various field names
   */
  private static getSecondaryPlayer(data: any): number | undefined {
    return data.secondaryPlayerID || 
           data.receiver || 
           data.target || 
           data.returner;
  }
  
  /**
   * Helper: Generate play description if missing
   */
  private static generateDescription(data: any): string {
    const type = data.playType || 'play';
    const player = data.rusher || data.passer || data.kicker || 'Player';
    const yards = data.yardsGained || 0;
    
    return `${type} by ${player} for ${yards} yards`;
  }
  
  /**
   * Helper: Estimate play time based on play type
   */
  private static estimatePlayTime(data: any): number {
    switch (data.playType) {
      case 'rush': return 30;
      case 'pass': return data.result === 'I' ? 20 : 35;
      case 'punt': return 45;
      case 'kick': return 25;
      default: return 30;
    }
  }
  
  /**
   * Clock conversion utilities
   */
  static clockToSeconds(clock: string | number): number {
    if (typeof clock === 'number') return clock;
    if (!clock || typeof clock !== 'string') return 900; // Default 15:00
    
    const parts = clock.split(':');
    if (parts.length !== 2) return 900;
    
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    return (minutes * 60) + seconds;
  }
  
  static secondsToClock(seconds: number | string): string {
    const totalSeconds = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
    if (isNaN(totalSeconds)) return "15:00";
    
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
  
  static clockToString(clock: string | number): string {
    if (typeof clock === 'string') return clock;
    return this.secondsToClock(clock);
  }
  
  /**
   * Possession conversion utilities
   */
  static possessionToBackend(possession: string): 'H' | 'V' {
    if (!possession) return 'H';
    const normalized = possession.toLowerCase().trim();
    
    switch (normalized) {
      case 'home':
      case 'h':
      case '1':
        return 'H';
      case 'visitor':
      case 'away':
      case 'v':
      case '2':
        return 'V';
      default:
        return 'H';
    }
  }
  
  static possessionToFrontend(possession: string): 'home' | 'visitor' {
    if (!possession) return 'home';
    const normalized = possession.toUpperCase().trim();
    
    switch (normalized) {
      case 'H':
      case 'HOME':
      case '1':
        return 'home';
      case 'V':
      case 'VISITOR':
      case 'AWAY':
      case '2':
        return 'visitor';
      default:
        return 'home';
    }
  }
  
  static normalizePossession(possession: string): 'H' | 'V' {
    return this.possessionToBackend(possession);
  }
}

// ===========================
// 4. VALIDATION UTILITIES
// ===========================

/**
 * Data validation helpers
 */
export class DataValidator {
  
  /**
   * Validate game state data
   */
  static validateGameState(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.gameId && !data.GameID) {
      errors.push('Game ID is required');
    }
    
    if (data.period && (data.period < 1 || data.period > 10)) {
      errors.push('Period must be between 1-10');
    }
    
    if (data.possession && !['H', 'V'].includes(data.possession)) {
      errors.push('Possession must be H or V');
    }
    
    if (data.down && (data.down < 1 || data.down > 4)) {
      errors.push('Down must be between 1-4');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate play data
   */
  static validatePlayData(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.playType) {
      errors.push('Play type is required');
    }
    
    const validPlayTypes = ['rush', 'pass', 'punt', 'kick', 'penalty', 'timeout', 'other'];
    if (data.playType && !validPlayTypes.includes(data.playType)) {
      errors.push(`Invalid play type: ${data.playType}`);
    }
    
    if (data.yardsGained && (data.yardsGained < -50 || data.yardsGained > 100)) {
      errors.push('Yards gained must be between -50 and 100');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// ===========================
// 5. API CLIENT WITH STANDARDIZATION
// ===========================

/**
 * Enhanced API client that handles data transformation
 */
export class StandardizedAPIClient {
  private static baseUrl = '/strata_football/api/';
  
  /**
   * Load game state with data transformation
   */
  static async loadGameState(gameId: number): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}load_game_state.php?game_id=${gameId}`);
      const rawData = await response.json();
      
      if (rawData.error) {
        throw new Error(rawData.error);
      }
      
      // Return the full response including gameInfo
      return {
        ...DataTransformer.transformGameState(rawData.gameState),
        gameInfo: rawData.gameInfo,
        playLog: rawData.playLog,
        stats: rawData.stats,
        driveChart: rawData.driveChart,
        gameRules: rawData.gameRules
      };
      
    } catch (error) {
      console.error('Error loading game state:', error);
      throw error;
    }
  }
  
  /**
   * Submit play with data transformation
   */
  static async submitPlay(gameId: number, playData: any): Promise<StandardAPIResponse> {
    try {
      // Transform frontend data to backend format
      const backendPlayData = DataTransformer.transformPlayData(playData);
      
      // Basic validation - ensure required fields are present
      if (!backendPlayData.play_type) {
        throw new Error('Invalid play data: play_type is required');
      }
      
      const response = await fetch(`${this.baseUrl}submit_play_enhanced.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: gameId,
          play_data: backendPlayData
        })
      });
      
      const result = await response.json();
      
      // Transform response data
      if (result.gameState) {
        result.gameState = DataTransformer.transformToFrontend(result.gameState);
      }
      
      return result;
      
    } catch (error) {
      console.error('Error submitting play:', error);
      throw error;
    }
  }
}

// ===========================
// 6. USAGE EXAMPLES
// ===========================

/**
 * Example: How to use the standardized system
 */
export const UsageExamples = {
  
  // Frontend component using standardized API
  async handlePlaySubmission(playData: any) {
    try {
      // Data is automatically transformed and validated
      const result = await StandardizedAPIClient.submitPlay(123, playData);
      
      if (result.success) {
        debug.log('Play submitted successfully');
        // result.gameState is already in frontend format
        updateGameState(result.gameState);
      }
    } catch (error) {
      console.error('Play submission failed:', error);
    }
  },
  
  // Backend API endpoint using transformations
  async processIncomingPlay(rawData: any) {
    // Transform incoming data to standard format
    const standardPlay = DataTransformer.transformPlayData(rawData);
    
    // Validate
    const validation = DataValidator.validatePlayData(standardPlay);
    if (!validation.valid) {
      throw new Error('Invalid data: ' + validation.errors.join(', '));
    }
    
    // Process with standardized data
    return processPlay(standardPlay);
  }
};

export default {
  FIELD_MAPPING,
  DataTransformer,
  DataValidator,
  StandardizedAPIClient,
  UsageExamples
};
