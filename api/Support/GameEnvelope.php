<?php

namespace Strata\Football\Api\Support;

use RuntimeException;
use Strata\Football\Api\Support\Schema\GameEnvelopeSchema;

/**
 * Typed facade around the canonical `game { ... }` envelope defined in
 * DATA_STRUCTURE_REWRITE_NOTES.md. Provides safe accessors and helpers for
 * common substructures (venue, officials, rules, plays, etc.).
 */
class GameEnvelope
{
    private array $envelope;

    private function __construct(array $envelope)
    {
        $this->envelope = $envelope;
    }

    public static function fromArray(array $payload): self
    {
        if (!isset($payload['game']) || !is_array($payload['game'])) {
            throw new RuntimeException('Malformed payload: missing "game" root');
        }

        return new self($payload['game']);
    }

    public static function fromGame(array $game): self
    {
        return new self($game);
    }

    public function toArray(): array
    {
        return GameEnvelopeSchema::canonicalize($this->envelope);
    }

    public function venue(): array
    {
        return $this->envelope['venue'] ?? [];
    }

    public function liveController(): array
    {
        return $this->envelope['liveController'] ?? [];
    }

    public function officials(): array
    {
        return $this->envelope['officials'] ?? [];
    }

    public function rules(): array
    {
        return $this->envelope['rules'] ?? [];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function plays(): array
    {
        $plays = $this->envelope['plays'] ?? [];

        return is_array($plays) ? $plays : [];
    }

    public function withPlays(array $plays): self
    {
        $clone = $this->envelope;
        $clone['plays'] = array_values($plays);

        return new self($clone);
    }

    public function withLiveController(array $controller): self
    {
        $clone = $this->envelope;
        $clone['liveController'] = $controller;

        return new self($clone);
    }
}
