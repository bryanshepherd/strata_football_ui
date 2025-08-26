import React, { createContext, useContext, useReducer, useEffect } from 'react';
import DownDistanceCalculator, { 
  calculateNextDownDistance, 
  applyPenaltyToDownDistance, 
  shouldEndDrive, 
  promptForGameTime 
} from '../utils/DownDistanceCalculator';
import { StandardizedAPIClient, DataTransformer } from '../utils/apiDataContract';
import { apiGet, apiPost, footballAPI, getApiErrorMessage } from '../utils/apiClient';
import { 
  shouldStartNewDrive, 
  shouldEndDrive as driveRulesShouldEndDrive, 
  analyzeDriveTransition,
  calculateDriveStats 
} from '../utils/driveRules';
import debug from '../utils/debug';

const FootballGameContext = createContext();

const initialState = {
  gameData: null,
  isSubmitting: false,
  error: null,
  debugMode: false,
  debugGameId: '',
  apiStatus: 'connecting' // 'connected', 'connecting', 'error', 'disconnected'
};

function reducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isSubmitting: true, error: null };
    case 'FETCH_SUCCESS':
      return { 
        ...state, 
        gameData: action.payload, 
        isSubmitting: false, 
        error: null,
        apiStatus: 'connected'
      };
    case 'FETCH_ERROR':
      return { 
        ...state, 
        error: action.payload, 
        isSubmitting: false,
        apiStatus: 'error'
      };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, error: null };
    case 'SUBMIT_SUCCESS':
      return { 
        ...state, 
        gameData: action.payload, 
        isSubmitting: false, 
        error: null,
        apiStatus: 'connected'
      };
    case 'SUBMIT_ERROR':
      return { 
        ...state, 
        error: action.payload, 
        isSubmitting: false,
        apiStatus: 'error'
      };
    case 'SET_GAME_DATA':
      return { 
        ...state, 
        gameData: action.payload, 
        error: null,
        apiStatus: 'connected'
      };
    case 'SET_API_STATUS':
      return { ...state, apiStatus: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_DEBUG_GAME_ID':
      return { ...state, debugGameId: action.payload };
    case 'TOGGLE_DEBUG_MODE':
      return { ...state, debugMode: !state.debugMode };
    // Additional supported action types
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isSubmitting: false, apiStatus: 'error' };
    case 'SET_CONNECTED':
      return { ...state, apiStatus: action.payload ? 'connected' : 'disconnected' };
    case 'SET_LAST_PLAY':
      return { ...state, lastPlayData: action.payload };
    case 'UPDATE_DRIVE_STATS':
      return { ...state, currentDrive: action.payload };
    case 'SET_CURRENT_DRIVE':
      return { ...state, currentDrive: action.payload };
    default:
      return state;
  }
}

export function FootballGameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Use proxy path for API calls (configured in vite.config.js)
  const API_BASE = '/strata_football/api';

  const fetchGameState = async (gameId) => {
    try {
      debug.log("🔄 [DATA CONTRACT] Loading game state for:", gameId);
      
      // Use standardized client
      const gameState = await StandardizedAPIClient.loadGameState(gameId);
      
      debug.log("✅ [DATA CONTRACT] Standardized game state:", gameState);
      
      // Load rosters separately
      debug.log("🔄 [ROSTERS] Loading rosters for gameId:", gameId);
      let rostersData = { home: [], visitor: [] };
      
      try {
        const rosterResult = await apiGet(`api/get_rosters.php?gameId=${gameId}`);
        
        if (rosterResult.success && rosterResult.rosters) {
          rostersData = rosterResult.rosters;
          debug.log("✅ [ROSTERS] Loaded rosters:", {
            homeCount: rostersData.home?.length || 0,
            visitorCount: rostersData.visitor?.length || 0
          });
        } else {
          debug.warn("⚠️ [ROSTERS] Failed to load rosters:", rosterResult.error || 'Unknown error');
        }
      } catch (rosterError) {
        debug.error("❌ [ROSTERS] Error loading rosters:", getApiErrorMessage(rosterError));
      }
      
      const apiData = { gameState, success: true };
      
      // Transform API data to match component expectations
      const transformedData = {
        game_info: {
          game_id: gameId,
          home_team_name: gameState.gameInfo?.home_team_name || 'Home Team',
          home_team_short: gameState.gameInfo?.home_team_short || 'HOME',
          home_team_abbr: gameState.gameInfo?.home_team_abbr || 'HOME',
          visitor_team_name: gameState.gameInfo?.visitor_team_name || 'Away Team',
          visitor_team_short: gameState.gameInfo?.visitor_team_short || 'AWAY',
          visitor_team_abbr: gameState.gameInfo?.visitor_team_abbr || 'AWAY',
          home_team_id: gameState.gameInfo?.home_team_id || 1,
          visitor_team_id: gameState.gameInfo?.visitor_team_id || 2,
          game_date: gameState.gameInfo?.game_date || new Date().toISOString(),
          venue: gameState.gameInfo?.venue || 'Stadium'
        },
        live_state: {
          game_status: gameState.status || 'in_progress',
          quarter: gameState.period || 1,
          time_remaining: (() => {
            // Convert "MM:SS" string to seconds
            if (typeof gameState.timeRemaining === 'string' && gameState.timeRemaining.includes(':')) {
              const [mins, secs] = gameState.timeRemaining.split(':').map(Number);
              return (mins * 60) + secs;
            }
            return typeof gameState.timeRemaining === 'number' ? gameState.timeRemaining : 900;
          })(),
          possession: (() => {
            const result = gameState.possession === 'H' ? 'home' : 'visitor';
            debug.debug('[FootballGameContext] Possession mapping:', {
              original: gameState.possession,
              mapped: result
            });
            return result;
          })(),
          down: gameState.down || 1,
          distance: gameState.yardsToGo || 10,
          yard_line: gameState.yardLinePosition || gameState.spot || 'H25',
          home_score: gameState.score?.H || 0,
          visitor_score: gameState.score?.V || 0,
          home_timeouts: gameState.timeouts?.H || 3,
          visitor_timeouts: gameState.timeouts?.V || 3,
          play_clock: 40
        },
        recent_plays: gameState.playLog || [],
        team_stats: gameState.stats?.teams || { home: {}, visitor: {} },
        player_stats: gameState.stats?.players || {},
        stats: gameState.stats || { teams: { home: {}, visitor: {} } },
        rosters: rostersData
      };
      
      debug.log('API Response:', apiData);
      debug.log('Transformed Data:', transformedData);
      debug.log('Transformed live_state:', transformedData.live_state);
      
      dispatch({ type: 'FETCH_SUCCESS', payload: transformedData });
      return transformedData;
    } catch (error) {
      debug.error('Error fetching game state:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
      dispatch({ type: 'SET_CONNECTED', payload: false });
      throw error;
    }
  };

  const submitEvent = async (eventData) => {
    // [CTX IN] Enhanced entry logging with comprehensive state
    debug.log('[CTX IN] submitEvent entry - comprehensive state:', {
      play_type: eventData.play_type,
      sub_type: eventData.sub_type,
      is_kickoff: eventData.is_kickoff,
      end_yard_line: eventData.end_yard_line,
      finalYardLine: eventData.finalYardLine,
      post_yard_line: eventData.post_yard_line,
      eventDataKeys: Object.keys(eventData),
      timestamp: new Date().toISOString()
    });

    // 3a) Log entry with kickoff detection (keep for backward compatibility)
    debug.log('[KICK API] submitEvent entry:', {
      play_type: eventData.play_type,
      sub_type: eventData.sub_type,
      is_kickoff: eventData.is_kickoff,
      end_yard_line: eventData.end_yard_line,
      finalYardLine: eventData.finalYardLine,
      eventDataKeys: Object.keys(eventData)
    });

    dispatch({ type: 'SET_SUBMITTING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      // Get current game state for down-distance calculation
      const currentGameState = state.gameData?.live_state || {};
      
      // Calculate next down-distance if this is a play (not game control)
      let enhancedEventData = { ...eventData };
      // Hoist calculation outputs so we can safely reference them later
      let postPlayState = null;
      let resolvedFinalSpot = null;

      // Normalize empty string IDs to null
      const idFields = [
        'primary_player_id','secondary_player_id','tackler1','tackler2',
        'defender','returner','kicker','quarterback','receiver','forcedBy',
        'recoveringPlayer','onsideRecoveringPlayer','fairCatchPlayer','muffedPlayer'
      ];
      idFields.forEach((k) => {
        if (enhancedEventData[k] === '') enhancedEventData[k] = null;
      });
      
      // DEBUG: Track end_yard_line field through enhancement process
      debug.log('🔍 [FIELD TRACKING] Original eventData end_yard_line:', eventData.end_yard_line);
      debug.log('🔍 [FIELD TRACKING] Initial enhancedEventData end_yard_line:', enhancedEventData.end_yard_line);
      
      if (eventData.play_type && eventData.play_type !== 'GAME_CONTROL') {
        // Map possession to letter form for calculator
        const possessionLetter = (currentGameState.possession || 'home') === 'home' ? 'H' : 'V';

        // Prepare game state in the format expected by DownDistanceCalculator
        const gameStateForCalculation = {
          YardLinePosition: currentGameState.yard_line || 'H25',
          CurrentDown: currentGameState.down || 1,
          YardsToGo: currentGameState.distance || 10,
          LineToGain: currentGameState.line_to_gain || null,
          Possession: possessionLetter
        };

        // Prepare play data for calculation
        const playDataForCalculation = {
          finalYardLine: eventData.finalYardLine || eventData.endYardLine || eventData.end_yard_line,
          isFirstDown: eventData.isFirstDown || false,
          isTouchdown: eventData.isTouchdown || false,
          isTurnover: eventData.isTurnover || false,
          isSafety: eventData.isSafety || false,
          playType: eventData.play_type?.toLowerCase(),
          hasAcceptedPenalty: eventData.hasAcceptedPenalty || false,
          penaltyData: eventData.penaltyData || null,
          // CRITICAL: Pass kickoff flag to prevent DriveResult assignment
          is_kickoff: eventData.is_kickoff || false,
          play_type: eventData.play_type,
          sub_type: eventData.sub_type
        };

        debug.log('🔍 [FINAL YARD LINE] Looking for:', {
          finalYardLine: eventData.finalYardLine,
          endYardLine: eventData.endYardLine, 
          end_yard_line: eventData.end_yard_line,
          resolved: eventData.finalYardLine || eventData.endYardLine || eventData.end_yard_line
        });
        
        debug.log('🔍 [KICKOFF CHECK] Is this a kickoff?', {
          is_kickoff: eventData.is_kickoff,
          play_type: eventData.play_type,
          sub_type: eventData.sub_type,
          shouldSkipDriveResult: eventData.is_kickoff || (eventData.play_type === 'kick' && eventData.sub_type === 'kickoff')
        });

  // Calculate post-play state using new algorithm
        postPlayState = DownDistanceCalculator.calculatePostPlayState(
          playDataForCalculation, 
          gameStateForCalculation
        );

        debug.log('[CTX CALC] postPlayState =', postPlayState);

        // 3b) Log after postPlayState calculation
        debug.log('[KICK API] After postPlayState calculation:', {
          is_kickoff: eventData.is_kickoff,
          postPlayState: postPlayState,
          postYardLine: postPlayState?.postYardLine,
          resolvedFinalSpot: postPlayState?.postYardLine || playDataForCalculation?.finalYardLine
        });

        // Calculate net yards using possession-relative algorithm
        const netYards = DownDistanceCalculator.calculateNetYards(
          gameStateForCalculation.YardLinePosition,
          postPlayState.postYardLine,
          gameStateForCalculation.Possession
        );
        
        // Add calculated values to event data
        enhancedEventData = {
          ...enhancedEventData,
          // Current game state for starting position
          yard_line: currentGameState.yard_line || 'V28',  // Starting yard line position
          
          // Post-play state for database storage
          post_down: postPlayState?.postDown ?? null,
          post_distance: postPlayState?.postDistance ?? null,
          post_yard_line: postPlayState?.postYardLine ?? null,
          line_to_gain: postPlayState.lineToGain,
          
          // Calculated yards using possession-relative algorithm
          yards: netYards,
          net_yards: netYards,
          
          // Drive management
          drive_ends: postPlayState.driveEnds || false,
          drive_result: postPlayState.driveResult || null,
          
          // Game situation flags
          is_goal_to_go: postPlayState.isGoalToGo || false,
          is_red_zone: postPlayState.isRedZone || false
        };

        debug.log('[CTX ENRICH] post_down/post_distance/post_yard_line =',
          enhancedEventData.post_down, enhancedEventData.post_distance, enhancedEventData.post_yard_line);

        // Resolve final spot fallback chain (ensure we have an end_yard_line) - uses hoisted variables
        resolvedFinalSpot =
          postPlayState?.postYardLine ||
          playDataForCalculation?.finalYardLine ||
          eventData.endYardLine ||
          eventData.end_yard_line ||
          null;

        // Ensure enhancedEventData carries the end_yard_line we intend to send
        if (!enhancedEventData.end_yard_line || enhancedEventData.end_yard_line === '') {
          enhancedEventData.end_yard_line = resolvedFinalSpot;
        }

        // DEBUG: Track end_yard_line field after enhancement
        debug.log('🔍 [FIELD TRACKING] After enhancement end_yard_line:', enhancedEventData.end_yard_line);

        // Analyze drive transition using standardized rules
        const driveAnalysis = analyzeDriveTransition(enhancedEventData, currentGameState);
        debug.log('[DRIVE ANALYSIS]', driveAnalysis);
        
        // Override drive management with standardized rules if different
        if (driveAnalysis.shouldEndCurrent !== postPlayState.driveEnds) {
          debug.log('[DRIVE RULES] Override drive end decision:', {
            originalDecision: postPlayState.driveEnds,
            newDecision: driveAnalysis.shouldEndCurrent,
            reason: driveAnalysis.notes
          });
          enhancedEventData.drive_ends = driveAnalysis.shouldEndCurrent;
          enhancedEventData.drive_result = driveAnalysis.driveResult;
        }

        // If drive ends, prompt once (prefer explicit override if present)
        const driveEnded = (enhancedEventData.drive_ends ?? postPlayState.driveEnds) === true;
        if (driveEnded) {
          const driveResult = enhancedEventData.drive_result ?? postPlayState.driveResult;
          const gameTime = await promptForGameTime(`${driveResult} - drive end`);
          enhancedEventData.game_time = gameTime;
        }

        debug.log('Down-Distance Calculation (Possession-Relative + LineToGain):', {
          current: gameStateForCalculation,
          play: playDataForCalculation,
          calculated: postPlayState,
          netYards: netYards
        });
      }

      // Add timestamp, session info, and possession data; ensure snake_case keys
      const enrichedEvent = {
        ...enhancedEventData,
        post_yard_line: enhancedEventData.post_yard_line || (postPlayState ? postPlayState.postYardLine : null),
        is_kickoff: !!(
          eventData.is_kickoff ||
          (eventData.play_type === 'kick' && eventData.sub_type === 'kickoff')
        ),
        possession: currentGameState.possession || 'home',
        timestamp: new Date().toISOString(),
        session_id: 'current-session',
        user_id: 'current-user'
      };

      // Only set end_yard_line if missing to avoid overwriting
      if (!enrichedEvent.end_yard_line) {
        enrichedEvent.end_yard_line = resolvedFinalSpot || eventData.endYardLine || eventData.post_yard_line || null;
      }

      // DEBUG: Track end_yard_line field in final enrichedEvent
      debug.log('🔍 [FIELD TRACKING] Final enrichedEvent end_yard_line:', enrichedEvent.end_yard_line);

      // 3d) Hard guard: If kickoff without end_yard_line, reject
      if (enrichedEvent.is_kickoff && !enrichedEvent.end_yard_line) {
        debug.error('[KICK API] BLOCKING SUBMIT: Kickoff missing end_yard_line');
        throw new Error('Kickoff plays require end_yard_line (tackle spot)');
      }

      // Temporary hard guard: Additional protection for kickoffs 
      if (enrichedEvent?.play_type === 'kick' && enrichedEvent?.sub_type === 'kickoff') {
        if (!enrichedEvent.end_yard_line) {
          debug.error('❌ [CTX GUARD TEMP] Temporary kickoff guard triggered - missing end_yard_line');
          debug.error('❌ [CTX GUARD TEMP] enrichedEvent state:', {
            end_yard_line: enrichedEvent.end_yard_line,
            post_yard_line: enrichedEvent.post_yard_line,
            finalYardLine: enrichedEvent.finalYardLine,
            keys: Object.keys(enrichedEvent)
          });
          alert('Temporary guard: end_yard_line missing. Please re-enter the Tackled at yard line.');
          dispatch({ type: 'SET_SUBMITTING', payload: false });
          return;
        }
      }

      // 3c) Log before fetch request
      debug.log('[KICK API] Before fetch request:', {
        is_kickoff: enrichedEvent.is_kickoff,
        end_yard_line: enrichedEvent.end_yard_line,
        post_yard_line: enrichedEvent.post_yard_line,
        enrichedEventKeys: Object.keys(enrichedEvent)
      });

      // [CTX OUT] Enhanced comprehensive logging before API call
      debug.log('[CTX OUT] Final enrichedEvent before API - comprehensive state:', {
        play_type: enrichedEvent.play_type,
        sub_type: enrichedEvent.sub_type,
        is_kickoff: enrichedEvent.is_kickoff,
        end_yard_line: enrichedEvent.end_yard_line,
        post_yard_line: enrichedEvent.post_yard_line,
        finalYardLine: enrichedEvent.finalYardLine,
        enrichedEventKeys: Object.keys(enrichedEvent),
        timestamp: new Date().toISOString()
      });

      debug.log('🔎 [CTX OUT] enrichedEvent.end_yard_line =', enrichedEvent?.end_yard_line);
      debug.log('🔎 [CTX OUT] enrichedEvent.post_yard_line =', enrichedEvent?.post_yard_line);

      if (enrichedEvent?.play_type === 'kick' && enrichedEvent?.sub_type === 'kickoff') {
        if (!enrichedEvent.end_yard_line) {
          debug.error('❌ [CTX GUARD] kickoff without end_yard_line — aborting submit');
          alert('Internal guard: end_yard_line missing. Please re-enter the Tackled at yard line.');
          dispatch({ type: 'SET_SUBMITTING', payload: false });
          return;
        }
      }

      debug.log("🔄 [DATA CONTRACT] Original play data:", enrichedEvent);
      
      // Ensure FE→BE transform is applied on submit
      const bePayload = DataTransformer.frontendToBackend(enrichedEvent);
      const result = await StandardizedAPIClient.submitPlay(
        state.gameData?.game_info?.game_id || 1000, 
        bePayload
      );
      
      debug.log("✅ [DATA CONTRACT] Standardized result:", result);
      
      // Notify listeners that a play was submitted successfully
      try {
        document.dispatchEvent(new CustomEvent('playSubmitted', { detail: { playData: result?.play || enrichedEvent } }));
      } catch (err) {
        debug.warn('[events] playSubmitted dispatch failed:', err);
      }
      
      // Always refetch game state after submit
      try {
        await fetchGameState(state.gameData?.game_info?.game_id || getCurrentGameId());
      } catch (e) {
        debug.warn('Refetch after submit failed:', e);
      }

      // Track the last play for drive status bar
      if (eventData.play_type && eventData.play_type !== 'GAME_CONTROL') {
        dispatch({ type: 'SET_LAST_PLAY', payload: enhancedEventData });
        
        // Update drive stats
        updateDriveStats(enhancedEventData);
      }

      dispatch({ type: 'SET_SUBMITTING', payload: false });
      return result;

    } catch (error) {
      // Harden API error message fallback
      const msg = getApiErrorMessage?.(error) || (error && error.message) || 'API error';
      debug.error('Submit failed:', msg);
      dispatch({ type: 'SET_ERROR', payload: msg });
      throw error;
    }
  };

  const updateDriveStats = (playData) => {
    try {
      const current = state.gameData?.live_state;
      if (!current) return;

      const possessionLetter = (current.possession || 'home') === 'home' ? 'H' : 'V';
      const startPos = current.yard_line || 'H25';
      const endPos = playData.end_yard_line || playData.finalYardLine || playData.post_yard_line || startPos;

      const yardsGained = DownDistanceCalculator.calculateNetYards(
        startPos,
        endPos,
        possessionLetter
      );

      const updatedDrive = {
        plays: (state.currentDrive?.plays || 0) + 1,
        yards: (state.currentDrive?.yards || 0) + (Number.isFinite(yardsGained) ? yardsGained : 0),
        startYardLine: state.currentDrive?.startYardLine || startPos,
        startTime: state.currentDrive?.startTime || '15:00',
        possessionTeam: current.possession || 'home'
      };

      dispatch({ type: 'UPDATE_DRIVE_STATS', payload: updatedDrive });
    } catch (e) {
      debug.warn('updateDriveStats failed:', e);
    }
  };

  const updateGameClock = async (clockData) => {
    try {
      const result = await apiPost('api/update_game_clock.php', clockData);
      if (result.updated_game_state) {
        dispatch({ type: 'SET_GAME_DATA', payload: result.updated_game_state });
      }
      
      return result;
    } catch (error) {
      debug.error('Error updating clock:', getApiErrorMessage(error));
      dispatch({ type: 'SET_ERROR', payload: getApiErrorMessage(error) });
      throw error;
    }
  };

  const initializeRosters = async (gameId) => {
    try {
      dispatch({ type: 'SET_SUBMITTING', payload: true });
      
      const result = await apiPost('api/initialize_rosters.php', {
        game_id: gameId || state.gameData?.game_info?.game_id || 1000
      });
      
      // Refresh game state to get the updated rosters
      if (gameId || state.gameData?.game_info?.game_id) {
        await fetchGameState(gameId || state.gameData.game_info.game_id);
      }
      
      dispatch({ type: 'SET_SUBMITTING', payload: false });
      
      return result;
    } catch (error) {
      debug.error('Error initializing rosters:', getApiErrorMessage(error));
      dispatch({ type: 'SET_ERROR', payload: getApiErrorMessage(error) });
      dispatch({ type: 'SET_SUBMITTING', payload: false });
      throw error;
    }
  };

  const callTimeout = async (team, timeoutType = 'team') => {
    return submitEvent({
      event_type: 'TIMEOUT',
      team: team,
      timeout_type: timeoutType,
      play_type: 'GAME_CONTROL'
    });
  };

  const startNewDrive = async (team, startingYardLine = 25) => {
    // Initialize a new drive
    const newDrive = {
      plays: 0,
      yards: 0,
      startYardLine: `${team === 'home' ? 'Own' : 'Opp'} ${startingYardLine}`,
      startTime: state.gameData?.live_state?.time_remaining || '15:00',
      possessionTeam: team
    };
    
    dispatch({ type: 'SET_CURRENT_DRIVE', payload: newDrive });
    
    return submitEvent({
      event_type: 'NEW_DRIVE',
      team: team,
      starting_yard_line: startingYardLine,
      down: 1,
      distance: 10
    });
  };

  const adjustScore = async (team, points, scoreType) => {
    return submitEvent({
      event_type: 'SCORE_ADJUSTMENT',
      team: team,
      points: points,
      score_type: scoreType
    });
  };

  // Provide mock data for development
  const getMockGameState = () => ({
    game_info: {
      game_id: 'mock-game-1',
      home_team_name: 'Home Tigers',
      visitor_team_name: 'Away Eagles',
      home_team_id: 1,
      visitor_team_id: 2,
      game_date: new Date().toISOString(),
      venue: 'Memorial Stadium'
    },
    live_state: {
      game_status: 'in_progress',
      quarter: 1,
      time_remaining: 900, // 15:00
      possession: 'home',
      down: 1,
      distance: 10,
      yard_line: 25,
      home_score: 0,
      visitor_score: 0,
      home_timeouts: 3,
      visitor_timeouts: 3,
      play_clock: 40
    },
    recent_plays: [],
    team_stats: {
      home: {
        rushing_yards: 0,
        passing_yards: 0,
        total_yards: 0,
        first_downs: 0,
        penalties: 0,
        penalty_yards: 0,
        turnovers: 0
      },
      visitor: {
        rushing_yards: 0,
        passing_yards: 0,
        total_yards: 0,
        first_downs: 0,
        penalties: 0,
        penalty_yards: 0,
        turnovers: 0
      }
    },
    player_stats: {
      home: [],
      visitor: []
    },
    rosters: {
      home: [],
      visitor: []
    }
  });

  // Initialize with real data from database
  useEffect(() => {
    const loadGameData = async () => {
      try {
        // Get game ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('game_id') || '999'; // Default to '999' if no game_id in URL
        
        // Load game state from database API
        await fetchGameState(gameId);
      } catch (error) {
        debug.error('Failed to load initial game state:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load game data' });
      }
    };
    
    if (!state.gameData) {
      loadGameData();
    }
  }, []);

  // API Health Check Function
  const checkApiHealth = async () => {
    try {
      dispatch({ type: 'SET_API_STATUS', payload: 'connecting' });
      
      await apiGet('/strata_football/health_check.php');
      dispatch({ type: 'SET_API_STATUS', payload: 'connected' });
      return true;
    } catch (error) {
      debug.error('API health check failed:', getApiErrorMessage(error));
      dispatch({ type: 'SET_API_STATUS', payload: 'disconnected' });
      return false;
    }
  };

  // Run health check on mount and every 30 seconds
  useEffect(() => {
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get current game ID from URL
  const getCurrentGameId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('game_id') || '999';
  };

  const contextValue = {
    ...state,
    gameState: state.gameData,  // Alias gameData as gameState for components
    apiStatus: state.apiStatus, // Include API status in context
    currentGameId: getCurrentGameId(),  // Get game ID from URL
    isLoading: state.isSubmitting,  // Map isSubmitting to isLoading for components
    fetchGameState,
    refetchGameState: () => fetchGameState(getCurrentGameId()), // Add refetch helper
    loadGameState: () => fetchGameState(getCurrentGameId()), // Add loadGameState helper
    submitEvent,
    updateGameClock,
    initializeRosters,
    callTimeout,
    startNewDrive,
    adjustScore,
    checkApiHealth, // Add health check function
    clearError: () => dispatch({ type: 'CLEAR_ERROR' }),
    setDebugGameId: (gameId) => dispatch({ type: 'SET_DEBUG_GAME_ID', payload: gameId }),
    toggleDebugMode: () => dispatch({ type: 'TOGGLE_DEBUG_MODE' }),
    loadDebugGame: async () => {
      if (state.debugGameId) {
        try {
          await fetchGameState(state.debugGameId);
        } catch (error) {
          debug.error('Failed to load debug game:', error);
        }
      }
    }
  };

  return (
    <FootballGameContext.Provider value={contextValue}>
      {children}
    </FootballGameContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(FootballGameContext);
  if (!context) {
    throw new Error('useGameState must be used within a FootballGameProvider');
  }
  return context;
}

export { FootballGameContext };
