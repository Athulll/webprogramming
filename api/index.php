<?php
declare(strict_types=1);

require __DIR__ . '/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params([
    'httponly' => true,
    'secure' => $isHttps,
    'samesite' => 'Strict',
    'path' => '/',
]);
session_start();

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function readJsonBody(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (preg_match('/^application\/json(?:\s*;|$)/i', $contentType) !== 1) {
        respond(['error' => 'Content-Type must be application/json.'], 400);
    }

    try {
        $body = json_decode(file_get_contents('php://input') ?: '', false, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        respond(['error' => 'Request body must contain valid JSON.'], 400);
    }

    if (!$body instanceof stdClass) {
        respond(['error' => 'Request body must be a JSON object.'], 400);
    }

    return get_object_vars($body);
}

function requireAuthentication(): void
{
    if (empty($_SESSION['authenticated'])) {
        respond(['error' => 'Authentication required.'], 401);
    }

    $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!isset($_SESSION['csrf_token']) || !is_string($csrfToken) || !hash_equals($_SESSION['csrf_token'], $csrfToken)) {
        respond(['error' => 'The session token is missing or invalid. Please sign in again.'], 403);
    }
}

function validateItem(array $input): array
{
    $nameInput = $input['name'] ?? null;
    $descriptionInput = $input['description'] ?? '';
    $imageInput = $input['image_url'] ?? '';
    if (!is_string($nameInput) || !is_string($descriptionInput) || !is_string($imageInput)) {
        respond(['error' => 'Name, description, and image_url must be strings.'], 400);
    }
    $name = trim($nameInput);
    $description = trim($descriptionInput);
    $price = $input['price'] ?? null;
    $categoryId = filter_var($input['category_id'] ?? null, FILTER_VALIDATE_INT);
    $stock = filter_var($input['stock'] ?? null, FILTER_VALIDATE_INT);
    $imageUrl = trim($imageInput);

    if ($name === '' || strlen($name) > 150) {
        respond(['error' => 'Name is required and must be at most 150 characters.'], 400);
    }
    if (strlen($description) > 10000) {
        respond(['error' => 'Description must be at most 10000 characters.'], 400);
    }
    if (!is_numeric($price) || (float) $price < 0 || (float) $price > 99999999.99) {
        respond(['error' => 'Price must be a non-negative number within the supported range.'], 400);
    }
    if ($categoryId === false || $categoryId < 1) {
        respond(['error' => 'Select a valid category.'], 400);
    }
    if ($stock === false || $stock < 0 || $stock > 4294967295) {
        respond(['error' => 'Stock must be a non-negative whole number in the supported range.'], 400);
    }
    if (strlen($imageUrl) > 2048) {
        respond(['error' => 'Image URL must be at most 2048 characters.'], 400);
    }
    if ($imageUrl !== '') {
        $url = filter_var($imageUrl, FILTER_VALIDATE_URL);
        $scheme = is_string($url) ? strtolower((string) parse_url($url, PHP_URL_SCHEME)) : '';
        if ($url === false || !in_array($scheme, ['http', 'https'], true)) {
            respond(['error' => 'Image URL must be a valid HTTP or HTTPS URL.'], 400);
        }
    }

    return [
        'name' => $name,
        'description' => $description,
        'price' => number_format((float) $price, 2, '.', ''),
        'category_id' => $categoryId,
        'stock' => $stock,
        'image_url' => $imageUrl === '' ? null : $imageUrl,
    ];
}

function fetchItem(PDO $db, int $id): ?array
{
    $statement = $db->prepare(
        'SELECT i.id, i.name, i.description, i.price, i.category_id, c.name AS category_name,
                i.image_url, i.stock, i.created_at, i.updated_at
         FROM items i JOIN categories c ON c.id = i.category_id WHERE i.id = :id'
    );
    $statement->execute(['id' => $id]);
    $item = $statement->fetch();
    return $item === false ? null : $item;
}

function dispatch(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (isset($_GET['route'])) {
        if (!is_string($_GET['route'])) {
            respond(['error' => 'Invalid API route.'], 400);
        }
        $route = trim($_GET['route'], '/');
        if (str_starts_with($route, 'api/')) {
            $route = substr($route, 4);
        }
        $path = '/api/' . $route;
    } else {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    }

    if ($path === '/api/session' && $method === 'GET') {
        respond([
            'authenticated' => !empty($_SESSION['authenticated']),
            'username' => $_SESSION['username'] ?? null,
            'csrf_token' => $_SESSION['csrf_token'] ?? null,
        ]);
    }

    if ($path === '/api/login' && $method === 'POST') {
        $input = readJsonBody();
        $config = applicationConfig();
        $expectedUser = $config['admin_username'] ?? null;
        $expectedPassword = $config['admin_password'] ?? null;
        if (!is_string($expectedUser) || $expectedUser === '' ||
            !is_string($expectedPassword) || $expectedPassword === '') {
            respond(['error' => 'Login credentials are not configured on the server.'], 500);
        }
        $username = $input['username'] ?? null;
        $password = $input['password'] ?? null;
        if (!is_string($username) || !is_string($password) ||
            !hash_equals($expectedUser, $username) || !hash_equals($expectedPassword, $password)) {
            respond(['error' => 'Invalid username or password.'], 401);
        }

        session_regenerate_id(true);
        $_SESSION['authenticated'] = true;
        $_SESSION['username'] = $username;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        respond(['authenticated' => true, 'csrf_token' => $_SESSION['csrf_token']]);
    }

    if ($path === '/api/logout' && $method === 'POST') {
        requireAuthentication();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        respond(['authenticated' => false]);
    }

    if (preg_match('#^/api/items/([0-9]+)$#', (string) $path, $matches) === 1 && $method === 'GET') {
        $item = fetchItem(database(), (int) $matches[1]);
        if ($item === null) {
            respond(['error' => 'Item not found.'], 404);
        }
        respond(['item' => $item]);
    }

    if ($path === '/api/items' && $method === 'GET') {
        $db = database();
        $queryInput = $_GET['q'] ?? '';
        if (!is_string($queryInput) || strlen($queryInput) > 200) {
            respond(['error' => 'Search query must be at most 200 characters.'], 400);
        }
        $query = trim($queryInput);
        $categoryId = $_GET['category_id'] ?? '';
        if (!is_string($categoryId)) {
            respond(['error' => 'Invalid category_id.'], 400);
        }

        $sql = 'SELECT i.id, i.name, i.description, i.price, i.category_id, c.name AS category_name,
                       i.image_url, i.stock, i.created_at, i.updated_at
                FROM items i JOIN categories c ON c.id = i.category_id';
        $conditions = [];
        $parameters = [];
        if ($query !== '') {
            $conditions[] = '(i.name LIKE :query_name OR i.description LIKE :query_description OR c.name LIKE :query_category)';
            $search = '%' . $query . '%';
            $parameters['query_name'] = $search;
            $parameters['query_description'] = $search;
            $parameters['query_category'] = $search;
        }
        if ($categoryId !== '') {
            $validatedCategory = filter_var($categoryId, FILTER_VALIDATE_INT);
            if ($validatedCategory === false || $validatedCategory < 1) {
                respond(['error' => 'Invalid category_id.'], 400);
            }
            $conditions[] = 'i.category_id = :category_id';
            $parameters['category_id'] = $validatedCategory;
        }
        if ($conditions !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $conditions);
        }
        $sql .= ' ORDER BY i.id';
        $statement = $db->prepare($sql);
        $statement->execute($parameters);
        $items = $statement->fetchAll();

        $categories = $db->query(
            'SELECT c.id, c.name, COUNT(i.id) AS item_count
             FROM categories c LEFT JOIN items i ON i.category_id = c.id
             GROUP BY c.id, c.name ORDER BY c.name'
        )->fetchAll();
        $totalItems = (int) $db->query('SELECT COUNT(*) FROM items')->fetchColumn();
        respond(['items' => $items, 'categories' => $categories, 'total' => count($items), 'total_items' => $totalItems]);
    }

    if ($path === '/api/items' && $method === 'POST') {
        requireAuthentication();
        $item = validateItem(readJsonBody());
        $db = database();
        $categoryCheck = $db->prepare('SELECT id FROM categories WHERE id = :id');
        $categoryCheck->execute(['id' => $item['category_id']]);
        if (!$categoryCheck->fetch()) {
            respond(['error' => 'The selected category does not exist.'], 400);
        }

        $statement = $db->prepare(
            'INSERT INTO items (name, description, price, category_id, image_url, stock)
             VALUES (:name, :description, :price, :category_id, :image_url, :stock)'
        );
        $statement->execute($item);
        $created = fetchItem($db, (int) $db->lastInsertId());
        respond(['item' => $created], 201);
    }

    if (preg_match('#^/api/items/([0-9]+)$#', (string) $path, $matches) === 1 && $method === 'PUT') {
        requireAuthentication();
        $id = (int) $matches[1];
        $item = validateItem(readJsonBody());
        $db = database();
        if (fetchItem($db, $id) === null) {
            respond(['error' => 'Item not found.'], 404);
        }
        $categoryCheck = $db->prepare('SELECT id FROM categories WHERE id = :id');
        $categoryCheck->execute(['id' => $item['category_id']]);
        if (!$categoryCheck->fetch()) {
            respond(['error' => 'The selected category does not exist.'], 400);
        }
        $item['id'] = $id;
        $statement = $db->prepare(
            'UPDATE items
             SET name = :name, description = :description, price = :price,
                 category_id = :category_id, image_url = :image_url, stock = :stock
             WHERE id = :id'
        );
        $statement->execute($item);
        respond(['item' => fetchItem($db, $id)]);
    }

    if ($path === '/api/items') {
        header('Allow: GET, POST');
        respond(['error' => 'Method not allowed.'], 405);
    }

    if (preg_match('#^/api/items/[0-9]+$#', (string) $path) === 1) {
        header('Allow: GET, PUT');
        respond(['error' => 'Method not allowed.'], 405);
    }

    if (in_array($path, ['/api/login', '/api/logout'], true)) {
        header('Allow: POST');
        respond(['error' => 'Method not allowed.'], 405);
    }

    respond(['error' => 'Endpoint not found.'], 404);
}

try {
    dispatch();
} catch (Throwable $exception) {
    error_log('ShopCraft API error: ' . $exception->getMessage());
    respond(['error' => 'An internal server error occurred.'], 500);
}
