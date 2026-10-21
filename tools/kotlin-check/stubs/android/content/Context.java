package android.content;
import android.content.res.Resources;
public class Context {
 public static final String CLIPBOARD_SERVICE="a",NOTIFICATION_SERVICE="b",POWER_SERVICE="c",USAGE_STATS_SERVICE="d",APP_OPS_SERVICE="e",KEYGUARD_SERVICE="f",CONNECTIVITY_SERVICE="g",BATTERY_SERVICE="h",ALARM_SERVICE="i";
 public static final int MODE_PRIVATE=0, RECEIVER_NOT_EXPORTED=4;
 public Object getSystemService(String n){return null;}
 public SharedPreferences getSharedPreferences(String n,int m){return null;}
 public Context getApplicationContext(){return this;}
 public java.io.File getFilesDir(){return null;}
 public String getPackageName(){return "";}
 public android.content.pm.PackageManager getPackageManager(){return null;}
 public ContentResolver getContentResolver(){return null;}
 public Intent registerReceiver(BroadcastReceiver r, IntentFilter f){return null;}
 public Intent registerReceiver(BroadcastReceiver r, IntentFilter f, int flags){return null;}
 public void unregisterReceiver(BroadcastReceiver r){}
 public ComponentName startForegroundService(Intent i){return null;}
 public void startActivity(Intent i){}
 public final int getColor(int id){return 0;}
 public int checkSelfPermission(String p){return 0;}
 public Resources getResources(){return null;}
}