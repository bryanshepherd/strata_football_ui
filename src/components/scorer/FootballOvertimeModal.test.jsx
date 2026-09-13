import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import FootballOvertimeModal from './FootballOvertimeModal';
import FootballFlowModal from '../fcqi/FootballFlowModal';
import FootballScorerShell from '../../pages/FootballScorerShell';
import { gameEnvelopeFixtures, getGameEnvelopeFixture } from '../../data/footballGameEnvelopeFixtures';
import { applyFootballScorerEventToEnvelope } from '../../services/footballDashboardService';
const now = '2026-09-13T00:30:00Z';
function pendingEnvelope() {
  const base = structuredClone(getGameEnvelopeFixture('normal'));
  base.game = { ...base.game, period: 4, status: 'inProgress', rules: { ...base.game.rules, overtimeEnabled: true, overtimeStyle: 'possessionSeries', rulesPresetId: 'ncaa' }, teams: { H: { ...base.game.teams.H, score: 14 }, V: { ...base.game.teams.V, score: 14 } } };
  base.clock.period = 4; base.liveState.pendingTryTeam = null;
  return applyFootballScorerEventToEnvelope(base, { eventId: 'OT-END', clientEventId: 'OT-END', sequence: 50, type: 'gameControl', subtype: 'endQuarter', period: 4, clock: '00:00', acceptedAt: now, result: { gameControl: { action: 'endQuarter', period: 4 } } }).envelope;
}
describe('overtime confirmation', () => {
  it('confirms the official first offense and adjustable spot', async () => {
    const e = pendingEnvelope(); const confirm = vi.fn().mockResolvedValue(undefined);
    render(<FootballOvertimeModal envelope={e} pending={e.liveState.overtime} onConfirm={confirm} />);
    fireEvent.click(screen.getByRole('button', { name: e.game.teams.V.name }));
    expect(screen.getByRole('spinbutton')).toHaveValue(25);
    expect(screen.getByLabelText('Yardline team')).toHaveValue('H');
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and start possession' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith({ team: 'V', spot: 'H12' }));
  });
  it('starts overtime through the actual scorer shell and dismisses confirmation', async () => {
    const e = pendingEnvelope(); gameEnvelopeFixtures.overtimeAudit = e;
    const view = render(<MemoryRouter initialEntries={['/scorer?fixture=overtimeAudit&local=1']}><FootballScorerShell /></MemoryRouter>);
    expect(screen.getByRole('dialog', { name: /Overtime 1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and start possession' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Overtime 1/ })).not.toBeInTheDocument());
    expect(screen.getAllByText('OT1').length).toBeGreaterThan(0); expect(screen.getByText('Untimed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Rush/ })).toBeEnabled();
    expect(screen.queryByRole('dialog', { name: /Possession Clock|Game Wrap-Up/ })).not.toBeInTheDocument();
    view.unmount(); delete gameEnvelopeFixtures.overtimeAudit;
  });
  it('omits the kick PAT choice when a two-point try is required', () => {
    render(<FootballFlowModal state={{ status: 'token.awaiting', flow: 'kick', currentStep: 'patType', tokens: {}, currentToken: '' }} overtime twoPointOnly onTokenCommit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^Rush/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pass/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Kick/ })).not.toBeInTheDocument();
  });
});
