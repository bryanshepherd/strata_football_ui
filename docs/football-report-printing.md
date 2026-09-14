# Football report printing

Report pages use the matchup and selected report label as the document title:
`Away Team vs. Home Team - Report Packet`, or the corresponding individual report
name. This gives Print / Save PDF a useful default filename. The shared loader
uses the loaded game's team names and restores the prior title when it unmounts.
A pending or failed selected-game request never uses sample team names.

All reports share one unnamed Letter page rule. Physical margins are 0.32 inches
at the top, 0.34 on each side and 0.18 at the bottom. Each printed report fragment
also reserves 0.44 inches of bottom padding for the footer, giving report content
at least 0.62 inches of bottom clearance. The padding is cloned at page breaks.
Screen-only page sizes and padding do not carry into print layout.

The packet uses normal block flow and explicit breaks between reports, rather
than a single fragmented presentation table with named page rules. Firefox could
lose those named margins after the first sections, leaving later reports and
continuations flush against the PDF edges. A single footer repeats on printed
pages; standalone multi-page reports likewise print only one fixed brand.

Validation should save actual PDFs from Firefox and Chromium, including a long
play-by-play quarter that continues onto another page. Check page bounds, footer
clearance, report order, complete text and document titles for the packet and the
individual reports. CSS screen previews alone did not expose the original bug.
