/**
 * Shizuku Watchdog
 *
 * Function:
 *  - Checks Wi-Fi connectivity and Shizuku running state
 *  - Checks if Shizuku is running and starts Shizuku via Termux if not
 *
 * Requirements:
 *  - WRITE_SECURE_SETTINGS permission
 *  - "Run commands in Termux environment" permission
 *  - Shizuku ADB paired at least once
 *  - Termux installed with:
       pkg update
       pkg install nmap openssl android-tools -y
 *  - <termux_user>@localhost ADB paired at least once, which can be done in Termux with:
       adb pair localhost:<adb_port> <wifi_paring_code>
       adb kill-server
 */

// ===== Configurable parameters start =====
var TERMUX_WORKDIR = "/data/data/com.termux/files/home/shizuku";
var SHIZUKU_SCRIPT = TERMUX_WORKDIR + "/shizuku";
var SHIZUKU_RESTART = true
var CHECK_INTERVAL = 10000;
// ===== Configurable parameters end =====

// ===== Java class path =====
var Settings = android.provider.Settings;
var resolver = context.getContentResolver();

// ===== Run a command in Termux via intent =====
function runInTermuxCommand(args) {
    var intent = new android.content.Intent();
    intent.setAction("com.termux.RUN_COMMAND");
    intent.setClassName(
        "com.termux",
        "com.termux.app.RunCommandService"
    );

    var StringArray = java.lang.reflect.Array.newInstance(
        java.lang.String,
        args.length
    );
    for (let i = 0; i < args.length; i++) {
        StringArray[i] = String(args[i]);
    }

    intent.putExtra(
        "com.termux.RUN_COMMAND_PATH",
        "/data/data/com.termux/files/usr/bin/bash"
    );
    intent.putExtra(
        "com.termux.RUN_COMMAND_ARGUMENTS",
        StringArray
    );
    intent.putExtra(
        "com.termux.RUN_COMMAND_WORKDIR",
        "/data/data/com.termux/files/home"
    );
    intent.putExtra(
        "com.termux.RUN_COMMAND_BACKGROUND",
        true
    );

    context.startService(intent);
    console.log("Termux intent sent: bash ", args.join(" "));
}

// ===== Write Shizuku script in Termux =====
function writeShizukuScriptInTermux() {
    var scriptContent = String.raw`#!/data/data/com.termux/files/usr/bin/bash

adb kill-server

# Make a list of open ports
ports=$( nmap -sT -p30000-50000 --open localhost | grep "open" | cut -f1 -d/ )

for port in $ports; do

  # Try to connect
  result=$( adb connect "localhost:$port" )

  # Check if the connection succeeded
  if [[ "$result" =~ "connected" || "$result" =~ "already" ]]; then

    echo "$result"

    adb reconnect offline

    target_device="localhost:$port"

    echo "Target device: $target_device"

    # Start Shizuku
    adb -s "$target_device" shell "$( adb -s "$target_device" shell pm path moe.shizuku.privileged.api | sed 's/^package://;s/base\.apk/lib\/arm64\/libshizuku\.so/' )"

    # Disable wireless debugging
    adb -s "$target_device" shell settings put global adb_wifi_enabled 0

    adb kill-server

    exit 0
  fi
done

# Error
echo "ERROR: Is wireless debugging enabled?"

exit 1`;

    runInTermuxCommand(["-c", `mkdir -p ${TERMUX_WORKDIR} && cat > "${SHIZUKU_SCRIPT}" <<'EOF'\n${scriptContent}\nEOF`]);
    runInTermuxCommand(["-c", "chmod +x " + SHIZUKU_SCRIPT]);
}

// ===== Start Shizuk via Termuxu =====
function startShizuku() {
    Settings.Global.putInt(resolver, "adb_wifi_enabled", 1);
    Settings.Global.putInt(resolver, "adb_enabled", 1);
    runInTermuxCommand([SHIZUKU_SCRIPT]);
}

// ===== Check Wi-Fi connectivity =====
function isWifiConnected() {
    const Context = android.content.Context;
    const WifiManager = android.net.wifi.WifiManager;
    const wifiManager = context.getSystemService(Context.WIFI_SERVICE);
    const wifiInfo = wifiManager.getConnectionInfo();
    const isEnabled = wifiManager.isWifiEnabled();
    const hasIp = wifiInfo.getIpAddress() !== 0;
    return isEnabled && hasIp ? wifiInfo.getSSID() : null;
}

// ===== Main loop =====
const intervalId = setInterval(watchdog, CHECK_INTERVAL);

// ===== Watchdog =====
function watchdog() {
    const ssid = isWifiConnected();

    if (shizuku.isRunning()) {
        Settings.Global.putInt(resolver, "adb_wifi_enabled", 0);
        Settings.Global.putInt(resolver, "adb_enabled", 1);
    } else if (SHIZUKU_RESTART && ssid) {
        console.warn("Shizuku not running and Wi-Fi connected: " + ssid + ", attempting restart Shizuku...");
        writeShizukuScriptInTermux();
        startShizuku();
        clearInterval(intervalId);
        setTimeout(exit, 100000);
    }
}
