/*
 * Audio Watchdog
 */

// ===== Configurable parameters start =====
const CHECK_INTERVAL = 10000;
// ===== Configurable parameters end =====

// ===== Request permission =====
runtime.requestPermissions([android.Manifest.permission.BLUETOOTH_CONNECT]);

// ===== Shared =====
importClass(android.media.AudioManager);
var audioManager = context.getSystemService(android.content.Context.AUDIO_SERVICE);
importClass(android.content.IntentFilter);importClass(android.content.Intent);
importClass(android.content.BroadcastReceiver);
importClass(android.bluetooth.BluetoothAdapter);

// ===== Bluetooth enabled/disabled =====
var btReceiver = new BroadcastReceiver({
    onReceive: function (ctx, intent) {
        if (intent.getAction() === BluetoothAdapter.ACTION_STATE_CHANGED) {
            var state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1);
            if (state === BluetoothAdapter.STATE_ON) {
                console.log("Bluetooth enabled");
            } else if (state === BluetoothAdapter.STATE_OFF) {
                console.log("Bluetooth disabled");
            }
        }
    }
});

var btFilter = new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED);
context.registerReceiver(btReceiver, btFilter);

// ===== Bluetooth connected/disconnected =====
importClass(android.bluetooth.BluetoothDevice);

var deviceReceiver = new BroadcastReceiver({
    onReceive: function (context, intent) {
        var action = intent.getAction();

        if (BluetoothDevice.ACTION_ACL_CONNECTED.equals(action)) {
            var device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
            console.log("ACL CONNECTED: " + device.getName());
        }

        if (BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action)) {
            var device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
            console.log("ACL DISCONNECTED: " + device.getName());
        }
    }
});

var deviceFilter = new IntentFilter();
deviceFilter.addAction(BluetoothDevice.ACTION_ACL_CONNECTED);
deviceFilter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);

context.registerReceiver(
    deviceReceiver,
    deviceFilter,
    Context.RECEIVER_NOT_EXPORTED
);

// ===== Headphone inserted/removed =====
var headsetReceiver = new BroadcastReceiver({
    onReceive: function (ctx, intent) {
        if (intent.getAction() === Intent.ACTION_HEADSET_PLUG) {
            var state = intent.getIntExtra("state", -1);
            if (state === 1) console.log("Headphone inserted");
            if (state === 0) console.log("Headphone removed");
        }
    }
});

var headsetFilter = new IntentFilter(Intent.ACTION_HEADSET_PLUG);
context.registerReceiver(headsetReceiver, headsetFilter);

// ===== Volume up/down =====
importClass(android.database.ContentObserver);
importClass(android.os.Handler);
importClass(android.provider.Settings);

var volumeObserver = new JavaAdapter(ContentObserver, {
    onChange: function(selfChange) {
        var current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
        console.log("Volume changed, now:", current);
    }
}, new Handler());

context.getContentResolver().registerContentObserver(
    Settings.System.CONTENT_URI,
    true,
    volumeObserver
);

// ===== Audio playback =====
importClass(android.media.AudioPlaybackConfiguration);

var myUid = android.os.Process.myUid();
var otherAppPlaying = false;

var callback = new AudioManager.AudioPlaybackCallback({
    onPlaybackConfigChanged: function(configs) {    
        var foundOtherActive = false;

        configs.forEach(function(config){
            if (config.isActive() && config.getClientUid() !== myUid) {
                var usage = config.getAudioAttributes().getUsage();
                if (
                    usage === android.media.AudioAttributes.USAGE_MEDIA ||
                    usage === android.media.AudioAttributes.USAGE_GAME
                ) {
                    foundOtherActive = true;
                }
            }
        });

        if (foundOtherActive && !otherAppPlaying) {
            otherAppPlaying = true;
            console.log("Other app started playing media");
        }

        if (!foundOtherActive && otherAppPlaying) {
            otherAppPlaying = false;
            console.log("Other app stopped playing media");
        }
    }
});

audioManager.registerAudioPlaybackCallback(callback, null);

// ===== Audio noisy received =====
importClass(android.content.BroadcastReceiver);

var noisyReceiver = new BroadcastReceiver({
    onReceive: function (context, intent) {
        if (intent.getAction() === AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
            console.log("Noisy event");
        }
    }
});

var noisyFilter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
context.registerReceiver(noisyReceiver, noisyFilter);

// ===== Unregister =====
events.on("exit", () => {
    context.unregisterReceiver(btReceiver);
    context.unregisterReceiver(deviceReceiver);
    context.unregisterReceiver(headsetReceiver);
    context.getContentResolver().unregisterContentObserver(volumeObserver);
    audioManager.unregisterAudioPlaybackCallback(callback);
    context.unregisterReceiver(noisyReceiver);
});

// ===== Keep script alive =====
setInterval(()=>{}, CHECK_INTERVAL);
