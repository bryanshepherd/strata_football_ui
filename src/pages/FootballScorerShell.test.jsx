import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { gameEnvelopeFixtures } from '../data/footballGameEnvelopeFixtures';
import { buildFootballFixtureDebugTrace } from '../utils/footballDebugTrace';
import FootballReportPlaceholder from './FootballReportPlaceholder';
import FootballScorerShell from './FootballScorerShell';

const renderScorer = (initialEntry = '/') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<FootballScorerShell />} />
        <Route path="/reports" element={<FootballReportPlaceholder />} />
      </Routes>
    </MemoryRouter>,
  );

describe('FootballScorerShell', () => {
  it('renders the main scorer route from the default fixture envelope', () => {
    renderScorer();

    expect(screen.getByRole('heading', { name: /visitor tech at home state/i })).toBeInTheDocument();
    expect(screen.getByText('FB-NORMAL')).toBeInTheDocument();
    expect(screen.getByText('2 and 6')).toBeInTheDocument();
    expect(screen.getByText('H44')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /play entry/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /game log/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /roster lookup/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/football debug trace/i)).not.toBeInTheDocument();
  });

  it('renders the acceptance fixture states without backend data', () => {
    const fixtures = [
      ['/?fixture=pregame', 'FB-PREGAME', 'Not set'],
      ['/?fixture=redzone', 'FB-REDZONE', 'Red zone'],
      ['/?fixture=goalToGo', 'FB-GOALTOGO', '2 and goal'],
      ['/?fixture=final', 'FB-FINAL', 'End of game.'],
    ];

    fixtures.forEach(([entry, gameId, expectedText]) => {
      const { unmount } = renderScorer(entry);
      expect(screen.getAllByText(gameId).length).toBeGreaterThan(0);
      expect(screen.getAllByText(expectedText).length).toBeGreaterThan(0);
      unmount();
    });
  });

  it('renders the report route without football providers', () => {
    renderScorer('/reports?fixture=final');

    expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
    expect(screen.getByText(/FB-FINAL/)).toBeInTheDocument();
    expect(screen.getByText('Report Workspace')).toBeInTheDocument();
  });

  it('shows a route error for an unknown fixture key', () => {
    renderScorer('/?fixture=missing');

    expect(screen.getByRole('heading', { name: /fixture not found/i })).toBeInTheDocument();
    expect(screen.getByText(/No fixture envelope exists/)).toBeInTheDocument();
  });

  it('renders the bottom debug trace panel when debug mode is enabled', () => {
    renderScorer('/?fixture=goalToGo&debug=1');

    const panel = screen.getByLabelText(/football debug trace/i);
    expect(within(panel).getByRole('heading', { name: /debug trace/i })).toBeInTheDocument();
    expect(within(panel).getByText(/pre-play state read/i)).toBeInTheDocument();
    expect(within(panel).getByText(/possession-relative yard math/i)).toBeInTheDocument();
    expect(within(panel).getByText(/goal-to-go checks/i)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /copy session/i })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /export json/i })).toBeInTheDocument();
    expect(within(panel).getAllByRole('button', { name: /copy play/i }).length).toBeGreaterThan(0);
  });

  it('emits structured trace entries for key rule and submit checks', () => {
    const entries = buildFootballFixtureDebugTrace(gameEnvelopeFixtures.kickoffDrive);
    const checkNames = entries.map((entry) => entry.checkName);

    expect(checkNames).toContain('pre-play state read');
    expect(checkNames).toContain('possession normalization');
    expect(checkNames).toContain('yard-line parsing');
    expect(checkNames).toContain('possession-relative yard math');
    expect(checkNames).toContain('yards gained');
    expect(checkNames).toContain('line-to-gain lookup');
    expect(checkNames).toContain('yards-to-gain');
    expect(checkNames).toContain('first-down checks');
    expect(checkNames).toContain('kickoff new-drive checks');
    expect(checkNames).toContain('drive start/end decisions');
    expect(checkNames).toContain('penalty accepted/declined/offsetting checks');
    expect(checkNames).toContain('backend submit request creation');
    expect(checkNames).toContain('backend accepted envelope response');
    expect(checkNames).toContain('duplicate clientEventId handling');
    expect(checkNames).toContain('stale sequence/conflict handling');

    expect(entries[0]).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
        gameId: 'FB-KICKOFF-DRIVE',
        clientEventId: expect.any(String),
        category: expect.any(String),
        checkName: expect.any(String),
        inputSummary: expect.any(String),
        calculationDetails: expect.any(String),
        result: expect.any(String),
        reason: expect.any(String),
        severity: expect.stringMatching(/info|pass|warning|error/),
      }),
    );
  });
});
