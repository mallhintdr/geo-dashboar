<?php
header('Content-Type: application/json');

// --- Configuration ---
$shajraRoot = __DIR__ . '/Shajra Parcha';
$jsonRoot   = __DIR__ . '/JSON Murabba';

// --- Get tehsil from query string ---
$tehsil = isset($_GET['tehsil']) ? trim($_GET['tehsil']) : '';
if (!$tehsil) {
    echo json_encode(['error' => 'No tehsil specified']);
    exit;
}

// --- Prepare paths ---
$shajraPath = $shajraRoot . '/' . $tehsil;
$jsonPath   = $jsonRoot   . '/' . $tehsil;

$mauzaSet = [];

// --- Scan folder names (Shajra Parcha) ---
if (is_dir($shajraPath)) {
    foreach (scandir($shajraPath) as $dir) {
        if ($dir === '.' || $dir === '..') continue;
        if (is_dir("$shajraPath/$dir")) {
            $mauzaSet[$dir] = true;
        }
    }
}

// --- Scan geojson file names (JSON Murabba) ---
if (is_dir($jsonPath)) {
    foreach (scandir($jsonPath) as $file) {
        if (preg_match('/\.geojson$/i', $file)) {
            $name = pathinfo($file, PATHINFO_FILENAME);
            $mauzaSet[$name] = true;
        }
    }
}

$mauzas = array_keys($mauzaSet);
sort($mauzas, SORT_NATURAL | SORT_FLAG_CASE);

echo json_encode($mauzas);
