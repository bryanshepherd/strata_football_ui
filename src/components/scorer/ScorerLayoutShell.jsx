import React from 'react';
import PropTypes from 'prop-types';

const slotPropType = PropTypes.node.isRequired;

export default function ScorerLayoutShell({
  scoreboard,
  stats,
  input,
  eventLog,
  inputAssistant,
  className = '',
}) {
  return (
    <section
      aria-label="Scorer layout"
      className={`flex min-h-0 flex-1 flex-col ${className}`.trim()}
      data-testid="scorer-layout-shell"
    >
      <div className="shrink-0" data-scorer-slot="scoreboard">
        {scoreboard}
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col lg:flex-row"
        data-testid="scorer-layout-middle"
      >
        <aside
          className="min-h-0 w-full overflow-y-auto border-b border-zinc-300 bg-zinc-100 lg:w-1/5 lg:border-b-0 lg:border-r"
          data-scorer-slot="stats"
        >
          {stats}
        </aside>

        <section
          className="min-h-0 w-full overflow-y-auto bg-zinc-100 lg:w-[65%]"
          data-scorer-slot="input"
        >
          {input}
        </section>

        <aside
          className="min-h-0 w-full overflow-y-auto border-t border-zinc-300 bg-zinc-100 lg:w-[15%] lg:border-l lg:border-t-0"
          data-scorer-slot="event-log"
        >
          {eventLog}
        </aside>
      </div>

      <div className="shrink-0" data-scorer-slot="input-assistant">
        {inputAssistant}
      </div>
    </section>
  );
}

ScorerLayoutShell.propTypes = {
  scoreboard: slotPropType,
  stats: slotPropType,
  input: slotPropType,
  eventLog: slotPropType,
  inputAssistant: slotPropType,
  className: PropTypes.string,
};
