const key = '__STRATA_FOOTBALL_RUNTIME_CONFIG__';

export const getFootballScorerRuntimeConfig = () => {
  const config = typeof window === 'undefined' ? null : window[key];
  if (!config || typeof config !== 'object') {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const dashboardGameId = params.get('dashboardGameId');
    const envelopeGameId = params.get('envelopeGameId');
    if (!dashboardGameId || !envelopeGameId) return null;
    const base = `/api/football/games/${encodeURIComponent(dashboardGameId)}`;
    return { dashboardGameId, envelopeGameId, bootstrapUrl: `${base}/bootstrap`, envelopeUrl: `${base}/envelope`, pregameUrl: `${base}/pregame`, eventSubmitUrl: `${base}/events` };
  }
  const required = ['dashboardGameId', 'envelopeGameId', 'bootstrapUrl', 'envelopeUrl', 'pregameUrl', 'eventSubmitUrl'];
  return required.every((field) => typeof config[field] === 'string' && config[field].startsWith('/')) ? config : null;
};

export const setFootballScorerRuntimeConfig = (config) => {
  if (typeof window !== 'undefined') window[key] = config;
};
