package android.app; import android.content.*; import android.os.Bundle; import android.view.View;
public class Activity extends Context { protected void onCreate(Bundle b){} protected void onResume(){} protected void onPause(){}
 public void setContentView(int id){} public <T extends View> T findViewById(int id){return null;}
 public void onRequestPermissionsResult(int rc, String[] p, int[] g){} public final void requestPermissions(String[] p,int rc){}
 public final void runOnUiThread(Runnable r){} public boolean isFinishing(){return false;} public Intent getIntent(){return null;} public void finish(){} }