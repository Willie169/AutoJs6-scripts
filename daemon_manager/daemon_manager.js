// ===== Configurable parameters start =====
const CHECK_INTERVAL = 9973;
const DAEMONS_DIR = "../daemons/";
// ===== Configurable parameters end =====

function __isScriptRunning(name) {
    let list = engines.all();
    for (let e of list) {
        let src = e.getSource();
        if (src && src.toString().includes(name)) {
            return true;
        }
    }
    return false;
}

function __ensureScript(path) {
    let name = path.split("/").pop();

    if (!__isScriptRunning(name)) {
        console.warn("Starting:", name);
        engines.execScriptFile(path);
        return true;
    }
    return false;
}

function __keepAlive(title) {
    try {
        auto.service;
        app.startForegroundService({
            id: Math.floor(Math.random() * 10000),
            title: title,
            text: "running",
        });
    } catch (e) {}
}

__keepAlive("Daemon Manager");

const PowerManager = android.os.PowerManager;
const powerManager = context.getSystemService(context.POWER_SERVICE);

const wakeLock = powerManager.newWakeLock(
    PowerManager.PARTIAL_WAKE_LOCK,
    "DaemonManager::WakeLock"
);

setInterval(() => {
    __ensureScript("./daemon_manager_helper_A.js");
    __ensureScript("./daemon_manager_helper_B.js");
    files.listDir(DAEMONS_DIR).forEach(f => {
        __ensureScript(DAEMONS_DIR + f);
    });
    if (!wakeLock.isHeld()) {
        wakeLock.acquire();
        console.log("Daemon manager wake lock acquired.");
    }
}, CHECK_INTERVAL);

setInterval(() => {}, 1 << 30);

events.on("exit", () => {
    if (wakeLock.isHeld()) {
        wakeLock.release();
        console.log("Daemon manager wake lock released.");
    }
});
