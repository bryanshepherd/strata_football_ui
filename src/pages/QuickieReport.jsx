// src/pages/QuickieReport.jsx
import React, { useEffect, useState } from 'react';

const Cell = ({children, className=''}) => (
  <td className={`px-2 py-1 text-xs align-top ${className}`}>{children}</td>
);

export default function QuickieReport({ gameId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const id = gameId ?? new URLSearchParams(location.search).get('game_id');
    fetch(`/strata_football/php/reports/quickie_report.php?game_id=${id}`)
      .then(r => r.json())
      .then(setData)
      .catch(e => setErr(String(e)));
  }, [gameId]);

  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!data) return <div className="p-4 text-gray-600">Loading quickie…</div>;

  const H = data.home, V = data.visitor;

  const teamHeader = (
    <tr className="bg-gray-100 text-xs font-bold">
      <td className="px-2 py-1 w-1/2">FIRST QUARTER</td>
      <td className="px-2 py-1 text-right">{V.team.abbr}</td>
      <td className="px-2 py-1 text-right">{H.team.abbr}</td>
    </tr>
  );

  const statRow = (label, v, h) => (
    <tr>
      <Cell>{label}</Cell>
      <Cell className="text-right">{v}</Cell>
      <Cell className="text-right">{h}</Cell>
    </tr>
  );

  const formatRush = t => `${t.rush.att}-${t.rush.yds}`;
  const formatPass = t => `${t.pass.cmp}-${t.pass.att}-${t.pass.int}`;
  const formatToPY = t => `${t.plays}-${t.yards}`;

  const pct = (m,a) => a ? `${m}/${a}` : '0/0';
  const rz = t => `${t.red_zone.scores}-${t.red_zone.chances}`;

  const RosterTable = ({title, rows, cols}) => (
    <div className="mt-2">
      <div className="font-semibold text-xs mb-1">{title}</div>
      <table className="w-full border border-gray-200 text-xs">
        <thead className="bg-gray-50">
          <tr>
            {cols.map((c,i)=><th key={i} className="px-2 py-1 text-left">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i} className="border-t">
              {Object.values(r).map((v,j)=><td key={j} className="px-2 py-1">{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // helpers to map your player arrays to simple row objects
  const mapRush = p => ({ Name:p.name, No:p.jersey ?? p.id, Gain:p.yds_gained ?? p.yds ?? 0, Loss:p.loss ?? 0, Net:p.yds ?? 0, TD:p.td ?? 0, Lg:p.lg ?? 0, Avg: (p.att? (Math.round((p.yds/p.att)*10)/10) : 0) });
  const mapPass = p => ({ C_A: `${p.cmp}-${p.att}`, Yds:p.yds ?? 0, TD:p.td ?? 0, Long:p.lg ?? 0, Sack:p.sack ?? 0 });
  const mapRecv = p => ({ TAR:p.tar ?? p.targets ?? 0, No:p.rec ?? 0, Yards:p.yds ?? 0, YAC:p.yac ?? 0, TD:p.td ?? 0, Long:p.lg ?? 0 });
  const mapPunt = p => ({ No:p.num ?? 0, Yds:p.yds ?? 0, Avg:p.avg ?? 0, Long:p.lg ?? 0, In20:p.in20 ?? 0, TB:p.tb ?? 0 });
  const mapKR   = p => ({ No:p.num ?? 0, Yards:p.yds ?? 0, TD:p.td ?? 0, Long:p.lg ?? 0 });
  const mapPR   = mapKR;
  const mapTkls = p => ({ Name:p.name, UA:p.ua ?? 0, A:p.a ?? 0, Total:( (p.ua??0)+(p.a??0) ), Sacks:p.sacks ?? 0, TFL:p.tfl ?? 0 });

  // Helper function to safely access nested properties
  const safe = (obj, path, defaultValue = null) => {
    try {
      return path.split('.').reduce((current, key) => current && current[key], obj) || defaultValue;
    } catch {
      return defaultValue;
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white text-[12px] text-gray-900 p-6 print:p-0">
      {/* Print styles */}
      <style jsx>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-bold text-sm">Quickie report</div>
          <div className="text-xs">
            {V.team.name} vs {H.team.name}
          </div>
        </div>
        <div className="text-right text-xs">
          <div>Date: {data.meta.date || '-'}</div>
          <div>Site: {data.meta.site || '-'}</div>
          <div>Stadium: {data.meta.stadium || '-'}</div>
          <div>Attendance: {data.meta.attendance || '-'}</div>
        </div>
      </div>

      {/* Team Totals */}
      <table className="w-full border border-gray-300 mb-3">
        <thead>{teamHeader}</thead>
        <tbody>
          {statRow('Score', `${V.score_total} (by Q: ${V.score_by_q.join('-')})`, H.score_total)}
          {statRow('FIRST DOWNS', V.first_downs, H.first_downs)}
          {statRow('RUSHES-YARDS (NET)', `${V.rush.att}-${V.rush.yds}`, `${H.rush.att}-${H.rush.yds}`)}
          {statRow('PASSING YDS (NET)', V.pass.yds, H.pass.yds)}
          {statRow('Passes Cmp-Att-Int', formatPass(V), formatPass(H))}
          {statRow('TOTAL OFFENSE PLAYS-YARDS', formatToPY(V), formatToPY(H))}
          {statRow('Fumbles-Lost', safe(V,'fumbles.num',0)+'-'+safe(V,'fumbles.lost',0), safe(H,'fumbles.num',0)+'-'+safe(H,'fumbles.lost',0))}
          {statRow('Penalties-Yards', `${V.penalties.num}-${V.penalties.yds}`, `${H.penalties.num}-${H.penalties.yds}`)}
          {statRow('Punts (Number-Avg)', `${V.punts.num}-${(V.punts.avg??0).toFixed?.(1) ?? V.punts.avg}`, `${H.punts.num}-${(H.punts.avg??0).toFixed?.(1) ?? H.punts.avg}`)}
          {statRow('Possession Time', V.possession, H.possession)}
          {statRow('Third-Down Conversions', pct(V.third_down.made, V.third_down.att), pct(H.third_down.made, H.third_down.att))}
          {statRow('Fourth-Down Conversions', pct(V.fourth_down.made, V.fourth_down.att), pct(H.fourth_down.made, H.fourth_down.att))}
          {statRow('Red-Zone Scores-Chances', rz(V), rz(H))}
        </tbody>
      </table>

      {/* Individuals – Visitor */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="font-semibold text-xs mb-1">{V.team.name}</div>
          <RosterTable title="Rushing"   rows={(V.indiv.rush||[]).map(mapRush)} cols={['Name','No.','Gain','Loss','Net','TD','Lg','Avg']} />
          <RosterTable title="Receiving" rows={(V.indiv.recv||[]).map(mapRecv)} cols={['TAR','No.','Yards','YAC','TD','Long']} />
          <RosterTable title="Passing"   rows={(V.indiv.pass||[]).map(mapPass)} cols={['C-A','Yds','TD','Long','Sack']} />
          <RosterTable title="Punting"   rows={(V.indiv.punt||[]).map(mapPunt)} cols={['No.','Yds','Avg','Long','In20','TB']} />
          <RosterTable title="Punt Returns" rows={(V.indiv.pr||[]).map(mapPR)} cols={['No.','Yards','TD','Long']} />
          <RosterTable title="Kick Returns" rows={(V.indiv.kr||[]).map(mapKR)} cols={['No.','Yards','TD','Long']} />
          <RosterTable title="Tackles"     rows={(V.indiv.tackles||[]).map(mapTkls)} cols={['Name','U-A','A','Total','Sacks','TFL']} />
        </div>
        {/* Individuals – Home */}
        <div>
          <div className="font-semibold text-xs mb-1">{H.team.name}</div>
          <RosterTable title="Rushing"   rows={(H.indiv.rush||[]).map(mapRush)} cols={['Name','No.','Gain','Loss','Net','TD','Lg','Avg']} />
          <RosterTable title="Receiving" rows={(H.indiv.recv||[]).map(mapRecv)} cols={['TAR','No.','Yards','YAC','TD','Long']} />
          <RosterTable title="Passing"   rows={(H.indiv.pass||[]).map(mapPass)} cols={['C-A','Yds','TD','Long','Sack']} />
          <RosterTable title="Punting"   rows={(H.indiv.punt||[]).map(mapPunt)} cols={['No.','Yds','Avg','Long','In20','TB']} />
          <RosterTable title="Punt Returns" rows={(H.indiv.pr||[]).map(mapPR)} cols={['No.','Yards','TD','Long']} />
          <RosterTable title="Kick Returns" rows={(H.indiv.kr||[]).map(mapKR)} cols={['No.','Yards','TD','Long']} />
          <RosterTable title="Tackles"     rows={(H.indiv.tackles||[]).map(mapTkls)} cols={['Name','U-A','A','Total','Sacks','TFL']} />
        </div>
      </div>

      {/* Scoring Summary */}
      <div className="mt-4">
        <div className="font-semibold text-xs mb-1">Qtr&nbsp;&nbsp;Time&nbsp;&nbsp;Scoring Play</div>
        <table className="w-full text-xs">
          <tbody>
            {data.scoring.map((s,i)=>(
              <tr key={i} className="border-t">
                <td className="px-2 py-1 w-8">{s.qtr}</td>
                <td className="px-2 py-1 w-16">{s.time ?? ''}</td>
                <td className="px-2 py-1">{s.text}</td>
                <td className="px-2 py-1 text-right">{s.vh ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Print */}
      <div className="mt-4 flex justify-end print:hidden">
        <button onClick={()=>window.print()} className="px-3 py-1 border rounded text-xs hover:bg-gray-50">
          Print / Save PDF
        </button>
      </div>
    </div>
  );
}
