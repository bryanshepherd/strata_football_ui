<?php

namespace Strata\Football\Api\Http;

class Response
{
    /**
     * Emit a JSON response with optional status code and headers.
     */
    public static function json(array $payload, int $status = 200, array $headers = []): void
    {
        http_response_code($status);

        foreach ($headers as $name => $value) {
            header($name . ': ' . $value);
        }

        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
