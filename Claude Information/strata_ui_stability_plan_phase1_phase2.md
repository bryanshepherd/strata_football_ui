
# Strata Football UI — Stability & Completeness Plan (Phase 1 + Phase 2)

**Repo root:** `strata-football-ui-new/`  
**Scope:** Frontend (`src/`) only. Do not change backend PHP in this pass.  
**Goal:** Eliminate data-contract drift, centralize validation, complete critical TODOs, improve crash visibility, standardize API handling, and add minimal tests to lock behavior. Extend with drive rules, penalties, concurrency, and performance.

---

## 0) Global Success Criteria

- All camelCase⇄snake_case, enum, and format transforms live in **one** place: `src/utils/apiDataContract.ts` (+ tests).
- Yardline, jersey, and time validations are **centralized** and reused everywhere.
- Touchdown → automatic possession change works (flows + hotkey handler).
- “Play replacement” action implemented (minimal viable; no UI redesign).
- React error boundary is added; no silent UI crashes.
- API responses normalized to a consistent shape in the client adapter.
- Minimal **Vitest** tests exist for: transformations, yardline validation, and possession flip logic.
- Drive start/end rules, penalty arrays, and clock behavior are clarified & implemented.
- Optional multi-user safety (UI lock awareness) and Play Log performance improvements.

> If information is missing, annotate code with `// TODO(contracts): clarify <thing>` and add line-referenced notes in `documentation/12-Open-Questions.md` to keep docs in sync.

---

## Phase 1 — Contract Hardening & Stabilization (Do these first)

### 1) Centralized Validation
**Add:** `src/utils/validation.js`
```javascript
export const validateYardLine = (value) => /^(H|V)\d{2}$|^50$/.test(value);
export const normalizeYardLine = (value) => {
  if (value === '50') return '50';
  const team = value[0]?.toUpperCase();
  const num = String(parseInt(value.slice(1), 10)).padStart(2, '0');
  return (team === 'H' || team === 'V') ? `${team}${num}` : value;
};
export const validateJerseyNumber = (num) => /^\d{1,2}$/.test(String(num));
export const validateClock = (str) => /^\d{1,2}:\d{2}$/.test(str);
```
- Replace scattered validation with these utilities.
- Enforce 3-character yardline (`H25`, `V03`) or `50`. Use `normalizeYardLine` on input change and before submit.

### 2) Contract Transform Layer
**File:** `src/utils/apiDataContract.ts`  
Task: Make this the *only* place that converts FE⇄BE.

**Mappings to cover (both directions):**
- `quarter` ⇄ `period`
- `clock` `"MM:SS"` ⇄ `time_remaining` (seconds int)
- `yardsToGo` ⇄ `distance`
- `yardsGained` ⇄ `yards` (and/or `net_yards` if the backend expects that explicitly)
- `possession` `"home"|"visitor"` ⇄ `'H'|'V'`
- `primaryPlayerID` ⇄ `primary_player_id`
- `postDown` / `postDistance` / `postYardLine` ⇄ `post_down` / `post_distance` / `post_yard_line`
- Emit/consume backend flags: `is_touchdown`, `is_first_down`, `is_turnover`, `has_fumble`, `is_safety`, `is_kickoff`

**Add tests:** `tests/contract.transform.test.ts`
- FE play → BE payload (assert exact field names & values).
- BE payload → FE state (assert exact field names & values).
- Clock conversions both ways.
- Possession `"home"/"visitor"` ↔ `'H'/'V'` both ways.

### 3) Hotkey / Flow Logic
- **File:** `src/components/FootballHotkeyHandler.jsx`
  - Implement touchdown detection → dispatch possession flip.
  - Debounce/guard submit to avoid duplicate sends.
- **File:** `src/App.jsx` (around the noted TODO)
  - Implement `handlePlayReplace(playNumber)` minimally:
    - Open `PlayEditModal` for target play.
    - Overwrite play data and resubmit via existing API.
    - Refresh local state after server confirms.

### 4) Error Boundaries
**Add:** `src/components/GlobalErrorBoundary.jsx`
```jsx
import React from 'react';
export default class GlobalErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state = { hasError:false, error:null, info:null }; }
  static getDerivedStateFromError(e){ return { hasError:true, error:e }; }
  componentDidCatch(e, info){ this.setState({ info }); console.error('[ErrorBoundary]', e, info); }
  render(){
    return this.state.hasError
      ? <div style={{padding:16, background:'#fee'}}><h3>App crashed</h3><pre>{String(this.state.error)}</pre></div>
      : this.props.children;
  }
}
```
- Wrap `<App />` in `main.jsx` with `<GlobalErrorBoundary>`.

### 5) Cleanup
- Remove stray `console.log` in production paths (especially legacy flows).
- Convert necessary debugging to a `debug` util with level gating.

### 6) Minimal Testing Setup
- Add **Vitest** + **@testing-library/react**.
- **Example test:** `tests/validation.test.ts`
```ts
import { validateYardLine, normalizeYardLine } from '../src/utils/validation';
import { expect, test } from 'vitest';

test('yardline validation & normalization', () => {
  expect(validateYardLine('H25')).toBe(true);
  expect(validateYardLine('V03')).toBe(true);
  expect(validateYardLine('50')).toBe(true);
  expect(validateYardLine('H5')).toBe(false);
  expect(normalizeYardLine('h5')).toBe('H05');
  expect(normalizeYardLine('V7')).toBe('V07');
});
```

**Deliverables (Phase 1)**
- `src/utils/validation.js`
- Updated `src/utils/apiDataContract.ts` + tests
- `src/components/GlobalErrorBoundary.jsx` + wired in `main.jsx`
- Implemented TODOs in `App.jsx` and `FootballHotkeyHandler.jsx`
- Removed/replaced stray console logs
- Basic Vitest tests passing

---

## Phase 2 — Completeness: Rules, API Shape, Concurrency, Performance

### 7) Standardize API Response Handling
**Add:** `src/utils/apiClient.js`
```javascript
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  // Normalize to a common shape
  if (typeof body === 'object' && body && 'success' in body) {
    if (!body.success) throw new Error(body.error || 'Unknown API error');
    return body.data ?? null;
  }
  // Fallback: wrap raw responses
  if (res.ok && typeof body === 'object') return body;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return body;
}
```
- Replace raw `fetch` with `apiFetch` usage across the app.
- Ensure all endpoints are consumed consistently; wrap diverse backend responses.

### 8) Drive Rules & Invariants
- Implement a shared function: `src/utils/driveRules.js`
```javascript
export function shouldStartNewDrive(prevState, play) {
  // start on possession change or kickoffs
  return play.is_turnover || play.is_kickoff || play.possession_changed === true;
}
export function shouldEndDrive(play) {
  // end on score or punts/turnovers
  return play.is_touchdown || play.is_safety || play.is_turnover || play.play_type === 'punt';
}
```
- Wire these into the reducer or post-submit reconciliation step.
- Clarify in code comments how penalties-only plays and onside kicks affect drives (document assumptions).

### 9) Penalties — Multiple & Precedence
- Update flows and data structures to allow **array** of penalties per play:
  - `play.penalties = [{ team:'H'|'V', code:'HO', accepted:true, yards:10, spot:'H45', ... }, ...]`
- Modal should support multiple entries; accepted/declined, offset logic.
- Submit arrays to backend in a consistent shape (transform in `apiDataContract.ts`).

### 10) Clock Behavior (Explicit Policy)
Pick one of two routes and implement clearly:
1. **Manual-only clock**: Keep manual control; add UI guards/hints where clock should stop (incomplete, OOB, first down).  
2. **Semi-automatic**: Implement minimal logic to auto-stop on I/OOB/TD and prompt confirmation.

- Add a `ClockPolicy` enum in config and branch behavior accordingly.
- Document policy in code and `documentation/07-Error-Handling-and-Edge-Cases.md`.

### 11) Multi-User Safety (Lightweight)
- If backend supports `LockedBy/LockedAt`, surface lock status in UI header:
  - Show “Locked by {user}” and disable submit if not owner.
  - Poll lock status every 15–30s and warn if lost.
- Otherwise, **warn single-user only** in the UI until real locking lands.

### 12) Play Log Performance
- Virtualize or paginate when plays exceed N (e.g., 75):
  - Use windowing (e.g., simple manual windowing or `react-window`).
  - Provide “Load more” older plays.
- Memoize expensive rows (e.g., `PlayDescription`, `PlayerName`) and selectors.

### 13) Tests — Add a Few More High-Value Cases
- `tests/drive.rules.test.ts`: start/end drive transitions on kickoff, turnover, score, punt.
- `tests/penalty.array.test.ts`: multiple penalties accepted/offset/declined transforms.
- `tests/api.response.test.ts`: various backend response shapes -> normalized client shape.

**Deliverables (Phase 2)**
- `src/utils/apiClient.js` (and app-wide migration to use it)
- `src/utils/driveRules.js` wired into state updates
- Penalty arrays supported in UI flows and transformation layer
- Clock policy chosen and implemented (manual-only w/ hints, or semi-automatic)
- UI lock awareness (or clear single-user warning)
- Virtualized/paginated Play Log for large games
- Additional Vitest tests passing

---

## Notes for the Implementer (Claude)
- Prefer **surgical edits**; avoid broad refactors.
- When unsure, add a `// TODO(contracts): ...` comment + note in `documentation/12-Open-Questions.md` with file+line.
- Keep diagrams/docs updated only if quick; prioritize functioning code and tests.
- After each cluster of changes, run Vitest and dev server to verify no regressions.

---

## Acceptance Checklist
- [ ] Validation util created and used everywhere (yardline/jersey/clock)
- [ ] `apiDataContract.ts` covers all FE⇄BE mappings + tests green
- [ ] TD triggers possession flip; play replacement implemented
- [ ] Error boundary in place; no silent crashes
- [ ] API responses normalized via `apiClient.js`
- [ ] Drive rules implemented and invoked
- [ ] Penalty arrays supported with precedence handling
- [ ] Clock policy implemented & documented
- [ ] Multi-user lock surfaced or single-user warning added
- [ ] Play Log virtualized/paginated beyond threshold
- [ ] Vitest suite: contracts, validation, drive rules, penalties, api client — all passing
