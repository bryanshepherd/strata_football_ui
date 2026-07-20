<?php

namespace Strata\Football\Api\Support\Schema;

use RuntimeException;

final class PlaySchema
{
    public static function normalize(array $play): array
    {
        if (!isset($play['playId'])) {
            throw new RuntimeException('Play missing required "playId"');
        }

        $play['events'] = self::events($play);

        return $play;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function events(array $play): array
    {
        $events = $play['events'] ?? [];

        return is_array($events) ? $events : [];
    }

    public static function isDriveStart(array $event): bool
    {
        return isset($event['driveStart']) && is_array($event['driveStart']);
    }

    public static function isDriveEnd(array $event): bool
    {
        return isset($event['driveEnd']) && is_array($event['driveEnd']);
    }

    public static function isGameControl(array $event, string $type): bool
    {
        $payload = $event['gameControl'] ?? null;

        if (!is_array($payload)) {
            return false;
        }

        return ($payload['type'] ?? null) === $type;
    }

    public static function sequenceKey(array $play): ?string
    {
        $key = $play['sequenceKey'] ?? null;

        return is_string($key) ? $key : null;
    }
}
