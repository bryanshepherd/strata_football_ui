<?php

declare(strict_types=1);

return [
    'paths' => [
        // Root directory for canonical JSON game envelopes (see DATA_STRUCTURE_REWRITE_NOTES.md)
        'games' => dirname(__DIR__) . '/storage/games',
        'schema' => [
            'game' => dirname(__DIR__) . '/schema/game.schema.json'
        ]
    ],
    'http' => [
        'default_headers' => [
            'Content-Type' => 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin' => '*'
        ]
    ]
];
