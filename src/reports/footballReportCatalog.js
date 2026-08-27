export const FOOTBALL_REPORT_OPTIONS = Object.freeze([
  { id: 'scoring-summary', label: 'Scoring Summary' },
  { id: 'team-stats', label: 'Team Stats' },
  { id: 'penalty-chart', label: 'Penalty Chart' },
  { id: 'drive-chart', label: 'Drive Chart' },
  { id: 'quickie-stats', label: 'Quickie Stats' },
  { id: 'play-by-play', label: 'Play-by-Play' },
]);

export const buildFootballReportHref = ({
  baseUrl = '/',
  dashboardGameId,
  gameId,
  reportId,
}) => {
  const params = new URLSearchParams({ report: reportId, gameId });
  if (dashboardGameId) params.set('dashboardGameId', dashboardGameId);
  const requestedBase = String(baseUrl || '/');
  const normalizedBase = requestedBase.endsWith('/') ? requestedBase : `${requestedBase}/`;
  return `${normalizedBase}index.html?${params.toString()}`;
};
