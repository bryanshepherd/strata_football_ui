export type LateralPlayFamily =
  | 'rush'
  | 'pass'
  | 'fumbleReturn'
  | 'interceptionReturn'
  | 'kickReturn'
  | 'puntReturn'
  | 'fieldGoalReturn';

export type LateralContinuationType =
  | 'rush'
  | 'receiving'
  | 'fumbleReturn'
  | 'interceptionReturn'
  | 'kickReturn'
  | 'puntReturn'
  | 'fieldGoalReturn'
  | 'misc';

export type LateralStatAllocationInput = {
  playFamily: LateralPlayFamily;
  startSpot: number;
  firstSegmentEndSpot: number;
  terminalSpot: number;
  laterals: LateralSegmentInput[];
};

export type LateralSegmentInput = {
  lateralFromSpot: number;
  lateralToSpot: number;
  continuationType: LateralContinuationType;
};

export type LateralStatBucketKey =
  | 'passingYards'
  | 'receivingYards'
  | 'rushingYards'
  | 'fumbleReturnYards'
  | 'interceptionReturnYards'
  | 'kickReturnYards'
  | 'puntReturnYards'
  | 'fieldGoalReturnYards';

export type LateralAttemptKey =
  | 'rushingAttempts'
  | 'receivingAttempts'
  | 'fumbleReturnAttempts'
  | 'interceptionReturnAttempts'
  | 'kickReturnAttempts'
  | 'puntReturnAttempts'
  | 'fieldGoalReturnAttempts';

export type LateralStatAllocationSegment = {
  type: 'original' | 'lateralMisc' | 'continuation';
  yards: number;
  fromSpot: number;
  toSpot: number;
  bucket: string;
  createsAttempt: boolean;
};

export type LateralStatAllocationError = {
  code: string;
  message: string;
};

export type LateralStatAllocationResult = {
  ok: boolean;
  totalGain: number;
  allocatedTotal: number;
  miscYards: number;
  buckets: Partial<Record<LateralStatBucketKey, number>>;
  attempts: Partial<Record<LateralAttemptKey, number>>;
  segments: LateralStatAllocationSegment[];
  errors: LateralStatAllocationError[];
};

const PLAY_FAMILIES = new Set<LateralPlayFamily>([
  'rush',
  'pass',
  'fumbleReturn',
  'interceptionReturn',
  'kickReturn',
  'puntReturn',
  'fieldGoalReturn',
]);

const CONTINUATION_TYPES = new Set<LateralContinuationType>([
  'rush',
  'receiving',
  'fumbleReturn',
  'interceptionReturn',
  'kickReturn',
  'puntReturn',
  'fieldGoalReturn',
  'misc',
]);

const RETURN_ATTEMPT_BY_FAMILY: Partial<Record<LateralPlayFamily, LateralAttemptKey>> = {
  fumbleReturn: 'fumbleReturnAttempts',
  interceptionReturn: 'interceptionReturnAttempts',
  kickReturn: 'kickReturnAttempts',
  puntReturn: 'puntReturnAttempts',
  fieldGoalReturn: 'fieldGoalReturnAttempts',
};

export function allocateLateralStats(input: LateralStatAllocationInput): LateralStatAllocationResult {
  const errors: LateralStatAllocationError[] = [];
  const segments: LateralStatAllocationSegment[] = [];
  const buckets: Partial<Record<LateralStatBucketKey, number>> = {};
  const attempts: Partial<Record<LateralAttemptKey, number>> = {};
  const laterals = Array.isArray(input?.laterals) ? input.laterals.map((segment) => ({ ...segment })) : [];

  validateInput(input, laterals, errors);

  const totalGain = safeDifference(input?.terminalSpot, input?.startSpot);
  const originalEndSpot = input?.playFamily === 'pass' && laterals.length > 0
    ? laterals[0].lateralToSpot
    : input?.firstSegmentEndSpot;
  const originalYards = safeDifference(originalEndSpot, input?.startSpot);

  if (Number.isFinite(originalYards)) {
    const originalBuckets = originalBucketKeys(input.playFamily);
    const originalAttemptKey = originalAttemptForFamily(input.playFamily);
    const originalSegment = {
      type: 'original' as const,
      yards: originalYards,
      fromSpot: input.startSpot,
      toSpot: originalEndSpot,
      bucket: originalBuckets.join('+') || 'unknown',
      createsAttempt: Boolean(originalAttemptKey),
    };

    segments.push(originalSegment);
    originalBuckets.forEach((bucket) => addYards(buckets, bucket, originalYards));
    if (originalAttemptKey) {
      addAttempt(attempts, originalAttemptKey, 1);
    }
  }

  laterals.forEach((lateral, index) => {
    if (input.playFamily === 'pass') {
      const continuationEndSpot = laterals[index + 1]?.lateralToSpot ?? input.terminalSpot;
      const continuationYards = safeDifference(continuationEndSpot, lateral.lateralToSpot);
      if (Number.isFinite(continuationYards)) {
        segments.push({
          type: 'continuation',
          yards: continuationYards,
          fromSpot: lateral.lateralToSpot,
          toSpot: continuationEndSpot,
          bucket: 'receivingYards',
          createsAttempt: false,
        });
        addYards(buckets, 'receivingYards', continuationYards);
      }
      return;
    }

    const miscYards = safeDifference(lateral.lateralToSpot, lateral.lateralFromSpot);
    if (Number.isFinite(miscYards)) {
      segments.push({
        type: 'lateralMisc',
        yards: miscYards,
        fromSpot: lateral.lateralFromSpot,
        toSpot: lateral.lateralToSpot,
        bucket: 'miscYards',
        createsAttempt: false,
      });
    }

    const continuationEndSpot = laterals[index + 1]?.lateralFromSpot ?? input.terminalSpot;
    const continuationYards = safeDifference(continuationEndSpot, lateral.lateralToSpot);
    if (Number.isFinite(continuationYards)) {
      const continuationBucket = continuationBucketKey(lateral.continuationType);
      segments.push({
        type: 'continuation',
        yards: continuationYards,
        fromSpot: lateral.lateralToSpot,
        toSpot: continuationEndSpot,
        bucket: continuationBucket ?? 'miscYards',
        createsAttempt: false,
      });

      if (continuationBucket) {
        addYards(buckets, continuationBucket, continuationYards);
      }
    }
  });

  const miscYards = segments
    .filter((segment) => segment.bucket === 'miscYards')
    .reduce((sum, segment) => sum + segment.yards, 0);
  const allocatedTotal = segments.reduce((sum, segment) => sum + segment.yards, 0);

  if (input.playFamily === 'pass' && Number.isFinite(totalGain)) {
    buckets.passingYards = totalGain;
  }

  validateContinuity(input, laterals, errors);

  if (Number.isFinite(totalGain) && allocatedTotal !== totalGain) {
    errors.push({
      code: 'SANITY_CHECK_FAILED',
      message: `Allocated total ${allocatedTotal} does not equal total gain ${totalGain}.`,
    });
  }

  return {
    ok: errors.length === 0,
    totalGain: Number.isFinite(totalGain) ? totalGain : 0,
    allocatedTotal,
    miscYards,
    buckets,
    attempts,
    segments,
    errors,
  };
}

function validateInput(
  input: LateralStatAllocationInput,
  laterals: LateralSegmentInput[],
  errors: LateralStatAllocationError[],
) {
  if (!PLAY_FAMILIES.has(input?.playFamily)) {
    errors.push({
      code: 'INVALID_PLAY_FAMILY',
      message: 'playFamily must be a supported live-ball play or return family.',
    });
  }

  validateSpot('startSpot', input?.startSpot, errors);
  validateSpot('firstSegmentEndSpot', input?.firstSegmentEndSpot, errors);
  validateSpot('terminalSpot', input?.terminalSpot, errors);

  if (!Array.isArray(input?.laterals)) {
    errors.push({
      code: 'INVALID_LATERALS',
      message: 'laterals must be an array.',
    });
  }

  laterals.forEach((lateral, index) => {
    validateSpot(`laterals[${index}].lateralFromSpot`, lateral.lateralFromSpot, errors);
    validateSpot(`laterals[${index}].lateralToSpot`, lateral.lateralToSpot, errors);
    if (!CONTINUATION_TYPES.has(lateral.continuationType)) {
      errors.push({
        code: 'INVALID_CONTINUATION_TYPE',
        message: `laterals[${index}].continuationType must be supported.`,
      });
    }
  });
}

function validateSpot(field: string, value: number, errors: LateralStatAllocationError[]) {
  if (!Number.isFinite(value)) {
    errors.push({
      code: 'INVALID_SPOT',
      message: `${field} must be a finite numeric engine spot.`,
    });
    return;
  }

  if (value < 0 || value > 100) {
    errors.push({
      code: 'INVALID_SPOT',
      message: `${field} must be between 0 and 100.`,
    });
  }
}

function validateContinuity(
  input: LateralStatAllocationInput,
  laterals: LateralSegmentInput[],
  errors: LateralStatAllocationError[],
) {
  if (laterals.length === 0) {
    if (input.firstSegmentEndSpot !== input.terminalSpot) {
      errors.push({
        code: 'SEGMENT_GAP',
        message: 'A play with no lateral segments must end its original segment at the terminal spot.',
      });
    }
    return;
  }

  if (laterals[0].lateralFromSpot !== input.firstSegmentEndSpot) {
    errors.push({
      code: 'SEGMENT_GAP',
      message: 'firstSegmentEndSpot must match the first lateralFromSpot.',
    });
  }
}

function originalBucketKeys(playFamily: LateralPlayFamily): LateralStatBucketKey[] {
  switch (playFamily) {
    case 'pass':
      return ['receivingYards'];
    case 'rush':
      return ['rushingYards'];
    case 'fumbleReturn':
      return ['fumbleReturnYards'];
    case 'interceptionReturn':
      return ['interceptionReturnYards'];
    case 'kickReturn':
      return ['kickReturnYards'];
    case 'puntReturn':
      return ['puntReturnYards'];
    case 'fieldGoalReturn':
      return ['fieldGoalReturnYards'];
    default:
      return [];
  }
}

function originalAttemptForFamily(playFamily: LateralPlayFamily): LateralAttemptKey | null {
  if (playFamily === 'rush') {
    return 'rushingAttempts';
  }

  return RETURN_ATTEMPT_BY_FAMILY[playFamily] ?? null;
}

function continuationBucketKey(continuationType: LateralContinuationType): LateralStatBucketKey | null {
  switch (continuationType) {
    case 'rush':
      return 'rushingYards';
    case 'receiving':
      return 'receivingYards';
    case 'fumbleReturn':
      return 'fumbleReturnYards';
    case 'interceptionReturn':
      return 'interceptionReturnYards';
    case 'kickReturn':
      return 'kickReturnYards';
    case 'puntReturn':
      return 'puntReturnYards';
    case 'fieldGoalReturn':
      return 'fieldGoalReturnYards';
    case 'misc':
      return null;
    default:
      return null;
  }
}

function addYards(
  buckets: Partial<Record<LateralStatBucketKey, number>>,
  bucket: LateralStatBucketKey,
  yards: number,
) {
  buckets[bucket] = (buckets[bucket] ?? 0) + yards;
}

function addAttempt(
  attempts: Partial<Record<LateralAttemptKey, number>>,
  attempt: LateralAttemptKey,
  count: number,
) {
  attempts[attempt] = (attempts[attempt] ?? 0) + count;
}

function safeDifference(toSpot: number, fromSpot: number) {
  if (!Number.isFinite(toSpot) || !Number.isFinite(fromSpot)) {
    return Number.NaN;
  }
  return toSpot - fromSpot;
}
