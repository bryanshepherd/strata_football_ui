// Shared by starter lookup and play-entry duplicate-number recommendations.
// These are recognition keys only; keep the operator's saved position wording.
export const FOOTBALL_DEFENSIVE_POSITIONS = [
  'DE', 'LDE', 'RDE', 'SDE', 'WDE', 'EDGE',
  'DT', 'LDT', 'RDT', 'NT', 'NG', 'DL',
  'MLB', 'OLB', 'ILB', 'LB', 'LOLB', 'ROLB', 'LILB', 'RILB', 'SAM', 'JACK',
  'CB', 'LCB', 'RCB', 'DB', 'NB', 'DIME', 'FS', 'SS', 'S', 'WS',
];

const DEFENSIVE_POSITION_NAMES = {
  DEFENSIVEEND: 'DE', LEFTDEFENSIVEEND: 'LDE', RIGHTDEFENSIVEEND: 'RDE',
  STRONGSIDEDEFENSIVEEND: 'SDE', WEAKSIDEDEFENSIVEEND: 'WDE', EDGERUSHER: 'EDGE',
  DEFENSIVETACKLE: 'DT', LEFTDEFENSIVETACKLE: 'LDT', RIGHTDEFENSIVETACKLE: 'RDT',
  NOSETACKLE: 'NT', NOSEGUARD: 'NG', DEFENSIVELINE: 'DL', DEFENSIVELINEMAN: 'DL',
  MIDDLELINEBACKER: 'MLB', OUTSIDELINEBACKER: 'OLB',
  INSIDELINEBACKER: 'ILB', LINEBACKER: 'LB', LEFTOUTSIDELINEBACKER: 'LOLB',
  RIGHTOUTSIDELINEBACKER: 'ROLB', LEFTINSIDELINEBACKER: 'LILB', RIGHTINSIDELINEBACKER: 'RILB',
  STRONGSIDELINEBACKER: 'SAM', SAMLINEBACKER: 'SAM', SLB: 'SAM',
  WEAKSIDELINEBACKER: 'OLB', WLB: 'OLB', JACKLINEBACKER: 'JACK',
  CORNER: 'CB', CORNERBACK: 'CB', LEFTCORNER: 'LCB', LEFTCORNERBACK: 'LCB',
  RIGHTCORNER: 'RCB', RIGHTCORNERBACK: 'RCB', DEFENSIVEBACK: 'DB',
  NICKEL: 'DB', NICKELBACK: 'DB', NICKELCORNER: 'DB', NICKELCORNERBACK: 'DB', NCB: 'DB',
  DIMEBACK: 'DIME', SAFETY: 'S', FREESAFETY: 'FS', STRONGSAFETY: 'SS',
  WIDESAFETY: 'WS',
  // Operator-defined DB labels; preserve the original wording in the roster.
  MIKE: 'DB', WILL: 'DB', SPUR: 'DB', NKL: 'DB', RVR: 'DB', ROVER: 'DB',
};

export function footballPositionKeys(value) {
  return String(value || '').split(/[\/,&]+/).map(position => {
    const trimmed = position.trim().toUpperCase();
    const key = trimmed.replace(/[\s.\-–—]+/g, '');
    return DEFENSIVE_POSITION_NAMES[key]
      || (FOOTBALL_DEFENSIVE_POSITIONS.includes(key) ? key : trimmed);
  }).filter(Boolean);
}
