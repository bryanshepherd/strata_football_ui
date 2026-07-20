<?php
/**
 * GET /api/load_game_state.php
 * Loads current game state for the scoring interface
 */

session_start();
require_once 'StrataFootballAPI.php';

try {
    // Only allow GET requests
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new Exception("Only GET requests allowed");
    }
    
    $gameId = $_GET['GameID'] ?? null;
    
    if (!$gameId) {
        throw new Exception("GameID is required");
    }
    
    // Database connection
    $pdo = new PDO("mysql:host=localhost;dbname=strata_football", "root", "", [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    $api = new StrataFootballAPI($pdo);
    $gameState = $api->loadGameState($gameId);
    
    header('Content-Type: application/json');
    echo json_encode($gameState);
    
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
