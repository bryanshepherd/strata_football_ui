<?php

declare(strict_types=1);

use Strata\Football\Api\Http\Response;
use Strata\Football\Api\Repositories\GameRepository;
use Strata\Football\Api\Services\GameStateService;
use Strata\Football\Api\Support\Schema\GameSchemaValidator;
use Throwable;

$config = require __DIR__ . '/../bootstrap.php';

$gameId = $_GET['gameId'] ?? $_GET['game_id'] ?? null;

if (!is_string($gameId) || $gameId === '') {
    Response::json(['success' => false, 'error' => 'Missing gameId parameter'], 400, $config['http']['default_headers']);
    return;
}

$schemaValidator = GameSchemaValidator::fromFile($config['paths']['schema']['game']);
$repository = new GameRepository($config['paths']['games'], $schemaValidator);
$service = new GameStateService($repository);

try {
    $envelope = $service->getGameEnvelope($gameId);

    Response::json([
        'success' => true,
        'game' => $envelope
    ], 200, $config['http']['default_headers']);
} catch (Throwable $exception) {
    Response::json([
        'success' => false,
        'error' => $exception->getMessage()
    ], 404, $config['http']['default_headers']);
}
