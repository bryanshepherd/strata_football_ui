<?php

namespace Strata\Football\Api\Services;

use RuntimeException;
use Strata\Football\Api\Repositories\GameRepository;
use Strata\Football\Api\Support\GameEnvelope;
use Strata\Football\Api\Support\LiveControllerResolver;
use Strata\Football\Api\Support\PlayCollection;

class GameStateService
{
    private GameRepository $games;

    public function __construct(GameRepository $games)
    {
        $this->games = $games;
    }

    /**
     * Return the canonical game envelope defined in DATA_STRUCTURE_REWRITE_NOTES.md.
     */
    public function getGameEnvelope(string $gameId): array
    {
        $payload = $this->games->find($gameId);

        return GameEnvelope::fromArray($payload)->toArray();
    }

    /**
     * Convenience wrapper that extracts venue and liveController for quick status calls.
     */
    public function getLiveSnapshot(string $gameId): array
    {
        $game = $this->getGameEnvelope($gameId);
        $envelope = GameEnvelope::fromGame($game);
        $plays = new PlayCollection($envelope->plays());

        return [
            'venue' => $envelope->venue(),
            'liveController' => LiveControllerResolver::resolve($envelope),
            'plays' => $plays->all(),
            'driveSegments' => $plays->driveSegments()
        ];
    }
}
