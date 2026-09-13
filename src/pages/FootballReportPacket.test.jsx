import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import { saveDashboardSeededFootballEnvelope } from '../services/footballDashboardService';
import FootballReportPacket from './FootballReportPacket';

const ORDER = ['scoring-summary', 'team-stats', 'individual-offense', 'defensive-stats', 'drive-chart', 'penalty-chart', 'participation', 'play-by-play'];
const game = () => {
  const envelope = structuredClone(baselineRecord.envelope);
  envelope.gameId = 'FB-PACKET-TEST';
  envelope.rosters.gameId = envelope.gameId;
  envelope.game.teams.V.name = 'Packet Visitor';
  envelope.game.teams.H.name = 'Packet Home';
  return envelope;
};
const navigate = (extra = '') => window.history.replaceState({}, '', `/index.html?report=report-packet&gameId=FB-PACKET-TEST&dashboardGameId=DASH-PACKET${extra}`);
const response = (payload, status = 200) => ({ ok: status === 200, status, json: async () => payload, headers: new Headers() });

beforeEach(() => { localStorage.clear(); navigate(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

describe('Report Packet', () => {
  it('combines all eight complete reports in the requested order with one print action', () => {
    const envelope = game();
    const before = JSON.stringify(envelope);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { container } = render(<FootballReportPacket envelope={envelope} />);
    const sections = [...container.querySelectorAll('[data-packet-report]')];
    expect(sections.map((section) => section.dataset.packetReport)).toEqual(ORDER);
    expect(screen.getAllByRole('navigation', { name: 'Report actions' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Print / Save PDF' }));
    expect(print).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Back to scorer' })).toHaveAttribute('href', '/index.html?envelopeGameId=FB-PACKET-TEST&dashboardGameId=DASH-PACKET');
    expect(container.querySelectorAll('[data-football-report="drive-chart-teams"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-football-report="drive-chart-chronological"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-football-report="penalty-chart"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-football-report="play-by-play-quarter"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-football-report="play-by-play-quarter-quickie"]')).toHaveLength(4);
    expect(within(sections[4]).getByRole('table', { name: 'Chronological drive chart' })).toBeInTheDocument();
    expect(within(sections[6]).getAllByRole('table')).toHaveLength(4);
    sections.forEach((section) => expect(section).toHaveTextContent('Packet Visitor'));
    expect(JSON.stringify(envelope)).toBe(before);
  });

  it('prints the complete game including overtime even if the URL contains an old quarter filter', () => {
    navigate('&quarter=1&scope=quarter');
    const envelope = game();
    const play = structuredClone(envelope.events.find((event) => event.type === 'rush'));
    play.eventId = 'OT-PACKET';
    play.sequence = envelope.events.length + 1;
    play.period = 5;
    envelope.events.push(play);
    const { container } = render(<FootballReportPacket envelope={envelope} />);
    expect([...container.querySelectorAll('[data-football-report="play-by-play-quarter"]')].map((page) => page.dataset.quarter)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('fetches the selected game once for the entire packet without changing local scoring state', async () => {
    const fetch = vi.fn().mockResolvedValue(response(game()));
    vi.stubGlobal('fetch', fetch);
    const { container } = render(<FootballReportPacket />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading report from server');
    expect(container).not.toHaveTextContent('Fairmont');
    await waitFor(() => expect(container.querySelectorAll('[data-packet-report]')).toHaveLength(8));
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/api/football/games/DASH-PACKET/envelope', expect.objectContaining({ method: 'GET', cache: 'no-store' }));
    expect(container).toHaveTextContent('Packet Visitor');
    expect(container).not.toHaveTextContent('Fairmont');
    expect(localStorage.length).toBe(0);
  });

  it('uses the current local game when opened from the scorer', () => {
    navigate('&source=local');
    saveDashboardSeededFootballEnvelope('FB-PACKET-TEST', game());
    const before = JSON.stringify(localStorage);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { container } = render(<FootballReportPacket />);
    expect(container.querySelectorAll('[data-packet-report]')).toHaveLength(8);
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(localStorage)).toBe(before);
  });

  it('does not render a partial or sample packet when the selected game fails to load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'Game unavailable' }, 404)));
    const { container } = render(<FootballReportPacket />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Game unavailable');
    expect(container.querySelectorAll('[data-packet-report]')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Print / Save PDF' })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('Fairmont');
  });
});
