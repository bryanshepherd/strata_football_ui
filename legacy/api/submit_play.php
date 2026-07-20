<?php
/**
 * POST /api/submit_play.php
 * Submits a play and updates all related database tables
 */

session_start();
require_once 'StrataFootballAPI.php';

try {
    // Only allow POST requests
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception("Only POST requests allowed");
    }
    
    // Get data from request
    $input = json_decode(file_get_contents('php://input'), true);
    $gameId = $input['GameID'] ?? null;
    $playData = $input['playData'] ?? null;
    
    if (!$gameId) {
        throw new Exception("GameID is required");
    }
    
    if (!$playData) {
        throw new Exception("playData is required");
    }
    
    // Database connection
    $pdo = new PDO("mysql:host=localhost;dbname=strata_football", "root", "", [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    $api = new StrataFootballAPI($pdo);
    $result = $api->submitPlay($gameId, $playData);
    
    header('Content-Type: application/json');
    echo json_encode($result);
    
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'debug' => [
            'gameId' => $gameId ?? 'missing',
            'playData' => $playData ?? 'missing',
            'input' => $input ?? 'missing'
        ]
    ]);
}
?>
