# Football live XML indicators

The basic XML exporter uses optional `flag="Y"` and `review="Y"` attributes on
`downtogo`; inactive indicators are omitted.

The scorer publishes `liveState.penaltyPending` as soon as an operator queues a
penalty (Shift+E) or begins immediate penalty entry. The flag stays active through
penalty entry and its completed draft summary, then clears when the play is
submitted, the queued flag is toggled off, or entry is cancelled. Refreshing the
scorer clears an abandoned draft because unfinished play input is not restored.
Historical play replacement does not announce a new live flag.

An indicator-only update copies the current stored envelope, changing the pending
flag and update time. It adds no play or undo item and preserves scores, statistics,
ball context and drives. The ordinary mirror queue publishes it immediately,
without waiting for the next play. Failed delivery retains the normal retry path.
The Sidearm server queues every accepted mirror revision for basic XML delivery.

`liveState.reviewActive` follows accepted challenge events. Initiation activates
it. Call Confirmed, Call Stands, Call Overturned, Successful and Unsuccessful
resolve the matching team/target review. An overturned result clears the review
indicator even while the separate rescore workflow is pending. Rebuilding from
saved events handles refresh, edited/deleted outcomes and undo; historical copies
and deleted events do not activate it. Final games have no active review. Opening
Review Plays or the play editor does not initiate a challenge.

Flag and review states are independent: clearing a flag does not clear a pending
challenge. Validation covers the scorer UI, local storage, mirror revisions, real
basic XML output and the durable Sidearm queue with FTP transfer captured locally.
