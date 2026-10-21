package android.view; import android.content.Context;
public abstract class ViewGroup extends View { public ViewGroup(Context c){super(c);} public void addView(View v){} public void addView(View v, LayoutParams p){} public void removeAllViews(){} public void removeViewAt(int i){} public int getChildCount(){return 0;}
 public static class LayoutParams { public static final int MATCH_PARENT=-1, WRAP_CONTENT=-2; public LayoutParams(int w,int h){} }
 public static class MarginLayoutParams extends LayoutParams { public MarginLayoutParams(int w,int h){super(w,h);} } }