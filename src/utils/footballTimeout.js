export const isFootballTimeout = event => event?.type === 'gameControl'
  && event.result?.gameControl?.action === 'timeout';

export const footballTimeoutValues = event => ({
  teamSide: event?.result?.gameControl?.teamSide || event?.result?.gameControl?.possession || '',
  clock: event?.result?.gameControl?.clock || event?.clock || '',
});
