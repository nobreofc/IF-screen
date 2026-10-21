package org.json; public class JSONObject { public JSONObject(){} public JSONObject(String s) throws JSONException {}
 public JSONObject put(String k, boolean v) throws JSONException {return this;} public JSONObject put(String k, double v) throws JSONException {return this;} public JSONObject put(String k, int v) throws JSONException {return this;}
 public JSONObject put(String k, long v) throws JSONException {return this;} public JSONObject put(String k, Object v) throws JSONException {return this;}
 public String optString(String k){return "";} public String optString(String k, String d){return d;} public long optLong(String k){return 0;} public long optLong(String k, long d){return d;}
 public int optInt(String k){return 0;} public int optInt(String k,int d){return d;} public boolean optBoolean(String k){return false;} public boolean optBoolean(String k, boolean d){return d;}
 public JSONObject optJSONObject(String k){return null;} public JSONArray optJSONArray(String k){return null;} public String getString(String k) throws JSONException {return "";}
 public long getLong(String k) throws JSONException {return 0;} public JSONArray getJSONArray(String k) throws JSONException {return null;} public boolean has(String k){return false;}
 public java.util.Iterator<String> keys(){return null;} }