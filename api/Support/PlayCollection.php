<?php

namespace Strata\Football\Api\Support;

use Strata\Football\Api\Support\Schema\PlaySchema;

/**
 * Utility wrapper that exposes convenience methods for iterating and querying
 * the ordered play array within a game envelope.
 */
class PlayCollection
{
    /** @var array<int, array<string, mixed>> */
    private array $plays;

    /**
     * @param array<int, array<string, mixed>> $plays
     */
    public function __construct(array $plays)
    {
        $this->plays = array_map(static fn ($play) => PlaySchema::normalize($play), $plays);
    }

    public function all(): array
    {
        return $this->plays;
    }

    public function last(): ?array
    {
        if (empty($this->plays)) {
            return null;
        }

        return $this->plays[array_key_last($this->plays)] ?? null;
    }

    public function findById(string $playId): ?array
    {
        foreach ($this->plays as $play) {
            if (($play['playId'] ?? null) === $playId) {
                return $play;
            }
        }

        return null;
    }

    public function indexOf(string $playId): ?int
    {
        foreach ($this->plays as $index => $play) {
            if (($play['playId'] ?? null) === $playId) {
                return $index;
            }
        }

        return null;
    }

    public function count(): int
    {
        return count($this->plays);
    }

    /**
     * Return an ordered list of drive descriptors keyed by driveNumber.
     * Each descriptor captures start/end metadata derived from drive control
     * events embedded in the play log (driveStart / driveEnd / kickoff rules).
     */
    public function driveSegments(): array
    {
        $segments = [];
        $current = null;

        foreach ($this->plays as $index => $play) {
            foreach (PlaySchema::events($play) as $event) {
                if (PlaySchema::isDriveStart($event)) {
                    $driveNumber = $event['driveStart']['driveNumber'] ?? null;
                    if ($driveNumber === null) {
                        continue;
                    }

                    $current = [
                        'driveNumber' => (int) $driveNumber,
                        'startIndex' => $index,
                        'startContext' => $play['context'] ?? null,
                        'startMeta' => $event['driveStart'],
                        'endIndex' => null,
                        'endMeta' => null
                    ];

                    $segments[(int) $driveNumber] = $current;
                }

                if (PlaySchema::isDriveEnd($event) && $current !== null) {
                    $driveNumber = $current['driveNumber'];
                    $segments[$driveNumber]['endIndex'] = $index;
                    $segments[$driveNumber]['endMeta'] = $event['driveEnd'];
                    $current = null;
                }
            }
        }

        return $segments;
    }
}
