export type Team = 'H' | 'V';

export type Penalty = {
  id?: string;                 // local uid
  team: Team;                  // REQUIRED (technical)
  code: string;                // REQUIRED (technical) — from penalty table
  yards?: number;              // required if code specifies yardage
  spot?: string;               // 'H45' | 'V27' | '50' (required if code uses SPOT)
  enforcedFrom: 'PREVIOUS' | 'SPOT' | 'END' | 'TRY' | 'FREE_KICK' | 'SUCCESSFUL_TD'; // REQUIRED
  accepted: boolean;           // REQUIRED (technical) — true or false
  automaticFirstDown?: boolean;
  lossOfDown?: boolean;
  liveBall?: boolean;          // default from table; editable
  safetyByRule?: boolean;      // rare; optional
  carryOverToKO?: boolean;     // on scoring plays; optional
  notes?: string;
};

export type PenaltyResolutionMeta = {
  mode: 'advisory' | 'assisted';
  analysis?: {
    kind: 'NONE' | 'OFFSET' | 'ENFORCED';
    messages: string[];
    suggested: {
      yardLine?: string;
      down?: number;
      distance?: number;
      resultTag?: string;      // e.g., 'Offsetting', 'Accepted', 'Declined'
      carryTo?: 'TRY' | 'KICKOFF' | null;
    };
  };
  userOverride?: { applied: boolean; reason?: string }; // set when scorer chooses Save As‑Is over suggestions
};

export type PlayWithPenalties = {
  // existing play fields…
  end_yard_line: string;       // REQUIRED (technical) for the play
  penalties?: Penalty[];
  penaltyResolution?: PenaltyResolutionMeta;
};

export type PenaltyDef = {
  code: string;
  name: string;
  liveBall: boolean;
  yards?: number;
  requiresYards: boolean;
  requiresSpot: boolean;
  defaultEnforcement: 'PREVIOUS' | 'SPOT' | 'END' | 'TRY' | 'FREE_KICK' | 'SUCCESSFUL_TD';
  automaticFirstDown: boolean;
  lossOfDown: boolean;
};