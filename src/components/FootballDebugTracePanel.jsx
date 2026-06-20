import React, { useMemo, useState } from 'react';
import {
  groupTraceEntriesByEvent,
  serializeTraceEntries,
} from '../utils/footballDebugTrace';

const severityClassName = {
  info: 'bg-sky-100 text-sky-800 border-sky-200',
  pass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-900 border-amber-200',
  error: 'bg-red-100 text-red-800 border-red-200',
};

export default function FootballDebugTracePanel({ entries }) {
  const [copyStatus, setCopyStatus] = useState('');
  const groupedEntries = useMemo(() => groupTraceEntriesByEvent(entries), [entries]);
  const serializedEntries = useMemo(() => serializeTraceEntries(entries), [entries]);

  const copySession = async () => {
    await copyText(serializedEntries);
    setCopyStatus('Session trace copied');
  };

  const exportSession = () => {
    const encoded = encodeURIComponent(serializedEntries);
    const exportWindow = window.open(`data:application/json;charset=utf-8,${encoded}`, '_blank');
    if (!exportWindow) {
      setCopyStatus('Popup blocked; copy trace instead');
      return;
    }
    setCopyStatus('Session trace opened');
  };

  const copyGroup = async (groupEntries) => {
    await copyText(serializeTraceEntries(groupEntries));
    setCopyStatus('Play trace copied');
  };

  return (
    <section
      aria-label="Football debug trace"
      className="fixed inset-x-0 bottom-0 z-40 max-h-[42vh] border-t border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl"
    >
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Debug Trace</h2>
          <p className="text-xs text-zinc-400">
            {entries.length} structured checks grouped by play, event, or session
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {copyStatus && <span className="text-xs text-zinc-300">{copyStatus}</span>}
          <button
            className="rounded border border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
            onClick={copySession}
            type="button"
          >
            Copy Session
          </button>
          <button
            className="rounded border border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
            onClick={exportSession}
            type="button"
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="mx-auto max-h-[calc(42vh-74px)] max-w-[1500px] overflow-auto px-4 pb-4">
        <div className="space-y-3">
          {Object.entries(groupedEntries).map(([groupKey, groupEntries]) => (
            <details
              className="rounded border border-zinc-700 bg-zinc-900"
              key={groupKey}
              open={groupKey === 'fixture-preview-session'}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm font-semibold">{groupKey}</span>
                <span className="text-xs text-zinc-400">{groupEntries.length} checks</span>
              </summary>
              <div className="border-t border-zinc-700">
                <div className="flex justify-end px-3 py-2">
                  <button
                    className="rounded border border-zinc-600 px-2 py-1 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
                    onClick={() => copyGroup(groupEntries)}
                    type="button"
                  >
                    Copy Play
                  </button>
                </div>
                <ol className="divide-y divide-zinc-800">
                  {groupEntries.map((entry) => (
                    <li className="px-3 py-3" key={entry.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded border px-2 py-0.5 text-[11px] font-bold uppercase ${
                            severityClassName[entry.severity] || severityClassName.info
                          }`}
                        >
                          {entry.severity}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                          {entry.category}
                        </span>
                        <h3 className="text-sm font-semibold">{entry.checkName}</h3>
                      </div>
                      <p className="mt-2 text-sm text-zinc-200">{entry.inputSummary}</p>
                      <p className="mt-1 text-sm text-zinc-400">{entry.calculationDetails}</p>
                      <p className="mt-1 text-sm">
                        <span className="font-semibold text-zinc-100">Result:</span> {entry.result}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">{entry.reason}</p>
                      {entry.rawData && (
                        <details className="mt-2 rounded border border-zinc-800 bg-zinc-950">
                          <summary className="cursor-pointer px-2 py-1 text-xs font-semibold text-zinc-300">
                            Raw data
                          </summary>
                          <pre className="overflow-auto whitespace-pre-wrap px-2 pb-2 text-[11px] leading-relaxed text-zinc-300">
                            {JSON.stringify(entry.rawData, null, 2)}
                          </pre>
                        </details>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'absolute';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}
