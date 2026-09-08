import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import baselineRecord from '../../data/footballCompletedBaselineGameRecord.json';
import { saveDashboardSeededFootballEnvelope } from '../../services/footballDashboardService';
import FootballReportLoader from './FootballReportLoader';
import FootballScoringSummaryReport from '../../pages/FootballScoringSummaryReport';
import FootballTeamStatsReport from '../../pages/FootballTeamStatsReport';
import FootballPenaltyChartReport from '../../pages/FootballPenaltyChartReport';
import FootballDriveChartReport from '../../pages/FootballDriveChartReport';
import FootballQuickieStatsReport from '../../pages/FootballQuickieStatsReport';
import FootballIndividualOffenseReport from '../../pages/FootballIndividualOffenseReport';
import FootballPlayByPlayReport from '../../pages/FootballPlayByPlayReport';
import FootballMaxPrepsExportReport from '../../pages/FootballMaxPrepsExportReport';

const serverEnvelope = () => {
  const result = structuredClone(baselineRecord.envelope);
  result.gameId = 'FB-SERVER-REPORT';
  result.rosters.gameId = result.gameId;
  result.game.teams.V.name = 'Server Visitor';
  result.game.teams.H.name = 'Server Home';
  return result;
};
const respond = (payload, status = 200) => ({
  ok: status === 200, status, json: async () => payload,
  headers: new Headers({ 'X-Strata-Football-Mirror-Source': 'other-scorer', 'X-Strata-Football-Mirror-Revision': '10' }),
});
const navigate = (query = '') => window.history.replaceState({}, '',
  `/football-scorer/index.html?report=scoring-summary&gameId=FB-SERVER-REPORT&dashboardGameId=DASH-REPORT${query}`);
const probe = () => render(<FootballReportLoader>{(envelope) => <div>{envelope.game.teams.V.name}</div>}</FootballReportLoader>);

beforeEach(() => { localStorage.clear(); navigate(); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

it.each([
  FootballScoringSummaryReport, FootballTeamStatsReport, FootballPenaltyChartReport,
  FootballDriveChartReport, FootballQuickieStatsReport, FootballIndividualOffenseReport,
  FootballPlayByPlayReport, FootballMaxPrepsExportReport,
])('loads the selected server game with empty browser storage for %s', async (Report) => {
  const fetch = vi.fn().mockResolvedValue(respond(serverEnvelope()));
  vi.stubGlobal('fetch', fetch);
  const { container } = render(<Report />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading report from server');
  expect(container).not.toHaveTextContent('Fairmont');
  await waitFor(() => expect(container).toHaveTextContent('Server Visitor'));
  expect(container).not.toHaveTextContent('Fairmont');
  expect(fetch).toHaveBeenCalledWith('/api/football/games/DASH-REPORT/envelope', expect.objectContaining({
    method: 'GET', credentials: 'same-origin', cache: 'no-store',
  }));
  expect(localStorage.length).toBe(0);
});

it('uses server data even when browser data exists without changing local scoring state', async () => {
  const local = serverEnvelope(); local.game.teams.V.name = 'Unsynced Local Visitor';
  saveDashboardSeededFootballEnvelope(local.gameId, local);
  const before = JSON.stringify(localStorage);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(serverEnvelope())));
  probe();
  expect(screen.queryByText('Unsynced Local Visitor')).not.toBeInTheDocument();
  expect(await screen.findByText('Server Visitor')).toBeInTheDocument();
  expect(JSON.stringify(localStorage)).toBe(before);
});

it('preserves local reports explicitly opened from the scorer', () => {
  navigate('&source=local');
  const local = serverEnvelope(); local.game.teams.V.name = 'Unsynced Local Visitor';
  saveDashboardSeededFootballEnvelope(local.gameId, local);
  vi.stubGlobal('fetch', vi.fn());
  probe();
  expect(screen.getByText('Unsynced Local Visitor')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it('loads from the server when a scorer-local report has no local game', async () => {
  navigate('&source=local');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(serverEnvelope())));
  probe();
  expect(await screen.findByText('Server Visitor')).toBeInTheDocument();
});

it.each([401, 403, 404, 500])('shows an error instead of any cached or sample game on HTTP %s', async (status) => {
  saveDashboardSeededFootballEnvelope('FB-SERVER-REPORT', serverEnvelope());
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ error: 'Game unavailable' }, status)));
  probe();
  expect(await screen.findByRole('alert')).toHaveTextContent('Game unavailable');
  expect(screen.queryByText('Server Visitor')).not.toBeInTheDocument();
  expect(document.body).not.toHaveTextContent('Fairmont');
});

it('rejects a response for another game', async () => {
  const wrong = serverEnvelope(); wrong.gameId = 'OTHER-GAME';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(wrong)));
  probe();
  expect(await screen.findByRole('alert')).toHaveTextContent('different game');
});

it('retries after a network error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(respond(serverEnvelope())));
  probe();
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Server Visitor')).toBeInTheDocument();
});

it('does not show sample data when the dashboard link is missing a game ID', () => {
  window.history.replaceState({}, '', '/index.html?dashboardGameId=DASH-REPORT');
  probe();
  expect(screen.getByRole('alert')).toHaveTextContent('missing its game ID');
});
