/*
 * Accessibility Watchdog
 *
 * Function:
 * - Record enabled_accessibility_services on first startup into BASELINE_FILE
 * - Periodically check and automatically add all services in baseline that have been disabled back
 *
 * Requirement:
 *  - WRITE_SECURE_SETTINGS permission
 *  - Enable all accessibility services you want to keep enabled before starting this script
 */

// ===== Configurable parameters start =====
const CHECK_INTERVAL = 10000;
const BASELINE_FILE = "../accessibility_baseline.txt";
// ===== Configurable parameters end =====

// ===== Java class path =====
var Settings = android.provider.Settings;
var resolver = context.getContentResolver();
var File = java.io.File;
var FileWriter = java.io.FileWriter;
var BufferedReader = java.io.BufferedReader;
var FileReader = java.io.FileReader;

// ===== Get enabled services =====
function getEnabledServices() {
    var value = Settings.Secure.getString(
        resolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    );

    if (!value) return [];

    return value;
}

// ===== Set enabled services =====
function setEnabledServices(value) {
    Settings.Secure.putString(
        resolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        value
    );

    Settings.Secure.putInt(
        resolver,
        Settings.Secure.ACCESSIBILITY_ENABLED,
        1
    );
}

// ===== Read baseline from file =====
function readBaselineFile() {
    if (!files.exists(BASELINE_FILE)) return null;

    var value = files.read(BASELINE_FILE);
    if (!value) return null;

    return value;
}

// ===== Write baseline to file =====
function writeBaselineFile(value) {
    files.write(BASELINE_FILE, value);
    console.info("Baseline written to " + BASELINE_FILE + ": " + value);
}

// ===== Initialize baseline =====
function initBaseline() {
    var value = readBaselineFile();
    if (!value) {
        value = getEnabledServices();
        writeBaselineFile(value);
    } else {
        console.log("Baseline read from " + BASELINE_FILE + ": " + value);
    }
    return value;
}

// ===== Contains =====
function contains(arr, v) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] === v) return true;
    }
    return false;
}

// ===== Watchdog =====
function watchdog() {
    var value = initBaseline();
    var baseline = value.split(":").filter(function(s) { return s; }) || [];
    var current_value = getEnabledServices();
    var current = current_value.split(":").filter(function(s) { return s; });
    var changed = false;

    for (var i = 0; i < baseline.length; i++) {
        if (!contains(current, baseline[i])) {
            console.warn("Service disabled found: " + baseline[i]);
            changed = true;
        }
    }

    if (changed) {
        setEnabledServices(value);
        console.warn("Accessibility services recovered");
    } else {
        console.log("No accessibility service disabled");
    }
}

// ===== Main loop =====
setInterval(watchdog, CHECK_INTERVAL);
