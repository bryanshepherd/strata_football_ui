import React, { useEffect, useRef, useState } from 'react';
import { formatFootballClockEntry, normalizeFootballClock } from '../../utils/footballClock';
import FootballClockEntryModal from './FootballClockEntryModal';

export default function FootballPossessionClockModal({ change, onSave }) {
  const [clock, setClock] = useState(() => formatFootballClockEntry(change?.defaultClock || ''));
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setClock(formatFootballClockEntry(change?.defaultClock || ''));
    setError('');
    if (!change) return undefined;
    const selectionTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(selectionTimer);
  }, [change]);

  if (!change) return null;

  const submit = (event) => {
    event.preventDefault();
    const normalized = normalizeFootballClock(clock);
    if (!normalized) {
      setError('Enter M:SS or MM:SS. Three digits are read as M:SS.');
      return;
    }
    onSave(normalized);
  };

  return (
    <FootballClockEntryModal
      ariaLabel="Change of possession clock"
      eyebrow="Change of Possession"
      error={error}
      inputId="possession-change-clock"
      inputRef={inputRef}
      onChange={(event) => {
        setClock(formatFootballClockEntry(event.target.value));
        setError('');
      }}
      onSubmit={submit}
      value={clock}
    />
  );
}
