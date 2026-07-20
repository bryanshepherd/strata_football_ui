
# Claude Task: Implement Continued Plays + COP-aware Penalties

## Goal
- Model laterals/multi-exchange plays as **continued chains** of `plays` rows.
- Penalties carry a **PenaltyPhase**: `PRE_COP` (negates whole chain) or `POST_COP` (affects return only).
- UI prompts user to choose phase **only when** there is a change of possession and penalty is Accepted or Offsetting.

---

## 1) Apply DB Migration (MySQL 8)
File: `migration_plays_laterals_penalty_phase.sql`
- Drop obsolete Fumble2/3 columns (provided list).
- Add `IsContinued`, `ContinuedFrom`, `ContinuedTo`, `RootPlayID` on `plays` (+FKs/indexes).
- Add `RootPlayID`, `PenaltyPhase` on `penalties` (+FK/index).
- Create `v_play_chains` view for rollups.

---

## 2) Backend — submit_play_enhanced.php
- **Creating segments:**
  - Insert first segment; then update it with `RootPlayID = PlayID`.
  - For each subsequent segment:
    - Insert with `ContinuedFrom = prevPlayId`, `RootPlayID = firstPlayId`.
    - Update previous segment’s `ContinuedTo = newPlayId`.
  - Keep `PreDown/PreDistance` the same for all segments in the chain.
  - Only the **final** segment sets `PostDown/PostDistance` and updates `game_state`.

- **Penalties:**
  - Accept FE payload field `phase: 'PRE_COP'|'POST_COP'|null`.
  - When inserting into `penalties`:
    - Copy `RootPlayID` from the segment `plays` row.
    - Persist `PenaltyPhase` if not null.
  - **Enforcement:**
    - If Accepted/Offsetting and `phase='PRE_COP'` ⇒ treat as chain-level negation (replay-as-needed).
    - If `phase='POST_COP'` ⇒ enforce on return only; do not negate earlier segments.

- **Drive penalties endpoint (optional):**
  - Extend `get_drive_penalties.php` to also return split totals:
    ```json
    { "success": true, "penalties": {
        "total": { "count": 3, "yards": 25 },
        "pre_cop": { "count": 2, "yards": 15 },
        "post_cop": { "count": 1, "yards": 10 }
      } }
    ```

---

## 3) Frontend — Penalty Modal
- **Show “Penalty Timing” dropdown** **iff** a COP occurs AND (Accepted OR Offsetting) AND NOT Declined.
- Dropdown values: `PRE_COP` (negates chain) / `POST_COP` (return only).
- Focus the dropdown when it appears; Enter submits only if all required fields are filled.
- Include `phase` in POST payload to backend.

---

## 4) Frontend — Play Log & Drive Chips
- Play Log: collapse segments that share the same `RootPlayID` (optional). Display per-segment on expand.
- Drive Chips: no change besides penalties; read totals from API. If split is returned, show on hover.

---

## 5) Tests
- Create a multi-segment play (two laterals). Ensure chain links (Root/From/To) are correct.
- Add accepted **PRE_COP** penalty to first segment ⇒ chain negated.
- Add accepted **POST_COP** penalty to last segment ⇒ no negation; enforcement on return only.
- Ensure drive totals and team stats aggregate as expected (use `v_play_chains` if needed).
