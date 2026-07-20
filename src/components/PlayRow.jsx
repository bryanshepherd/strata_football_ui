import React, { memo } from 'react';
import { playerManager } from '../utils/playerManager';
import { normalizeYardLine } from '../utils/validation';

/**
 * Memoized PlayRow component for performance optimization
 * 
 * Prevents unnecessary re-renders of individual play rows
 * when other parts of the GameLog change.
 */
const PlayRow = memo(function PlayRow({ 
  play, 
  index, 
  isLatest,
  onEdit,
  onDelete, 
  onReplace,
  onInsertBefore
}) {
  
  function playIcon(p){
    const type = (p.playType || p.PlayType || '').toUpperCase();
    const res  = (p.result   || p.PlayResult || '').toUpperCase();
    if (p.isTouchdown || res === 'TOUCHDOWN' || res === 'FIELD_GOAL' || res === 'SAFETY') return '⭐';
    if (type === 'PENALTY' || p.isNegated) return '⚑';
    if (p.isTurnover || res === 'INTERCEPTION' || res === 'FUMBLE' || res === 'TURNOVER') return '🔁';
    return '🏈';
  }

  const getPlayTypeColor = (playType) => {
    const colors = {
      RUSH: 'text-green-600',
      PASS: 'text-blue-600',
      PUNT: 'text-purple-600',
      KICK: 'text-orange-600',
      KICKOFF: 'text-red-600',
      PENALTY: 'text-red-700',
      TIMEOUT: 'text-gray-600',
      GAME_CONTROL: 'text-gray-700'
    };
    return colors[playType] || 'text-gray-800';
  };

  const formatDownDistance = (play) => {
    const down = play.down ?? play.Down;
    const distance = play.distance ?? play.YardsToGo ?? play.yards_to_go;
    if (down && distance !== undefined && distance !== null) return `${down} & ${distance}`;
    return 'Down & Distance not set';
  };

  const formatFieldPosition = (play) => {
    // Prefer post spot, fallback to end, then start
    const ballOn = play.postYardLine || play.endYardLine || play.yardLine || '-';
    return ballOn;
  };

  const formatTime = (timeRemaining) => {
    if (!Number.isFinite(timeRemaining)) return '—';
    const total = Math.max(0, parseInt(timeRemaining, 10));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getPlayerName = (playerId, possessionTeam) => {
    if (!playerId || !possessionTeam) return null;
    try {
      return playerManager.getPlayerName(playerId, possessionTeam === 'home' ? 'home' : 'visitor');
    } catch (error) {
      return null;
    }
  };

  const getPlayerNumber = (playerId, possessionTeam) => {
    if (!playerId || !possessionTeam) return null;
    try {
      return playerManager.getPlayerNumber(playerId, possessionTeam === 'home' ? 'home' : 'visitor');
    } catch (error) {
      return null;
    }
  };

  // Helper: name/number formatter (no raw IDs)
  function fmtPerson(id, team) {
    if (!id) return '[unknown]';
    const n = getPlayerName(id, team);
    if (n) {
      const parts = String(n).trim().split(/\s+/);
      const last = parts.pop(); 
      const first = parts[0] || '';
      return `${last}, ${first ? first[0].toUpperCase()+'.' : ''}`;
    }
    const num = getPlayerNumber(id, team);
    return Number.isFinite(num) ? `#${num}` : '[unknown]';
  }

  // Yardline normalizer alias
  const normYL = (code) => {
    try {
      return normalizeYardLine(code);
    } catch { return String(code || '-'); }
  };

  const getPlayDescription = (play) => {
    // Check if this is a kickoff that might need special handling
    const t = String(play.playType || play.PlayType || '').toUpperCase();
    const sub = String(play.playSubType || play.PlaySubType || '').toUpperCase();
    const isKickoff = t === 'KICK' && (sub === 'KICKOFF' || play.KickedToYardLine || play.kicked_to_yard_line);
    
    // For kickoffs, always use our custom logic to avoid field-goal wording
    // For other plays, prefer server description if available
    if (!isKickoff && (play.description || play.PlayDescription)) {
      return play.description || play.PlayDescription;
    }

    // Description builder: kickoff branch
    const poss = play.possession || play.PossessionTeam;           // kicking team on kickoffs
    const opp  = poss === 'HOME' ? 'VISITOR' : 'HOME';
    const qb   = fmtPerson(play.PrimaryPlayerID ?? play.primary_player_id, poss);
    const rec  = fmtPerson(play.SecondaryPlayerID ?? play.secondary_player_id, opp);
    const toYL = normYL(play.KickedToYardLine || play.kicked_to_yard_line);
    const ballOn = normYL(play.postYardLine || play.endYardLine || play.yardLine || '-');

    let desc = '';

    if (t === 'KICK' && (sub === 'KICKOFF' || toYL)) {
      // KICKOFF description format
      // Examples:
      //  - "Schmitt kickoff to V03, returned by Marcucci to V28"
      //  - "Schmitt kickoff to EZ, touchback"
      //  - "Schmitt kickoff out of bounds"
      //  - "Schmitt onside kick, recovered by HOME at H45"

      // Special cases first (based on PlayResult)
      const res = String(play.result || play.PlayResult || '').toUpperCase();
      if (res === 'TOUCHBACK' || res === 'END_OF_PLAY') {
        // END_OF_PLAY is used for touchbacks in the database enum
        desc = `${qb} kickoff to EZ, touchback`;
      } else if (res === 'OUT_OF_BOUNDS') {
        desc = `${qb} kickoff out of bounds`;
      } else if (res === 'FAIR_CATCH') {
        desc = `${qb} kickoff to ${toYL || ballOn}, fair catch by ${rec}`;
      } else if (res === 'RECOVERED' && (play.IsTurnover || play.isTurnover)) {
        // onside or muff recovered by kicking team
        desc = `${qb} onside kick, recovered by ${poss} at ${ballOn}`;
      } else {
        // Normal return
        if (rec && ballOn && toYL && ballOn !== toYL) {
          desc = `${qb} kickoff to ${toYL}, returned by ${rec} to ${ballOn}`;
        } else if (toYL) {
          desc = `${qb} kickoff to ${toYL}`;
        } else {
          desc = `${qb} kickoff`;
        }
      }
    } else if (t === 'KICK' && sub === 'FIELD_GOAL') {
      // keep FG wording here only
      desc = `${qb} field goal attempt`;
    } else if (t === 'KICK') {
      // PAT or other generic kicks
      desc = `${qb} kick`;
    } else if (t === 'PASS') {
      desc = `${qb} → ${rec}`;
    } else if (t === 'RUSH') {
      desc = `${qb}`;
    } else if (t === 'PUNT') {
      desc = `${qb} punt`;
    } else if (t === 'PENALTY') {
      desc = 'penalty';
    } else {
      desc = (t || 'play').toLowerCase();
    }

    return desc; // No yardage text here
  };

  function participantNums(nums){ 
    // nums: array of player IDs → jersey numbers via getPlayerNumber
    return nums.map(id => getPlayerNumber(id) ? String(getPlayerNumber(id)) : '').filter(Boolean).join(',');
  }

  function formatResultChips(p){
    const chips = [];
    const res  = (p.result || p.PlayResult || '').toUpperCase();
    const type = (p.playType || p.PlayType || '').toUpperCase();
    const sub  = (p.playSubType || p.PlaySubType || '').toUpperCase();
    const team = p.possession;

    // Core result chips
    if (res === 'INCOMPLETE') chips.push('INC');
    if (res === 'COMPLETE') chips.push('COMP');
    if (res === 'TACKLE')     chips.push('TACK');
    if (res === 'OUT_OF_BOUNDS') chips.push('OOB');
    if (res === 'END_OF_PLAY')   chips.push('EOP');
    if (res === 'INTERCEPTION')  chips.push('INT');
    if (res === 'FUMBLE')        chips.push('FUMB');
    if (res === 'SAFETY' || p.isSafety) chips.push('SAF');

    // Field goal outcomes
    if (type === 'KICK' && sub === 'FIELD_GOAL') {
      if (res === 'GOOD') chips.push('GOOD');
      if (res === 'MISS') chips.push('MISS');
      if (res === 'BLOCK') chips.push('BLK');
    }

    // Kickoffs
    if (type === 'KICK' && (sub === 'KICKOFF' || p.KickedToYardLine || p.kicked_to_yard_line)) {
      const desc = (p.description || p.PlayDescription || '').toLowerCase();
      const isTouchback = res === 'TOUCHBACK' || desc.includes('touchback');
      
      if (isTouchback) chips.push('TB');
      if (res === 'OUT_OF_BOUNDS') chips.push('OOB');
      if (res === 'FAIR_CATCH') chips.push('FC');
      
      // If start != end, show RET (unless it's a touchback)
      const toYL   = p.KickedToYardLine || p.kicked_to_yard_line;
      const ballOn = p.postYardLine || p.endYardLine || p.yardLine;
      if (!isTouchback && toYL && ballOn && String(toYL) !== String(ballOn)) chips.push('RET');
    }

    return chips;
  }

  function yardageChips(p){
    const chips = [];
    const ny = Number(p.netYards ?? p.yardsGained ?? p.YardsGained ?? 0);
    if (Number.isFinite(ny)) {
      const txt = `${ny > 0 ? '+' : ''}${ny} yds`;
      chips.push({ key: 'yards', text: txt, kind: 'yards' });
    }
    // Only show 1ST for RUSH/PASS/PENALTY plays that actually award a first down
    const t = String(p.playType || p.PlayType || '').toUpperCase();
    const firstOkType = (t === 'RUSH' || t === 'PASS' || t === 'PENALTY');
    if (p.isFirstDown === true && firstOkType) {
      chips.push({ key: 'first', text: '1ST', kind: 'first' });
    }
    return chips;
  }

  return (
    <div
      className={`p-3 border-b border-gray-100 hover:bg-gray-50 ${isLatest ? 'bg-blue-50' : ''}`}
    >
      {/* First Line: Icon + Play Type + [Latest] + Action Buttons */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          <span className="play-type-icon text-lg" aria-label={play.playType}>{playIcon(play)}</span>
          <span className={`font-bold text-sm ${getPlayTypeColor(play.PlayType || play.play_type)}`}>
            {(play.playType || play.PlayType || play.play_type || '').toUpperCase()}
          </span>
          {(play.has_penalty || play.HasPenalty) && (
            <span className="px-1 py-0.5 bg-red-100 text-red-700 text-xs rounded">⚠️</span>
          )}
          {isLatest && (
            <span className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-medium">
              LATEST
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onInsertBefore(play)}
            className="p-1 hover:bg-green-100 rounded text-green-600 text-sm"
            title="Insert play after this one"
          >
            ＋
          </button>
          <button
            onClick={() => onEdit(play)}
            className="p-1 hover:bg-blue-100 rounded text-blue-600 text-sm"
            title="Edit this play"
          >
            ✏️
          </button>
          <button
            onClick={() => onReplace(play)}
            className="p-1 hover:bg-orange-100 rounded text-orange-600 text-sm"
            title="Replace this play"
          >
            🔄
          </button>
          <button
            onClick={() => onDelete(play)}
            className="p-1 hover:bg-red-100 rounded text-red-600 text-sm"
            title="Delete this play"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Second Line: Quarter Time - Down & Distance on left, Field Position on right */}
      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
        <div className="flex items-center space-x-3">
          <span>Q{play.period || play.Period || 1}</span>
          <span>{formatTime(play.timeRemaining || play.time_remaining || play.TimeRemaining)}</span>
          <span className="text-gray-400">•</span>
          <span>{formatDownDistance(play)}</span>
        </div>
        <div>
          {formatFieldPosition(play) && `Ball on ${formatFieldPosition(play)}`}
        </div>
      </div>

      {/* Third Line: Play Description */}
      <div className="text-sm text-gray-800 mb-1">
        {getPlayDescription(play)}
      </div>

      {/* Fourth Line: Result and Yards */}
      <div className="text-xs text-gray-600 flex items-center space-x-3">
        <div className="result-line">
          Result:&nbsp;
          {(() => {
            const cs = formatResultChips(play);
            return cs.length
              ? cs.map((c,i) => <span key={i} className="chip">{c}</span>)
              : <span className="text-gray-400">—</span>;
          })()}
        </div>
        <span className="text-gray-400">•</span>
        <span className="yardage-line" role="group" aria-label="Yardage and first down">
          {yardageChips(play).map(c => (
            <span
              key={c.key}
              className={
                'chip ' + (c.kind === 'first' ? 'chip-success chip-compact' : 'chip-yardage chip-compact')
              }>
              {c.text}
            </span>
          ))}
        </span>
      </div>

      {/* Special Indicators */}
      <div className="flex items-center space-x-2 mt-1">
        {play.is_touchdown && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">🏆 TD</span>}
        {play.is_turnover && <span className="text-xs bg-red-100 text-red-700 px-1 rounded">🔄 TO</span>}
        {play.has_fumble && <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded">💥 FUM</span>}
      </div>

      {/* Drive Information */}
      {play.drive_number && (
        <div className="text-xs text-blue-600 mt-1">
          Drive #{play.drive_number}
        </div>
      )}
    </div>
  );
});

export default PlayRow;