<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (is_string($path) && str_starts_with($path, '/api/')) {
    require __DIR__ . '/api/index.php';
    exit;
}

$requestedFile = __DIR__ . DIRECTORY_SEPARATOR . ltrim((string) $path, '/\\');
if ($path !== '/' && is_file($requestedFile)) {
    return false;
}

if ($path === '/') {
    readfile(__DIR__ . '/index.html');
    return true;
}

http_response_code(404);
echo 'Not Found';
