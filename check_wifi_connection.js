var Context = android.content.Context;
var WifiManager = android.net.wifi.WifiManager;
var ConnectivityManager = android.net.ConnectivityManager;
var wifiManager = context.getSystemService(Context.WIFI_SERVICE);
var wifiInfo = wifiManager.getConnectionInfo();
var isWifiEnabled = wifiManager.isWifiEnabled();
var hasIpAddress = wifiInfo.getIpAddress() !== 0;
var isWifiConnected = isWifiEnabled && hasIpAddress;
if (isWifiConnected) {    
    console.info("WiFi connected:", wifiInfo.getSSID());
} else {
    console.info("WiFi not connected");
}
