<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respondWithError(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    respondWithError(405, 'Method not allowed.');
}

$dataPath = __DIR__ . DIRECTORY_SEPARATOR . 'data.json';
if (!is_readable($dataPath)) {
    respondWithError(500, 'The product data file is unavailable.');
}

$contents = file_get_contents($dataPath);
if ($contents === false) {
    respondWithError(500, 'The product data file could not be read.');
}

try {
    $data = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException $exception) {
    respondWithError(500, 'The product data file contains invalid JSON.');
}

if (!is_array($data) || !isset($data['graph']) || !is_array($data['graph'])) {
    respondWithError(500, 'The product data file has an invalid graph.');
}

echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
