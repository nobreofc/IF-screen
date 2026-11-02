package android.view; import android.content.Context;
public class View { public static final int VISIBLE=0, GONE=8; public View(Context c){}
 public void setVisibility(int v){} public int getVisibility(){return 0;} public void setBackgroundColor(int c){} public void setBackgroundResource(int r){} public void setPadding(int l,int t,int r,int b){}
 public void setOnClickListener(OnClickListener l){} public interface OnClickListener { void onClick(View v); } }