export const isFootballKickoffReplay = (event) => event?.type === 'kickoff'
  && event?.result?.penaltyContext?.startNewDrive !== true
  && (event.penalties || []).some((penalty) => (
    penalty.status === 'accepted'
    && (penalty.replayDown || penalty.downConsequence === 'REPEAT')
    && ['previous', 'previousspot', 'freekick', 'freekickspot'].includes(String(penalty.enforcedFrom || '').replace(/[^a-z]/gi, '').toLowerCase())
  ));
