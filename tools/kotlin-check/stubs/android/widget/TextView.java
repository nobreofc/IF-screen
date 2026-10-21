package android.widget; import android.content.Context; import android.view.View; import android.graphics.Typeface;
public class TextView extends View { public TextView(Context c){super(c);} public void setText(CharSequence t){} public CharSequence getText(){return null;} public void setTextColor(int c){}
 public void setTextSize(float s){} public float getTextSize(){return 0;} public Typeface getTypeface(){return null;} public void setTypeface(Typeface t,int s){} public void setTypeface(Typeface t){}
 public void setHint(CharSequence h){} public CharSequence getHint(){return null;} public void setInputType(int t){} public int getInputType(){return 0;}
 public void setEnabled(boolean e){} public boolean isEnabled(){return true;} }