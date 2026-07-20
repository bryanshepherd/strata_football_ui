<?php

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

$config = require __DIR__ . '/config.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'Strata\\Football\\Api\\';
    $prefixLength = strlen($prefix);

    if (strncmp($class, $prefix, $prefixLength) !== 0) {
        return;
    }

    $relative = substr($class, $prefixLength);
    $path = __DIR__ . '/' . str_replace('\\', '/', $relative) . '.php';

    if (is_file($path)) {
        require $path;
    }
});

return $config;
