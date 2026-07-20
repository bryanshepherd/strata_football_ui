<?php

namespace Strata\Football\Api\Repositories;

use RuntimeException;
use Strata\Football\Api\Support\Schema\SchemaValidatorInterface;

class GameRepository
{
    private string $storagePath;
    private SchemaValidatorInterface $validator;

    public function __construct(string $storagePath, SchemaValidatorInterface $validator)
    {
        $this->storagePath = rtrim($storagePath, '/');
        $this->validator = $validator;
    }

    public function exists(string $gameId): bool
    {
        return is_file($this->buildPath($gameId));
    }

    public function find(string $gameId): array
    {
        $path = $this->buildPath($gameId);

        if (!is_file($path)) {
            throw new RuntimeException('Game not found: ' . $gameId);
        }

        $contents = file_get_contents($path);

        if ($contents === false) {
            throw new RuntimeException('Unable to read game file: ' . $gameId);
        }

        $decoded = json_decode($contents, true);

        if (!is_array($decoded)) {
            throw new RuntimeException('Invalid JSON payload for game: ' . $gameId);
        }

        $this->validator->validate($decoded, $gameId);

        return $decoded;
    }

    private function buildPath(string $gameId): string
    {
        return $this->storagePath . '/' . $gameId . '.json';
    }
}
