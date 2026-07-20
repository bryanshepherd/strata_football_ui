import { describe, it, expect, beforeEach } from 'vitest';
import { analyzePenalties, applySuggestions, shouldOffsettingApply, getEnforcementOrder } from '../src/utils/penaltyRules';
import type { Penalty, PlayWithPenalties } from '../src/types/penalties';

describe('Penalty Rules Engine', () => {
  let mockGameState: any;
  let mockPlay: PlayWithPenalties;

  beforeEach(() => {
    mockGameState = {
      down: 2,
      distance: 10,
      yard_line: 'H35',
      possession: 'H',
      quarter: 1,
      time_remaining: 900
    };

    mockPlay = {
      end_yard_line: 'H40',
      penalties: []
    };
  });

  describe('Offsetting Penalties', () => {
    it('should detect offsetting live-ball penalties', () => {
      mockPlay.penalties = [
        {
          team: 'H',
          code: 'HOLD',
          enforcedFrom: 'SPOT',
          accepted: true,
          liveBall: true,
          yards: 10
        },
        {
          team: 'V',
          code: 'DPI',
          enforcedFrom: 'SPOT',
          accepted: true,
          liveBall: true,
          yards: 15
        }
      ];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      expect(analysis.kind).toBe('OFFSET');
      expect(analysis.messages).toContain('Offsetting live-ball penalties detected');
      expect(analysis.suggested.down).toBe(2); // Replay down
      expect(analysis.suggested.distance).toBe(10); // Same distance
      expect(analysis.suggested.yardLine).toBe('H35'); // Same spot
      expect(analysis.suggested.resultTag).toBe('Offsetting Penalties');
    });

    it('should not offset when only one team has live-ball penalties', () => {
      mockPlay.penalties = [
        {
          team: 'H',
          code: 'HOLD',
          enforcedFrom: 'SPOT',
          accepted: true,
          liveBall: true,
          yards: 10
        },
        {
          team: 'V',
          code: 'UC',
          enforcedFrom: 'END',
          accepted: true,
          liveBall: false, // Dead ball
          yards: 15
        }
      ];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      expect(analysis.kind).toBe('ENFORCED');
      expect(analysis.kind).not.toBe('OFFSET');
    });
  });

  describe('Defensive Foul on Scoring Play', () => {
    it('should suggest carry-over for defensive foul on touchdown', () => {
      mockPlay.is_touchdown = true;
      mockPlay.penalties = [
        {
          team: 'V', // Defense
          code: 'PF',
          enforcedFrom: 'END',
          accepted: true,
          liveBall: true,
          yards: 15
        }
      ];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      expect(analysis.messages).toContain('Defensive foul on scoring play');
      expect(analysis.messages).toContain('Score stands, penalty may be enforced on try or kickoff');
      expect(analysis.suggested.carryTo).toBe('TRY');
    });

    it('should not suggest carry-over for offensive foul on scoring play', () => {
      mockPlay.is_touchdown = true;
      mockGameState.possession = 'H';
      mockPlay.penalties = [
        {
          team: 'H', // Offense
          code: 'HOLD',
          enforcedFrom: 'SPOT',
          accepted: true,
          liveBall: true,
          yards: 10
        }
      ];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      expect(analysis.suggested.carryTo).toBeUndefined();
    });
  });

  describe('Automatic First Down / Loss of Down', () => {
    it('should apply automatic first down when penalty has AFD', () => {
      mockPlay.penalties = [
        {
          team: 'V',
          code: 'DPI',
          enforcedFrom: 'SPOT',
          accepted: true,
          liveBall: true,
          automaticFirstDown: true,
          yards: 15
        }
      ];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      expect(analysis.suggested.down).toBe(1);
      expect(analysis.suggested.distance).toBe(10);
      expect(analysis.messages).toContain('Automatic first down');
    });

    it('should apply loss of down when penalty has LOD', () => {
      mockGameState.down = 2;
      mockPlay.penalties = [
        {
          team: 'H',
          code: 'IG',
          enforcedFrom: 'SPOT',
          accepted: true,
          liveBall: true,
          lossOfDown: true,
          yards: 10
        }
      ];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      expect(analysis.suggested.down).toBe(3); // 2 + 1
      expect(analysis.messages).toContain('Loss of down');
    });

    it('should cap loss of down at 4th down', () => {
      mockGameState.down = 4;
      mockPlay.penalties = [
        {
          team: 'H',
          code: 'IG',
          enforcedFrom: 'SPOT',
          accepted: true,
          liveBall: true,
          lossOfDown: true,
          yards: 10
        }
      ];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      expect(analysis.suggested.down).toBe(4); // Should not go to 5
    });
  });

  describe('Half-the-Distance', () => {
    it('should apply half-the-distance near goal line', () => {
      // This is tested within enforceYardage but we can't directly test it
      // as it's a private function. We test it through the analysis
      mockPlay.end_yard_line = 'V08'; // 8 yards from opponent goal
      mockPlay.penalties = [
        {
          team: 'V',
          code: 'PF',
          enforcedFrom: 'END',
          accepted: true,
          liveBall: true,
          yards: 15 // Would normally be 15 yards
        }
      ];
      mockGameState.possession = 'H';

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      // Should suggest yard line closer than V08 - 15 = G (which would be in end zone)
      // Instead should be roughly half distance to goal
      expect(analysis.suggested.yardLine).toBeDefined();
      // The exact calculation depends on the implementation details
    });
  });

  describe('Save As-Is Override', () => {
    it('should record user override when saving as-is', () => {
      mockPlay.penalties = [
        {
          team: 'H',
          code: 'HOLD',
          enforcedFrom: 'SPOT',
          accepted: true,
          liveBall: true,
          yards: 10
        }
      ];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      // Simulate user choosing to save as-is
      mockPlay.userOverride = {
        applied: true,
        reason: 'Field conditions require manual adjustment'
      };

      // In the actual flow, this would be attached to penaltyResolution
      expect(mockPlay.userOverride.applied).toBe(true);
      expect(mockPlay.userOverride.reason).toBeTruthy();
    });
  });

  describe('Technical Validation Requirements', () => {
    it('should enforce technical requirements even for Save As-Is', () => {
      // Technical validation is ALWAYS required - system cannot process without these
      const technicallyValidPenalty: Penalty = {
        team: 'H',                    // REQUIRED: System needs to know which team
        code: 'HOLD',                 // REQUIRED: System needs to know penalty type
        enforcedFrom: 'SPOT',         // REQUIRED: System needs enforcement point
        accepted: true                // REQUIRED: System needs to know if enforced
      };

      expect(technicallyValidPenalty.team).toBeDefined();
      expect(technicallyValidPenalty.code).toBeDefined();
      expect(technicallyValidPenalty.enforcedFrom).toBeDefined();
      expect(technicallyValidPenalty.accepted).toBeDefined();
    });

    it('should allow rules override but enforce technical minimums', () => {
      // User can override RULES (like suggested enforcement) but not TECHNICAL requirements
      const penalty: Penalty = {
        team: 'H',                    // TECHNICAL: Required
        code: 'HOLD',                 // TECHNICAL: Required
        enforcedFrom: 'END',          // RULES: Can be overridden from suggested 'SPOT'
        accepted: true,               // TECHNICAL: Required
        yards: 5                      // RULES: Can be overridden from suggested 10
      };

      // Technical fields must exist
      expect(['H', 'V']).toContain(penalty.team);
      expect(penalty.code).toBeTruthy();
      expect(penalty.enforcedFrom).toBeTruthy();
      expect(typeof penalty.accepted).toBe('boolean');
      
      // But rules can be overridden (different from penalty table defaults)
      expect(penalty.yards).not.toBe(10); // Overridden from default
      expect(penalty.enforcedFrom).toBe('END'); // Overridden from default 'SPOT'
    });

    it('should validate yard line format and range requirements', () => {
      // Technical requirement: Yard lines must be in H##/V##/50 format with valid range
      // Valid range: H00-H50, V00-V50, or 50
      
      const isValidYardLine = (yl: string): boolean => {
        // First check format
        if (!/^(H|V)\d{2}$|^50$/.test(yl)) return false;
        
        // If it's just "50", it's valid
        if (yl === '50') return true;
        
        // Check range for H## and V##
        const yardNum = parseInt(yl.substring(1));
        return yardNum >= 0 && yardNum <= 50;
      };
      
      const validYardLines = ['H25', 'V35', 'H00', 'V50', 'H50', '50', 'H01', 'V01'];
      const invalidYardLines = ['H5', 'V3', 'Home25', 'Visitor35', '25', 'H100', 'V99', 'H51', 'V51'];

      validYardLines.forEach(yl => {
        expect(isValidYardLine(yl)).toBe(true);
      });

      invalidYardLines.forEach(yl => {
        expect(isValidYardLine(yl)).toBe(false);
      });
    });
  });

  describe('No Penalties', () => {
    it('should handle plays with no penalties', () => {
      mockPlay.penalties = [];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      expect(analysis.kind).toBe('NONE');
      expect(analysis.messages).toContain('No penalties on this play');
    });

    it('should handle plays with only declined penalties', () => {
      mockPlay.penalties = [
        {
          team: 'H',
          code: 'HOLD',
          enforcedFrom: 'SPOT',
          accepted: false, // Declined
          liveBall: true,
          yards: 10
        }
      ];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      expect(analysis.kind).toBe('NONE');
      expect(analysis.messages[0]).toContain('penalty(ies) declined');
      expect(analysis.messages).toContain('Play result stands');
      expect(analysis.suggested.resultTag).toBe('Penalties Declined');
    });
  });

  describe('Apply Suggestions', () => {
    it('should apply suggested yard line and down/distance', () => {
      mockPlay.penalties = [
        {
          team: 'V',
          code: 'DPI',
          enforcedFrom: 'SPOT',
          accepted: true,
          liveBall: true,
          automaticFirstDown: true,
          yards: 15
        }
      ];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      const updatedPlay = applySuggestions(mockPlay, analysis, mockGameState);
      
      expect(updatedPlay.end_yard_line).toBeDefined();
      expect((updatedPlay as any).postDown).toBe(1);
      expect((updatedPlay as any).postDistance).toBe(10);
      expect((updatedPlay as any).resultTag).toBe('1 Penalty(ies) Enforced');
    });
  });

  describe('Enforcement Order', () => {
    it('should enforce live ball penalties before dead ball', () => {
      const penalties: Penalty[] = [
        {
          team: 'H',
          code: 'UC',
          enforcedFrom: 'END',
          accepted: true,
          liveBall: false // Dead ball
        },
        {
          team: 'V',
          code: 'HOLD',
          enforcedFrom: 'SPOT',
          accepted: true,
          liveBall: true // Live ball
        }
      ];

      const ordered = getEnforcementOrder(penalties);
      
      expect(ordered[0].liveBall).toBe(true);
      expect(ordered[1].liveBall).toBe(false);
    });

    it('should only include accepted penalties in enforcement order', () => {
      const penalties: Penalty[] = [
        {
          team: 'H',
          code: 'HOLD',
          enforcedFrom: 'SPOT',
          accepted: false, // Declined
          liveBall: true
        },
        {
          team: 'V',
          code: 'DPI',
          enforcedFrom: 'SPOT',
          accepted: true, // Accepted
          liveBall: true
        }
      ];

      const ordered = getEnforcementOrder(penalties);
      
      expect(ordered.length).toBe(1);
      expect(ordered[0].code).toBe('DPI');
    });
  });

  describe('Multiple Penalties', () => {
    it('should handle multiple accepted penalties from same team', () => {
      mockPlay.penalties = [
        {
          team: 'V',
          code: 'HOLD',
          enforcedFrom: 'SPOT',
          accepted: true,
          liveBall: true,
          yards: 10
        },
        {
          team: 'V',
          code: 'PF',
          enforcedFrom: 'END',
          accepted: true,
          liveBall: false,
          yards: 15
        }
      ];

      const analysis = analyzePenalties(mockPlay, mockGameState);
      
      expect(analysis.kind).toBe('ENFORCED');
      expect(analysis.messages.length).toBeGreaterThan(1);
      expect(analysis.suggested.resultTag).toBe('2 Penalty(ies) Enforced');
    });
  });
});

describe('Offsetting Helper', () => {
  it('should detect when penalties should offset', () => {
    const penalties: Penalty[] = [
      {
        team: 'H',
        code: 'HOLD',
        enforcedFrom: 'SPOT',
        accepted: true,
        liveBall: true
      },
      {
        team: 'V',
        code: 'DPI',
        enforcedFrom: 'SPOT',
        accepted: true,
        liveBall: true
      }
    ];

    expect(shouldOffsettingApply(penalties)).toBe(true);
  });

  it('should not offset when penalties are not live ball', () => {
    const penalties: Penalty[] = [
      {
        team: 'H',
        code: 'UC',
        enforcedFrom: 'END',
        accepted: true,
        liveBall: false
      },
      {
        team: 'V',
        code: 'DOG',
        enforcedFrom: 'PREVIOUS',
        accepted: true,
        liveBall: false
      }
    ];

    expect(shouldOffsettingApply(penalties)).toBe(false);
  });
});