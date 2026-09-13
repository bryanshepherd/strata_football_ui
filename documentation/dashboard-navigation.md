# Returning from the scorer to the football dashboard

The scorer header used a React Router Link to `/sports/football`. That URL belongs to the Suite dashboard, not the scorer SPA. Client-side navigation kept the scorer mounted, removed its game query parameters and matched the scorer fallback route, displaying Visitor Tech at Home State. When embedded, navigation also needed to leave the iframe.

Both Dashboard in the header and Open dashboard on loading/error screens now use native document links with `target="_top"`. Production builds always return to `/sports/football`, including a fixture shown after the old link lost game context. The local development fixture can still return to its local `/dashboard` page. Game data and scoring behavior are unchanged.

Validation: 89 scorer test files / 1,230 tests pass. Production build passes. Browser checks against the built scorer confirm top-level dashboard navigation from a saved game both standalone and embedded, from the accidental fixture view, and from a game-load error. The selected game snapshot is mirror revision 259; browser testing uses a local dashboard destination and does not modify the server game.
