<?php
/**
 * GET /api/get_games.php
 * Returns all games available to the current user for scoring
 */

session_start();
require_once 'StrataFootballAPI.php';

try {
    // Database connection
    $pdo = new PDO("mysql:host=localhost;dbname=strata_football", "root", "", [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    $api = new StrataFootballAPI($pdo);
    $games = $api->getGames();
    
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'games' => $games
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
