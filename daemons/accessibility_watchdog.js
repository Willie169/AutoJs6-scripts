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
const CHECK_INTERVAL = 10000; // 10 seconds
const BASELINE_FILE = "./accessibility_baseline.txt";
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

    return value.split(":").filter(function(s) { return s; });
}

// ===== Set enabled services =====
function setEnabledServices(list) {
    Settings.Secure.putString(
        resolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        list.join(":")
    );

    Settings.Secure.putInt(
        resolver,
        Settings.Secure.ACCESSIBILITY_ENABLED,
        1
    );
}

// ===== Read baseline from file =====
function readBaselineFile() {
    var file = new File(BASELINE_FILE);
    if (!file.exists()) return null;

    var reader = new BufferedReader(new FileReader(file));
    var line = reader.readLine();
    reader.close();

    if (!line) return null;

    return line.split(":").filter(function(s) { return s; });
}

// ===== Write baseline to file =====
function writeBaselineFile(services) {
    var writer = new FileWriter(BASELINE_FILE, false);
    writer.write(services.join(":"));
    writer.close();
    console.info("Baseline written to " + BASELINE_FILE + ": " + services);
}

// ===== Initialize baseline =====
function initBaseline() {
    var baseline = readBaselineFile();
    if (!baseline) {
        baseline = getEnabledServices();
        writeBaselineFile(baseline);
    }
    return baseline;
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
    var baseline = initBaseline() || [];
    var current = getEnabledServices();
    var changed = false;

    for (var i = 0; i < baseline.length; i++) {
        if (!contains(current, baseline[i])) {
            console.warn("Service disabled found: " + baseline[i]);
            current.push(baseline[i]);
            changed = true;
        }
    }

    if (changed) {
        setEnabledServices(current);
        console.warn("Accessibility services recovered");
    } else {
        console.log("No accessibility service disabled");
    }
}

// ===== Main loop =====
setInterval(watchdog, CHECK_INTERVAL);
