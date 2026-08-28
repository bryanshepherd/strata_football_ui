import { describe, expect, it } from 'vitest';
import { allocateLateralStats, type LateralStatAllocationInput } from './lateralStatAllocation';

const PASS_LATERAL: LateralStatAllocationInput = {
  playFamily: 'pass',
  startSpot: 30,
  firstSegmentEndSpot: 40,
  terminalSpot: 65,
  laterals: [
    {
      lateralFromSpot: 40,
      lateralToSpot: 38,
      continuationType: 'receiving',
    },
  ],
};

describe('allocateLateralStats', () => {
  it('keeps a completed-pass lateral in passing and receiving yardage', () => {
    const result = allocateLateralStats(PASS_LATERAL);

    expect(result.ok).toBe(true);
    expect(result.totalGain).toBe(35);
    expect(result.allocatedTotal).toBe(35);
    expect(result.miscYards).toBe(0);
    expect(result.buckets).toMatchObject({
      passingYards: 35,
      receivingYards: 35,
    });
    expect(result.attempts.rushingAttempts ?? 0).toBe(0);
    expect(result.segments).toEqual([
      {
        type: 'original',
        yards: 8,
        fromSpot: 30,
        toSpot: 38,
        bucket: 'receivingYards',
        createsAttempt: false,
      },
      {
        type: 'continuation',
        yards: 27,
        fromSpot: 38,
        toSpot: 65,
        bucket: 'receivingYards',
        createsAttempt: false,
      },
    ]);
  });

  it('allocates a rush lateral with one original rushing attempt and no new attempt', () => {
    const result = allocateLateralStats({
      playFamily: 'rush',
      startSpot: 30,
      firstSegmentEndSpot: 40,
      terminalSpot: 65,
      laterals: [{ lateralFromSpot: 40, lateralToSpot: 38, continuationType: 'rush' }],
    });

    expect(result.ok).toBe(true);
    expect(result.totalGain).toBe(35);
    expect(result.allocatedTotal).toBe(35);
    expect(result.miscYards).toBe(-2);
    expect(result.buckets.rushingYards).toBe(37);
    expect(result.attempts.rushingAttempts).toBe(1);
    expect(result.segments.filter((segment) => segment.type === 'continuation')).toEqual([
      {
        type: 'continuation',
        yards: 27,
        fromSpot: 38,
        toSpot: 65,
        bucket: 'rushingYards',
        createsAttempt: false,
      },
    ]);
  });

  it('allocates an interception return lateral', () => {
    const result = allocateLateralStats({
      playFamily: 'interceptionReturn',
      startSpot: 45,
      firstSegmentEndSpot: 55,
      terminalSpot: 70,
      laterals: [{ lateralFromSpot: 55, lateralToSpot: 50, continuationType: 'interceptionReturn' }],
    });

    expect(result.ok).toBe(true);
    expect(result.miscYards).toBe(-5);
    expect(result.buckets.interceptionReturnYards).toBe(30);
    expect(result.attempts.interceptionReturnAttempts).toBe(1);
    expect(result.totalGain).toBe(25);
    expect(result.allocatedTotal).toBe(25);
  });

  it('allocates a fumble return lateral', () => {
    const result = allocateLateralStats({
      playFamily: 'fumbleReturn',
      startSpot: 35,
      firstSegmentEndSpot: 45,
      terminalSpot: 60,
      laterals: [{ lateralFromSpot: 45, lateralToSpot: 43, continuationType: 'fumbleReturn' }],
    });

    expect(result.ok).toBe(true);
    expect(result.miscYards).toBe(-2);
    expect(result.buckets.fumbleReturnYards).toBe(27);
    expect(result.attempts.fumbleReturnAttempts).toBe(1);
    expect(result.totalGain).toBe(25);
    expect(result.allocatedTotal).toBe(25);
  });

  it('allocates a kickoff return lateral', () => {
    const result = allocateLateralStats({
      playFamily: 'kickReturn',
      startSpot: 10,
      firstSegmentEndSpot: 28,
      terminalSpot: 42,
      laterals: [{ lateralFromSpot: 28, lateralToSpot: 25, continuationType: 'kickReturn' }],
    });

    expect(result.ok).toBe(true);
    expect(result.miscYards).toBe(-3);
    expect(result.buckets.kickReturnYards).toBe(35);
    expect(result.attempts.kickReturnAttempts).toBe(1);
    expect(result.totalGain).toBe(32);
    expect(result.allocatedTotal).toBe(32);
  });

  it('allocates a punt return lateral', () => {
    const result = allocateLateralStats({
      playFamily: 'puntReturn',
      startSpot: 20,
      firstSegmentEndSpot: 35,
      terminalSpot: 48,
      laterals: [{ lateralFromSpot: 35, lateralToSpot: 33, continuationType: 'puntReturn' }],
    });

    expect(result.ok).toBe(true);
    expect(result.miscYards).toBe(-2);
    expect(result.buckets.puntReturnYards).toBe(30);
    expect(result.attempts.puntReturnAttempts).toBe(1);
    expect(result.totalGain).toBe(28);
    expect(result.allocatedTotal).toBe(28);
  });

  it('allocates a field goal return lateral', () => {
    const result = allocateLateralStats({
      playFamily: 'fieldGoalReturn',
      startSpot: 5,
      firstSegmentEndSpot: 22,
      terminalSpot: 39,
      laterals: [{ lateralFromSpot: 22, lateralToSpot: 20, continuationType: 'fieldGoalReturn' }],
    });

    expect(result.ok).toBe(true);
    expect(result.miscYards).toBe(-2);
    expect(result.buckets.fieldGoalReturnYards).toBe(36);
    expect(result.attempts.fieldGoalReturnAttempts).toBe(1);
    expect(result.totalGain).toBe(34);
    expect(result.allocatedTotal).toBe(34);
  });

  it('allocates multiple laterals with multiple miscellaneous segments', () => {
    const result = allocateLateralStats({
      playFamily: 'rush',
      startSpot: 30,
      firstSegmentEndSpot: 40,
      terminalSpot: 65,
      laterals: [
        { lateralFromSpot: 40, lateralToSpot: 38, continuationType: 'rush' },
        { lateralFromSpot: 52, lateralToSpot: 50, continuationType: 'rush' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.totalGain).toBe(35);
    expect(result.allocatedTotal).toBe(35);
    expect(result.miscYards).toBe(-4);
    expect(result.buckets.rushingYards).toBe(39);
    expect(result.attempts.rushingAttempts).toBe(1);
    expect(result.segments.map((segment) => segment.yards)).toEqual([10, -2, 14, -2, 15]);
    expect(result.segments.filter((segment) => segment.type === 'continuation')).toEqual([
      {
        type: 'continuation',
        yards: 14,
        fromSpot: 38,
        toSpot: 52,
        bucket: 'rushingYards',
        createsAttempt: false,
      },
      {
        type: 'continuation',
        yards: 15,
        fromSpot: 50,
        toSpot: 65,
        bucket: 'rushingYards',
        createsAttempt: false,
      },
    ]);
  });

  it('allows a forward lateral-exchange gain when data contains one', () => {
    const result = allocateLateralStats({
      playFamily: 'rush',
      startSpot: 30,
      firstSegmentEndSpot: 40,
      terminalSpot: 65,
      laterals: [{ lateralFromSpot: 40, lateralToSpot: 42, continuationType: 'rush' }],
    });

    expect(result.ok).toBe(true);
    expect(result.miscYards).toBe(2);
    expect(result.buckets.rushingYards).toBe(33);
    expect(result.totalGain).toBe(35);
    expect(result.allocatedTotal).toBe(35);
  });

  it('passes the sanity check when allocated total equals terminal minus start', () => {
    const result = allocateLateralStats(PASS_LATERAL);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.allocatedTotal).toBe(result.totalGain);
  });

  it('fails the sanity check when input segments cannot reconcile', () => {
    const result = allocateLateralStats({
      playFamily: 'rush',
      startSpot: 30,
      firstSegmentEndSpot: 40,
      terminalSpot: 65,
      laterals: [{ lateralFromSpot: 42, lateralToSpot: 38, continuationType: 'rush' }],
    });

    expect(result.ok).toBe(false);
    expect(result.totalGain).toBe(35);
    expect(result.allocatedTotal).toBe(33);
    expect(result.errors.map((error) => error.code)).toEqual(['SEGMENT_GAP', 'SANITY_CHECK_FAILED']);
  });

  it('does not create a new return attempt when a lateral receiver advances the ball', () => {
    const result = allocateLateralStats({
      playFamily: 'kickReturn',
      startSpot: 10,
      firstSegmentEndSpot: 28,
      terminalSpot: 60,
      laterals: [
        { lateralFromSpot: 28, lateralToSpot: 25, continuationType: 'kickReturn' },
        { lateralFromSpot: 42, lateralToSpot: 40, continuationType: 'kickReturn' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.attempts.kickReturnAttempts).toBe(1);
    expect(result.segments.filter((segment) => segment.createsAttempt)).toHaveLength(1);
    expect(result.segments.filter((segment) => segment.type === 'continuation')).toEqual([
      {
        type: 'continuation',
        yards: 17,
        fromSpot: 25,
        toSpot: 42,
        bucket: 'kickReturnYards',
        createsAttempt: false,
      },
      {
        type: 'continuation',
        yards: 20,
        fromSpot: 40,
        toSpot: 60,
        bucket: 'kickReturnYards',
        createsAttempt: false,
      },
    ]);
  });

  it('does not mutate the input object', () => {
    const input = {
      ...PASS_LATERAL,
      laterals: PASS_LATERAL.laterals.map((segment) => ({ ...segment })),
    };
    const snapshot = structuredClone(input);

    allocateLateralStats(input);

    expect(input).toEqual(snapshot);
  });
});
