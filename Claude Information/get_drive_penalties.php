<?php
// /strata_football/api/get_drive_penalties.php
// Returns { success, drive_id, penalties: { count, yards } }
// Aggregates from SQL `penalties` table joined to `plays` by DriveID.
// Only counts ACCEPTED, NON-OFFSETTING penalties.

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../db_pdo.php';

$driveId = $_GET['drive_id'] ?? null;
if (!$driveId) {
    echo json_encode([ 'success' => false, 'error' => 'Missing required parameter: drive_id' ]);
    exit;
}

try {
    $sql = "
        SELECT 
            COUNT(*) AS PenCount,
            COALESCE(SUM(ABS(pen.PenaltyYards)), 0) AS PenYards
        FROM penalties pen
        JOIN plays pl ON pl.PlayID = pen.PlayID
        WHERE pl.DriveID = :drive_id
          AND (pen.IsDeclined IS NULL OR pen.IsDeclined = 0)
          AND (pen.IsOffsetting IS NULL OR pen.IsOffsetting = 0)
          AND (pen.IsAccepted IS NULL OR pen.IsAccepted = 1)
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':drive_id' => $driveId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $count = isset($row['PenCount']) ? (int)$row['PenCount'] : 0;
    $yards = isset($row['PenYards']) ? (int)$row['PenYards'] : 0;

    echo json_encode([
        'success' => true,
        'drive_id' => (int)$driveId,
        'penalties' => [ 'count' => $count, 'yards' => $yards ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage()
    ]);
}
?>
