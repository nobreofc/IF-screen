package android.app; import android.content.Context;
public class Notification { public static class Builder { public Builder(Context c, String ch){}
 public Builder setSmallIcon(int i){return this;} public Builder setContentTitle(CharSequence t){return this;} public Builder setContentText(CharSequence t){return this;}
 public Builder setOngoing(boolean b){return this;} public Builder setShowWhen(boolean b){return this;} public Builder setContentIntent(PendingIntent p){return this;}
 public Builder setStyle(Style s){return this;} public Builder setAutoCancel(boolean b){return this;} public Builder setColor(int c){return this;} public Notification build(){return null;} }
 public static abstract class Style {} public static class BigTextStyle extends Style { public BigTextStyle bigText(CharSequence c){return this;} } }