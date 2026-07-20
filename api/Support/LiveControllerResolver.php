<?php

namespace Strata\Football\Api\Support;

class LiveControllerResolver
{
    /**
     * Attempt to produce a synthesized liveController snapshot when the source
     * envelope has missing or stale values. Falls back to the existing payload
     * when derivation is not possible.
     */
    public static function resolve(GameEnvelope $envelope): array
    {
        $controller = $envelope->liveController();

        if (!empty($controller)) {
            return $controller;
        }

        $plays = new PlayCollection($envelope->plays());
        $lastPlay = $plays->last();

        if ($lastPlay === null) {
            return [];
        }

        $newContext = $lastPlay['newContext'] ?? [];

        return [
            'hasball' => $newContext['hasBall'] ?? null,
            'id' => $newContext['hasBall'] === 'H' ? $envelope->venue()['homeId'] ?? null : $envelope->venue()['visId'] ?? null,
            'down' => $newContext['down'] ?? null,
            'togo' => $newContext['toGo'] ?? null,
            'spot' => $newContext['spot'] ?? null,
            'context' => self::buildContextString($newContext),
            'qtr' => $newContext['qtr'] ?? null,
            'clock' => $newContext['clock'] ?? null,
            'vtoh' => $controller['vtoh'] ?? null,
            'htoh' => $controller['htoh'] ?? null,
            'lastplay' => $lastPlay['playId'] ?? null,
            'status' => 'active'
        ];
    }

    private static function buildContextString(array $context): ?string
    {
        $hasBall = $context['hasBall'] ?? null;
        $down = $context['down'] ?? null;
        $toGo = $context['toGo'] ?? null;
        $spot = $context['spot'] ?? null;

        if ($hasBall === null || $down === null || $toGo === null || $spot === null) {
            return null;
        }

        return sprintf('%s,%s,%s,%s', $hasBall, $down, $toGo, $spot);
    }
}
