# Football Operator Team Aliases

## Purpose

Football Confirmed Quick Input should eventually accept operator-friendly team identifiers while preserving canonical internal team codes.

Internal persisted team values remain:

```ts
type TeamCode = 'H' | 'V';
```

The alias layer is an input and display convenience only. FCQI may accept friendly aliases such as team abbreviations, first-letter shortcuts, or custom scorer-defined prefixes, but `FootballDraftIntent`, FPSG, the Event Builder, projection, stats, envelopes, and backend contracts must continue to store canonical `H` / `V`.

## Problem

Operators should not need to think in canonical home/visitor codes during live entry. If the home team is State and the visitor team is Tech, an operator may naturally enter:

```text
S32
T12
```

The alias layer should normalize those values before data reaches FCQI's canonical draft intent:

```text
S32 -> H32
T12 -> V12
```

This concept is not limited to yardlines. It should apply anywhere the operator enters or chooses a team identifier.

## Scope

Operator aliases should be accepted for:

- yardlines and field-position spots
- penalty team
- fumble recovery team
- kickoff receiving team
- punt receiving team
- possession changes
- coin toss winner and choice
- timeout team
- challenge team
- game control
- correction and edit flows
- future FCQI prompts that collect team identity

## Core Rule

UI accepts friendly aliases. Engines store canonical values.

Canonical persisted values remain:

- `H`
- `V`
- canonical spots such as `H32`, `V12`, `50`, or other schema-approved spot values

The alias layer must normalize operator input before `FootballDraftIntent` is considered structurally valid.

## Suggested Model

```ts
type TeamAliasConfig = {
  H: {
    canonical: 'H';
    displayName: string;
    displayAbbr: string;
    operatorAliases: string[];
    spotPrefix: string;
  };
  V: {
    canonical: 'V';
    displayName: string;
    displayAbbr: string;
    operatorAliases: string[];
    spotPrefix: string;
  };
};
```

Example:

```ts
const aliases: TeamAliasConfig = {
  H: {
    canonical: 'H',
    displayName: 'State',
    displayAbbr: 'STATE',
    operatorAliases: ['H', 'HOME', 'STATE', 'S'],
    spotPrefix: 'S',
  },
  V: {
    canonical: 'V',
    displayName: 'Tech',
    displayAbbr: 'TECH',
    operatorAliases: ['V', 'VIS', 'AWAY', 'TECH', 'T'],
    spotPrefix: 'T',
  },
};
```

## Helper Boundaries

Future implementation should keep alias handling in shared helpers instead of embedding it separately in every modal.

Recommended helper boundaries:

```ts
parseOperatorTeam(input: string, aliasConfig: TeamAliasConfig): 'H' | 'V';
formatTeamForOperator(teamCode: TeamCode, aliasConfig: TeamAliasConfig): string;
parseOperatorSpot(input: string, aliasConfig: TeamAliasConfig): Spot;
formatSpotForOperator(spot: Spot, aliasConfig: TeamAliasConfig): string;
normalizeOperatorTeamToken(input: string, aliasConfig: TeamAliasConfig): TeamCode;
```

Conceptual examples:

```ts
parseOperatorTeam('S', aliases)      // 'H'
parseOperatorTeam('STATE', aliases)  // 'H'
parseOperatorTeam('T', aliases)      // 'V'
parseOperatorTeam('TECH', aliases)   // 'V'

parseOperatorSpot('S32', aliases)    // 'H32'
parseOperatorSpot('T12', aliases)    // 'V12'

formatSpotForOperator('H32', aliases) // 'S32'
formatSpotForOperator('V12', aliases) // 'T12'
```

## Validation Rules

- Aliases are case-insensitive.
- Aliases trim surrounding whitespace.
- Empty aliases are invalid.
- Ambiguous aliases are invalid.
- If both teams share the same first letter, FCQI must not auto-pick that first letter.
- Operator can override `spotPrefix` if generated prefixes conflict.
- `H` and `V` should remain accepted fallback aliases unless a later explicit configuration disables them.
- Persisted draft intent must store canonical `H` / `V`, not the operator alias.
- Persisted spots must store canonical spot strings, not operator spot prefixes.
- The alias layer must fail clearly when a token cannot be resolved.
- Alias resolution must happen before FPSG or the Event Builder reads the draft.

## Source Metadata

Canonical fields should remain canonical, but FCQI may preserve optional source metadata for traceability:

```ts
type OperatorTeamAliasResolution = {
  rawInput: string;
  aliasUsed: string;
  resolvedTeam: TeamCode;
  inputScope:
    | 'spot'
    | 'penalty.team'
    | 'fumble.recoveryTeam'
    | 'kick.receiveTeam'
    | 'punt.receiveTeam'
    | 'possession'
    | 'gameControl'
    | 'correction';
};
```

This metadata is optional and should not be required by FPSG or the Event Builder unless a future contract explicitly adopts it.

## UI Guidance

Future setup UI should allow scorers or administrators to edit:

- display abbreviation
- operator aliases
- yardline/spot prefix

Default aliases can be generated from:

- canonical `H` / `V`
- `HOME` / `VISITOR`
- `HOME` / `AWAY`
- team display abbreviation
- first letter of the team abbreviation when not ambiguous

When an alias conflict exists, UI should require an explicit override rather than choosing one team silently.

## FCQI Integration Guidance

FCQI should apply alias normalization at input boundaries:

- before validating field-position spots
- before storing `penalty.team`
- before storing recovery team fields
- before storing possession or receiving-team changes
- before building `FootballDraftIntent`

Modal prompts may display operator aliases, but the pure FCQI machine should work with canonical normalized values once the token is committed.

## Event Builder Boundary

The Event Builder should receive canonical team codes and canonical spots. It should not parse operator aliases.

If alias source metadata is present, the Event Builder may copy it to source/debug metadata only if the canonical envelope contract supports it. It must not reinterpret operator aliases as authoritative team codes.

## Non-Goals

- Do not replace `TeamCode = 'H' | 'V'`.
- Do not persist operator aliases as canonical team values.
- Do not require FPSG or Event Builder to parse aliases.
- Do not infer ambiguous aliases.
- Do not change envelope, projection, stats, or backend team-code contracts.
