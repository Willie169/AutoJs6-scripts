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

setInterval(() => {
    __ensureScript("./daemon_manager_helper_A.js");
    __ensureScript("./daemon_manager_helper_B.js");
    console.log("manager heartbeat");
    files.listDir(DAEMONS_DIR).forEach(f => {
        __ensureScript(DAEMONS_DIR + f);
    });
}, CHECK_INTERVAL);

setInterval(() => {}, 1 << 30);
