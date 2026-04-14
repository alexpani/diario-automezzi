<?php
/**
 * Car Tracker — API
 * Legge e scrive data.json nella stessa cartella.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Risponde alle preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dataFile = __DIR__ . '/data.json';

// Crea il file se non esiste
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode(['cars' => [], 'interventions' => []], JSON_PRETTY_PRINT));
}

// ── GET /api.php  →  restituisce tutti i dati ──────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo file_get_contents($dataFile);
    exit;
}

// ── PUT /api.php  →  sovrascrive tutti i dati ──────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);

    if (!is_array($data) || !isset($data['cars']) || !isset($data['interventions'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Payload non valido']);
        exit;
    }

    if (file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Impossibile scrivere il file']);
        exit;
    }

    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Metodo non consentito']);
