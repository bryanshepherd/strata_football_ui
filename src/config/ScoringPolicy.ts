/**
 * Scoring policy configuration
 * 
 * advisory: Show warnings/suggestions, Save As-Is always available
 * assisted: Auto-apply common precedences, but scorer can Override & Save As-Is
 */
export const SCORING_STRICTNESS: 'advisory' | 'assisted' = 'assisted';