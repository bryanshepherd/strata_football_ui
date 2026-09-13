# Football actor edits

The play editor saves one selection to all stored references for that role before regenerating the play description and confirmation. Punter and kicker aliases stay aligned with the primary actor; receiver/target, return, interception, fumble and blocker references stay aligned with their corresponding participant and result fields. Clearing an optional actor clears its aliases. Separate lateral and unrelated player roles are preserved.

Older editor saves can have a new participant with roster display details alongside a conflicting original ID-only participant. The load/report repair recognizes that explicit edit, aligns the references and regenerates only the affected play's description. Ambiguous conflicts between two named actors are left intact for operator selection. The repair is idempotent and does not mutate its input. Scores, yardage, penalties, event identity, clocks and ball context stay unchanged.

Scorer normalization applies the repair before rebuilding player statistics. Report loading and the play-by-play builder apply it to existing saved games, including read-only server reports. An open scorer must be refreshed to load the new editor. Corrected local data is persisted and mirrored through the normal scorer workflow.

The dashboard XML exporter uses the same pure repair and summary grammar, bundled from this source with:

```sh
node scripts/build-football-actor-repair.mjs /path/to/StrataSportsSuite/apps/dashboard/src/services/xml/builders/footballEditedActorRepair.mjs
```

Regenerate that bundle when changing the repair or its summary grammar. The server repairs its XML projection without modifying the authoritative saved envelope. Validate both scorer actor/PBP tests and dashboard XML/schema tests before release.
