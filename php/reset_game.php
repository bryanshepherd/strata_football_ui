<?php
header('Content-Type: application/json');

// Start session to access login info
if (session_status() === PHP_SESSION_NONE) session_start();

// Simple auth check - assumes $_SESSION['user'] contains ['role'] or similar
$user = $_SESSION['user'] ?? null;
if (!$user || !isset($user['role']) || !in_array($user['role'], ['super', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Read POST body (support form-encoded or JSON)
$game_id = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!empty($_POST['game_id'])) {
        $game_id = $_POST['game_id'];
    } else {
        // Try raw JSON
        $raw = file_get_contents('php://input');
        $json = json_decode($raw, true);
        if (isset($json['game_id'])) $game_id = $json['game_id'];
    }
}

if (empty($game_id)) {
    echo json_encode(['error' => 'Missing game_id']);
    exit;
}

// Database connection - adjust path to your DB helper
// Try to use existing db_pdo.php if available
$pdo = null;
// Try common paths for db_pdo.php (this file defines $pdo)
$possible = [
    __DIR__ . '/../../strata_football/db_pdo.php',
    __DIR__ . '/../strata_football/db_pdo.php',
    __DIR__ . '/../../strata_football/api/db_pdo.php',
    __DIR__ . '/../../strata_football/db.php',
    __DIR__ . '/../strata_football/db.php'
];
foreach ($possible as $p) {
    if (file_exists($p)) {
        require_once $p;
        // db_pdo.php defines $pdo in global scope
        if (isset($pdo) && $pdo instanceof PDO) break;
    }
}

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection not found']);
    exit;
}

try {
    $pdo->beginTransaction();

    // Delete plays
    $stmt = $pdo->prepare('DELETE FROM plays WHERE GameID = ?');
    $stmt->execute([$game_id]);

    // Delete play_participants
    $stmt = $pdo->prepare('DELETE FROM play_participants WHERE GameID = ?');
    $stmt->execute([$game_id]);

    // Delete penalties
    $stmt = $pdo->prepare('DELETE FROM penalties WHERE GameID = ?');
    $stmt->execute([$game_id]);

    // Delete drives
    $stmt = $pdo->prepare('DELETE FROM drives WHERE GameID = ?');
    $stmt->execute([$game_id]);

    // Reset GameState JSON structure
    $newState = [
        'score' => ['home' => 0, 'visitor' => 0],
        'quarter' => 1,
        'possession' => null,
        'down' => 1,
        'distance' => 10,
        'yard_line' => null,
        'line_to_gain' => null,
        'timeouts' => ['home' => 3, 'visitor' => 3],
        'challenges' => ['home' => 0, 'visitor' => 0],
        'clock' => ['minutes' => 15, 'seconds' => 0],
        'recent_plays' => [],
        'live_state' => new stdClass(),
        'game_info' => new stdClass()
    ];

    $jsonState = json_encode($newState);

    // Update games table
    // Try updating GameState and GameStatus if exists
    $updateSql = "UPDATE games SET GameState = ?";
    // Check if GameStatus column exists
    $colCheck = $pdo->prepare("SHOW COLUMNS FROM games LIKE 'GameStatus'");
    $colCheck->execute();
    $hasGameStatus = $colCheck->rowCount() > 0;
    if ($hasGameStatus) {
        $updateSql .= ", GameStatus = 'pregame'";
    }
    $updateSql .= " WHERE GameID = ?";

    $stmt = $pdo->prepare($updateSql);
    $stmt->execute([$jsonState, $game_id]);

    $pdo->commit();

    echo json_encode(['success' => true]);
    exit;
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Failed to reset game', 'detail' => $e->getMessage()]);
    exit;
}

?>
