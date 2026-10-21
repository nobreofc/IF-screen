package android.content; import android.net.Uri;
public class Intent { public static final String ACTION_MAIN="m",CATEGORY_HOME="h",ACTION_SCREEN_ON="on",ACTION_SCREEN_OFF="off",ACTION_USER_PRESENT="up",ACTION_BOOT_COMPLETED="b",ACTION_MY_PACKAGE_REPLACED="r";
 public static final int FLAG_ACTIVITY_NEW_TASK=1, FLAG_ACTIVITY_CLEAR_TOP=2;
 public Intent(Context c, Class<?> k){} public Intent(String a){} public Intent(String a, Uri u){}
 public Intent addCategory(String c){return this;} public Intent putExtra(String k,String v){return this;} public Intent addFlags(int f){return this;}
 public Intent setAction(String a){return this;} public String getAction(){return null;} public String getStringExtra(String k){return null;} }