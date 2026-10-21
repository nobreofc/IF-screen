package br.edu.ifrn.ifscreen

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.URL

class HttpResult(val status: Int, val body: JSONObject)

object Http {
    fun call(base: String, method: String, path: String, body: JSONObject?, headers: Map<String, String>, timeoutMs: Int = 10_000): HttpResult {
        val conn = URL(base + path).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.connectTimeout = minOf(timeoutMs, 6_000)
            conn.readTimeout = timeoutMs
            conn.useCaches = false
            conn.setRequestProperty("Accept", "application/json")
            for ((k, v) in headers) conn.setRequestProperty(k, v)
            if (body != null) {
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.setFixedLengthStreamingMode(bytes.size)
                conn.outputStream.use { it.write(bytes) }
            }
            val code = conn.responseCode
            val stream = if (code >= 400) conn.errorStream else conn.inputStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            val json = try { if (text.isBlank()) JSONObject() else JSONObject(text) } catch (e: Exception) { JSONObject() }
            return HttpResult(code, json)
        } finally {
            conn.disconnect()
        }
    }
}

/** Descoberta da Central na rede local por broadcast UDP (porta 8788). */
object Discovery {
    private const val PORT = 8788

    fun onLocalNetwork(ctx: Context): Boolean {
        val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
    }

    fun discover(ctx: Context, timeoutMs: Int = 1500): String? {
        if (!onLocalNetwork(ctx)) return null
        return try {
            DatagramSocket().use { s ->
                s.broadcast = true
                s.soTimeout = timeoutMs
                val msg = "IFSCREEN_DISCOVER".toByteArray()
                for (addr in broadcastAddresses()) {
                    try { s.send(DatagramPacket(msg, msg.size, addr, PORT)) } catch (_: Exception) { }
                }
                val buf = ByteArray(2048)
                val p = DatagramPacket(buf, buf.size)
                s.receive(p)
                val o = JSONObject(String(p.data, 0, p.length, Charsets.UTF_8))
                if (o.optString("service") != "ifscreen-central") null
                else "http://${p.address.hostAddress}:${o.optInt("port", 8787)}"
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun broadcastAddresses(): List<InetAddress> {
        val out = ArrayList<InetAddress>()
        try {
            val ifs = NetworkInterface.getNetworkInterfaces()
            while (ifs.hasMoreElements()) {
                val ni = ifs.nextElement()
                if (!ni.isUp || ni.isLoopback) continue
                for (ia in ni.interfaceAddresses) {
                    val b = ia.broadcast
                    if (b != null) out.add(b)
                }
            }
        } catch (_: Exception) { }
        out.add(InetAddress.getByName("255.255.255.255"))
        return out
    }
}
