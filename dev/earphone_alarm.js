/*
 * Earphone Alarm
 *
 * Reads alarms from ALARM_FILE and triggers them based on:
 *  - Time
 *  - Snooze
 *  - Repeat days
 *  - Bluetooth/Headphone connection
 *  - Custom ringtone & vibration
 */

// ===== Configurable parameters start =====
const ALARM_FILE = "../.alarm.txt";
// ===== Configurable parameters end =====

// ===== Request permission =====
runtime.requestPermissions([android.Manifest.permission.BLUETOOTH_CONNECT]);

// ===== Shared =====
importClass(android.media.AudioManager);
var audioManager = context.getSystemService(android.content.Context.AUDIO_SERVICE);
importClass(android.content.IntentFilter);importClass(android.content.Intent);
importClass(android.content.BroadcastReceiver);

// ===== Earphone State =====
var earphone = false;

// ===== Bluetooth =====
importClass(android.bluetooth.BluetoothAdapter);

var btReceiver = new BroadcastReceiver({
    onReceive: function (ctx, intent) {
        if (intent.getAction() === BluetoothAdapter.ACTION_STATE_CHANGED) {
            var state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1);
            if (state === BluetoothAdapter.STATE_ON) {
                console.log("Bluetooth enabled");
            } else if (state === BluetoothAdapter.STATE_OFF) {
                console.log("Bluetooth disabled");
                earphone = false;
            }
        } else if (intent.getAction() === BluetoothAdapter.ACTION_CONNECTION_STATE_CHANGED) {
            var state = intent.getIntExtra(BluetoothAdapter.EXTRA_CONNECTION_STATE, -1);
            if (state === BluetoothAdapter.STATE_CONNECTED) {
                console.log("Bluetooth connected");
                earphone = true;
            } else if (state === BluetoothAdapter.STATE_DISCONNECTED) {
                console.log("Bluetooth disconnected");
                earphone = false;
            }
        }
    }
});

var btFilter = new IntentFilter();
btFilter.addAction(BluetoothAdapter.ACTION_STATE_CHANGED);
btFilter.addAction(BluetoothAdapter.ACTION_CONNECTION_STATE_CHANGED);
context.registerReceiver(btReceiver, btFilter);

// ===== Headphone inserted/removed =====
var headsetReceiver = new BroadcastReceiver({
    onReceive: function (ctx, intent) {
        if (intent.getAction() === Intent.ACTION_HEADSET_PLUG) {
            var state = intent.getIntExtra("state", -1);
            if (state === 1) {
                console.log("Headphone inserted");
                earphone = false;
            } else if (state === 0) {
                console.log("Headphone removed");
                earphone = true;
            }
        }
    }
});

var headsetFilter = new IntentFilter(Intent.ACTION_HEADSET_PLUG);
context.registerReceiver(headsetReceiver, headsetFilter);

// ===== Audio noisy received =====
var noisyReceiver = new BroadcastReceiver({
    onReceive: function (context, intent) {
        if (intent.getAction() === AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
            console.log("Noisy event");
            earphone = false;
        }
    }
});

var noisyFilter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
context.registerReceiver(noisyReceiver, noisyFilter);

// ===== Unregister =====
events.on("exit", () => {
    context.unregisterReceiver(btReceiver);
    context.unregisterReceiver(headsetReceiver);
    context.unregisterReceiver(noisyReceiver);
});

// ===== Alarms =====
var file = files.read(ALARM_FILE);
var alarms = [];

// ===== Read Alarms =====
function loadAlarms() {
    alarms = [];
    try {
        let lines = file.split("\n");
        lines.forEach(line => {
            line = line.trim();
            if (!line || line.startsWith("#")) return;
            // Format: Time Snooze Repeat Trigger Ringtone Vibration
            // e.g. 15:30 -1 0111110 01 ./a.opus -1
            let parts = line.split(/\s+/);
            if (parts.length < 6) return;

            let [time, snooze, repeat, triggerCond, ringtone, vibration] = parts;
            let [hh, mm, ss] = time.split(":").map(Number);
            if (ss === undefined) ss = 0;

            let [snoozeMM, snoozeSS] = snooze.split(":").map(Number);
            if (snoozeSS === undefined) snoozeSS = 0;

            alarms.push({
                hour: hh,
                minute: mm,
                second: ss,
                snooze: snoozeMM < 0 ? null : snoozeMM*60 + snoozeSS,
                repeat: repeat.padStart(7,'0'), // SMTWTFS
                triggerCond,
                ringtone,
                vibration: vibration === "-1" ? false : true
            });
        });
    } catch (e) {
        console.error("Failed to read alarms:", e);
    }
}

// ===== Alarm Checker =====
function checkAlarms() {
    let now = new Date();
    let weekday = now.getDay(); // 0=Sun,6=Sat
    alarms.forEach(alarm => {
        if (alarm.repeat[weekday] !== '1') return;
        if (now.getHours() === alarm.hour && now.getMinutes() === alarm.minute && now.getSeconds() === alarm.second) {            
            // check trigger condition
            // 0 = not connected, 1 = connected
            let cond = alarm.triggerCond;
            let allow = false;
            if (cond === "0" && !earphone) allow = true;
            if (cond === "1" && earphone) allow = true;
            if (allow) triggerAlarm(alarm);
        }
    });
}

// ===== Alarm Trigger =====
function triggerAlarm(alarm) {
    console.info("Alarm triggered:", alarm);

    // Ringtone
    var uri = android.net.Uri.parse("file://" + alarm.ringtone);
    var rm = new android.media.RingtoneManager(context);
    var r = rm.getRingtone(context, uri);
    r.play();

    // Vibration
    if (alarm.vibration) {
        var vibrator = context.getSystemService(android.content.Context.VIBRATOR_SERVICE);
        if (vibrator.hasVibrator()) {
            vibrator.vibrate(android.os.VibrationEffect.createOneShot(2000, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
        }
    }

    // Snooze handling
    if (alarm.snooze !== null) {
        setTimeout(() => {
            console.log("Snooze alarm:", alarm);
            triggerAlarm(alarm);
        }, alarm.snooze * 1000);
    }
}

// ===== Load =====
function load() {
    file = files.read(ALARM_FILE);
    loadAlarms();
    checkAlarms();
}

// ===== Load every second =====
setInterval(load, 1000);
