import assert from 'node:assert/strict';
import { test } from 'vitest';
import { formatFootballPlayText } from './footballPlayByPlay';

const teams = { H: { abbr: 'MID' }, V: { abbr: 'BU' } };
const description = 'MID #9 Duri Trahan pass complete to #18 Jamarion Smith for 17 yards to the V35, tackled by #45 Joseph Sebastian.';
const event = (pass = {}) => ({ type: 'pass', subtype: 'complete', description, result: { pass } });

test('completed passes include a recorded catch and tackle location with total gain', () => {
  for (const key of ['catchYardLine', 'caughtAtYardLine']) {
    const play = event({ [key]: 'V42' });
    const before = JSON.stringify(play);
    const expected = '#9 Duri Trahan pass complete to #18 Jamarion Smith at the BU 42, tackled by #45 Joseph Sebastian at the BU 35 for a gain of 17 yards.';
    assert.equal(formatFootballPlayText(play, teams), expected);
    assert.equal(JSON.stringify(play), before);
    assert.equal(formatFootballPlayText({ ...play, description: expected }, teams), expected);
  }
});

test('missing or invalid catch spots and non-completions retain existing text', () => {
  const original = '#9 Duri Trahan pass complete to #18 Jamarion Smith for 17 yards to the BU 35, tackled by #45 Joseph Sebastian.';
  for (const pass of [{}, { caughtAtYardLine: '' }, { caughtAtYardLine: 'unknown' }, { yardsAfterCatch: 7 }]) {
    assert.equal(formatFootballPlayText(event(pass), teams), original);
  }
  for (const text of ['#9 Duri Trahan pass incomplete.', '#9 Duri Trahan pass intercepted by #45 Joseph Sebastian at the V42.']) {
    assert.equal(formatFootballPlayText({ ...event({ caughtAtYardLine: 'V42' }), description: text }, teams), text.replace('V42', 'BU 42'));
  }
});

test('preserves penalties, multiple tacklers, loss and zero yardage', () => {
  const play = event({ caughtAtYardLine: 'H30' });
  for (const [yards, expected] of [['1 yard', 'a gain of 1 yard'], ['no gain', 'no gain'], ['loss of 2 yards', 'a loss of 2 yards']]) {
    const text = description.replace('17 yards', yards).replace('#45 Joseph Sebastian.', '#45 Joseph Sebastian and #2 Second Tackler, PENALTY MID Holding, 10 yards to the V45.');
    assert.equal(formatFootballPlayText({ ...play, description: text }, teams), `#9 Duri Trahan pass complete to #18 Jamarion Smith at the MID 30, tackled by #45 Joseph Sebastian and #2 Second Tackler at the BU 35 for ${expected}, PENALTY MID Holding, 10 yards to the BU 45.`);
  }
});

test('handles untackled, out-of-bounds and touchdown completions', () => {
  const play = event({ caughtAtYardLine: 'V00' });
  const lead = '#9 Duri Trahan pass complete to #18 Jamarion Smith';
  for (const [ending, expected] of [
    ['for 17 yards to the V35.', ', advanced to the BU 35 for a gain of 17 yards.'],
    ['for 17 yards to the V35, out-of-bounds.', ', out-of-bounds at the BU 35 for a gain of 17 yards.'],
    ['for 17 yards for a touchdown.', ' for a gain of 17 yards for a touchdown.'],
  ]) {
    assert.equal(formatFootballPlayText({ ...play, description: `${lead} ${ending}` }, teams), `${lead} at the BU 0${expected}`);
  }
});

test('preserves fumble and lateral continuation wording after identifying the catch', () => {
  const play = event({ caughtAtYardLine: 'V42' });
  for (const suffix of [', fumbled at the V35, recovered by BU at the V35.', ', lateral to #3 Another Player at the V40.']) {
    const text = description.replace(', tackled by #45 Joseph Sebastian.', suffix);
    const expected = text.replace('MID ', '').replace('Smith for', 'Smith at the V42 for').replace(/V(\d+)/g, 'BU $1');
    assert.equal(formatFootballPlayText({ ...play, description: text }, teams), expected);
  }
});
