<?php
declare(strict_types=1);

function applicationConfig(): array
{
    static $config = null;
    if (is_array($config)) {
        return $config;
    }

    $localConfigPath = __DIR__ . DIRECTORY_SEPARATOR . 'config.local.php';
    $localConfig = is_file($localConfigPath) ? require $localConfigPath : [];
    if (!is_array($localConfig)) {
        throw new RuntimeException('api/config.local.php must return a configuration array.');
    }

    $config = $localConfig;
    $environmentVariables = [
        'db_host' => 'DB_HOST',
        'db_port' => 'DB_PORT',
        'db_name' => 'DB_NAME',
        'db_user' => 'DB_USER',
        'db_password' => 'DB_PASSWORD',
        'admin_username' => 'APP_ADMIN_USERNAME',
        'admin_password' => 'APP_ADMIN_PASSWORD',
    ];
    foreach ($environmentVariables as $key => $environmentVariable) {
        $value = getenv($environmentVariable);
        if ($value !== false) {
            $config[$key] = $value;
        }
    }

    return $config;
}

function database(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $config = applicationConfig();
    $host = $config['db_host'] ?? '127.0.0.1';
    $port = $config['db_port'] ?? '3306';
    $name = $config['db_name'] ?? '';
    $user = $config['db_user'] ?? '';
    $password = $config['db_password'] ?? null;

    if (!is_string($name) || $name === '' || !is_string($user) || $user === '' || !is_string($password)) {
        throw new RuntimeException('Database credentials are not configured.');
    }

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);
    $connection = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $connection;
}
