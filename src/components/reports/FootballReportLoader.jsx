import React, { useEffect, useState } from 'react';
import baselineRecord from '../../data/footballCompletedBaselineGameRecord.json';
import {
  fetchFootballEnvelope,
  getDashboardSeededFootballEnvelopeRecord,
} from '../../services/footballDashboardService';

export default function FootballReportLoader({ envelope, children }) {
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('gameId') || params.get('envelopeGameId') || '';
  const dashboardGameId = params.get('dashboardGameId') || '';
  const useLocal = params.get('source') === 'local' || !dashboardGameId;
  const localEnvelope = useLocal && gameId
    ? getDashboardSeededFootballEnvelopeRecord(gameId)?.envelope
    : null;
  // The sample is only available for an unselected preview, never a requested game.
  const immediateEnvelope = envelope || localEnvelope
    || (!gameId && !dashboardGameId ? baselineRecord.envelope : null);
  const requestKey = `${gameId}:${dashboardGameId}:${useLocal}`;
  const [loaded, setLoaded] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (immediateEnvelope || !gameId) return undefined;
    const controller = new AbortController();
    setLoaded(null);
    fetchFootballEnvelope(gameId, {
      dashboardGameId,
      signal: controller.signal,
      updateMirrorIdentity: false,
    }).then((result) => {
      if (!controller.signal.aborted) setLoaded({ requestKey, envelope: result });
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setLoaded({ requestKey, error: error.message || 'The server could not load this game.' });
      }
    });
    return () => controller.abort();
  }, [gameId, dashboardGameId, requestKey, Boolean(immediateEnvelope), attempt]);

  const current = loaded?.requestKey === requestKey ? loaded : null;
  const reportEnvelope = immediateEnvelope || current?.envelope;
  if (reportEnvelope) return children(reportEnvelope);
  const error = !gameId ? 'The report link is missing its game ID.' : current?.error;
  return (
    <main className="football-report-screen">
      {error ? <div role="alert">
        <h1>Unable to load report</h1>
        <p>{error}</p>
        {gameId && <button type="button" onClick={() => {
          setLoaded(null);
          setAttempt((value) => value + 1);
        }}>Retry</button>}
      </div> : <p role="status">Loading report from server…</p>}
    </main>
  );
}
