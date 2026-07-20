<?php

namespace Strata\Football\Api\Support\Schema;

final class GameEnvelopeSchema
{
    public const CANONICAL_ORDER = [
        'venue',
        'liveController',
        'officials',
        'rules',
        'plays'
    ];

    public static function canonicalize(array $game): array
    {
        $ordered = [];

        foreach (self::CANONICAL_ORDER as $key) {
            if (array_key_exists($key, $game)) {
                $ordered[$key] = $game[$key];
            }
        }

        foreach ($game as $key => $value) {
            if (!array_key_exists($key, $ordered)) {
                $ordered[$key] = $value;
            }
        }

        return $ordered;
    }
}
