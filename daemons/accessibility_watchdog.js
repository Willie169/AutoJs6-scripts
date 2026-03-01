/*
 * Accessibility Watchdog
 *
 * Function:
 * - Record enabled accessibility services into BASELINE_FILE at startup
 * - Add all newly added enabled accessibility services into BASELINE_FILE
 * - Automatically recover all accessibility services in BASELINE_FILE that have been disabled
 *
 * Requirement:
 *  - WRITE_SECURE_SETTINGS permission
 *  - To disable an accessibility service, stop this script, disable it from settings, remove BASELINE_FILE, and then start this script again
 */

// ===== Configurable parameters start =====
const CHECK_INTERVAL = 10000;
const BASELINE_FILE = "../.accessibility_baseline.txt";
// ===== Configurable parameters end =====

// ===== Java class path =====
var Settings = android.provider.Settings;
var resolver = context.getContentResolver();
var pm = context.getPackageManager();

// ===== Utilities =====
function splitServices(value) {
    if (!value) return [];
    return value.split(":").filter(function (s) { return s; });
}

function joinServices(arr) {
    return arr.join(":");
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
        if (b.indexOf(a[i]) === -1) return false;
    }
    return true;
}

// ===== Get enabled services =====
function getEnabledServices() {
    return Settings.Secure.getString(
        resolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ) || "";
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

// ===== Service existence check =====
function serviceExists(serviceName) {
    try {
        var parts = serviceName.split("/");
        if (parts.length !== 2) return false;

        var pkg = parts[0];
        pm.getPackageInfo(pkg, 0);
        return true;
    } catch (e) {
        return false;
    }
}

// ===== Read baseline from file =====
function readBaseline() {
    if (!files.exists(BASELINE_FILE)) return null;
    return files.read(BASELINE_FILE) || null;
}

// ===== Write baseline to file =====
function writeBaseline(value) {
    files.write(BASELINE_FILE, value);
    console.info("Accessibility service baseline updated: " + value);
}

// ===== Initialize =====
function initBaseline() {
    var value = readBaseline();
    if (!value) {
        value = getEnabledServices();
        writeBaseline(value);
    }
    return value;
}

// ===== Watchdog =====
function watchdog() {
    var baseline = initBaseline();
    var baseline = splitServices(baseline);

    var current = getEnabledServices();
    var current = splitServices(current);

    var changed = false;
    var baselineChanged = false;

    var filteredBaseline = [];
    for (var i = 0; i < baseline.length; i++) {
        if (serviceExists(baseline[i])) {
            filteredBaseline.push(baseline[i]);
        } else {
            console.warn("Accessibility service uninstalled, removing from baseline: " + baseline[i]);
            baselineChanged = true;
        }
    }
    baseline = filteredBaseline;

    for (var i = 0; i < baseline.length; i++) {
        if (current.indexOf(baseline[i]) === -1) {
            console.warn("Accessibility service disabled detected: " + baseline[i]);
            current.push(baseline[i]);
            changed = true;
        }
    }

    for (var i = 0; i < current.length; i++) {
        if (baseline.indexOf(current[i]) === -1) {
            console.info("New accessibility service detected, adding to baseline: " + current[i]);
            baseline.push(current[i]);
            baselineChanged = true;
        }
    }

    if (changed) {
        setEnabledServices(joinServices(current));
        console.warn("Accessibility services recovered");
    }

    if (baselineChanged) {
        writeBaseline(joinServices(baseline));
    }
}

// ===== Main loop =====
setInterval(watchdog, CHECK_INTERVAL);
