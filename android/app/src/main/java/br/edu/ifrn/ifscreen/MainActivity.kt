package br.edu.ifrn.ifscreen

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    private lateinit var prefs: Prefs
    private val handler = Handler(Looper.getMainLooper())
    private val refresher = object : Runnable {
        override fun run() {
            refresh()
            handler.postDelayed(this, 30_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        prefs = Prefs(this)
        prefs.ensureIdentity()

        findViewById<TextView>(R.id.txtCode).text = prefs.code
        findViewById<TextView>(R.id.txtVersion).text = "IF Screen ${BuildConfig.VERSION_NAME} · algoritmo ${DayResult.ALGO}"

        findViewById<Button>(R.id.btnCopy).setOnClickListener {
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("Código IF Screen", prefs.code))
            Toast.makeText(this, "Código copiado", Toast.LENGTH_SHORT).show()
        }
        findViewById<Button>(R.id.btnUsage).setOnClickListener { openUsageAccess() }
        findViewById<Button>(R.id.btnNotif).setOnClickListener {
            if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7)
            else openAppSettings()
        }
        findViewById<Button>(R.id.btnBattery).setOnClickListener {
            try {
                startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
            } catch (e: Exception) {
                openAppSettings()
            }
        }
        findViewById<Button>(R.id.btnAppSettings).setOnClickListener { openAppSettings() }
        findViewById<Button>(R.id.btnQuest).setOnClickListener {
            startActivity(Intent(this, QuestionnaireActivity::class.java))
        }
        findViewById<Button>(R.id.btnMeasure).setOnClickListener {
            startActivity(Intent(this, MeasurementsActivity::class.java))
        }
        findViewById<Button>(R.id.btnSync).setOnClickListener { syncInBackground(true) }
        findViewById<Button>(R.id.btnConn).setOnClickListener { showConnectionDialog() }

        MonitorService.ensureRunning(this)
    }

    override fun onResume() {
        super.onResume()
        refresh()
        handler.post(refresher)
        syncInBackground(false)
    }

    override fun onPause() {
        handler.removeCallbacks(refresher)
        super.onPause()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        refresh()
    }

    private fun openUsageAccess() {
        try {
            startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:$packageName")))
        } catch (e: Exception) {
            try { startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) } catch (_: Exception) { openAppSettings() }
        }
        Toast.makeText(this, "Encontre “IF Screen” na lista e ative a permissão", Toast.LENGTH_LONG).show()
    }

    private fun openAppSettings() {
        try {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        } catch (_: Exception) { }
    }

    private fun notifGranted(): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        return nm.areNotificationsEnabled()
    }

    private fun batteryOk(): Boolean {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(packageName)
    }

    private fun syncInBackground(manual: Boolean) {
        if (manual) Toast.makeText(this, "Sincronizando…", Toast.LENGTH_SHORT).show()
        Thread {
            val r = try { SyncManager.syncNow(applicationContext, if (manual) "manual" else "open") } catch (e: Exception) { null }
            runOnUiThread {
                if (!isFinishing) {
                    refresh()
                    if (manual && r != null) Toast.makeText(this, r.message, Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun refresh() {
        val usage = DayStore.hasUsageAccess(this)
        val notif = notifGranted()
        val battery = batteryOk()

        findViewById<View>(R.id.cardPerms).visibility = if (usage && notif && battery) View.GONE else View.VISIBLE
        findViewById<View>(R.id.btnUsage).visibility = if (usage) View.GONE else View.VISIBLE
        findViewById<View>(R.id.btnNotif).visibility = if (notif) View.GONE else View.VISIBLE
        findViewById<View>(R.id.btnBattery).visibility = if (battery) View.GONE else View.VISIBLE

        val link = findViewById<TextView>(R.id.txtLink)
        if (prefs.linked) {
            link.text = if (prefs.participant.isNotBlank()) "Vinculado · ${prefs.participant}" else "Vinculado"
            link.setTextColor(getColor(R.color.green_dark))
        } else {
            link.text = "Aguardando vínculo"
            link.setTextColor(getColor(R.color.amber))
        }

        val mon = findViewById<TextView>(R.id.txtMonitor)
        when {
            !usage -> { mon.text = "Permissão necessária"; mon.setTextColor(getColor(R.color.red)) }
            else -> { mon.text = "Ativo"; mon.setTextColor(getColor(R.color.green_dark)) }
        }

        val sync = findViewById<TextView>(R.id.txtSync)
        val ch = when (prefs.lastSyncChannel) { "local" -> " · rede local"; "relay" -> " · nuvem"; else -> "" }
        sync.text = if (prefs.lastSyncAt > 0) Ui.ago(prefs.lastSyncAt) + ch else "ainda não"
        sync.setTextColor(getColor(if (prefs.lastSyncAt > 0 && System.currentTimeMillis() - prefs.lastSyncAt < 3 * 3600_000L) R.color.ink else R.color.amber))

        val ref = DayStore.today().minusDays(1)
        val beforeInstall = ref.isBefore(DayStore.dateOf(prefs.installAt))
        val answered = DayStore.loadQ(this, ref.toString()) != null
        val q = findViewById<TextView>(R.id.txtQuest)
        val btnQ = findViewById<Button>(R.id.btnQuest)
        when {
            beforeInstall -> { q.text = "a partir de amanhã"; q.setTextColor(getColor(R.color.muted)); btnQ.visibility = View.GONE }
            answered -> { q.text = "Respondido ✓"; q.setTextColor(getColor(R.color.green_dark)); btnQ.visibility = View.VISIBLE; btnQ.text = "Rever resposta de ontem" }
            else -> { q.text = "Pendente"; q.setTextColor(getColor(R.color.amber)); btnQ.visibility = View.VISIBLE; btnQ.text = "Responder questionário de ontem" }
        }

        val showTest = prefs.showScreenTime || !prefs.linked
        findViewById<View>(R.id.cardTest).visibility = if (showTest) View.VISIBLE else View.GONE
        if (showTest) {
            val t = DayStore.loadDay(this, DayStore.today().toString())
            val y = DayStore.loadDay(this, ref.toString())
            findViewById<TextView>(R.id.txtToday).text = Ui.dur(t?.screenMs)
            findViewById<TextView>(R.id.txtYesterday).text = if (y == null) "—" else Ui.dur(y.screenMs) + if (y.complete) "" else "*"
        }
        findViewById<TextView>(R.id.txtHeaderSub).text =
            if (prefs.linked) "Conectado à ${prefs.centralName}" else "Monitoramento de tempo de tela"
    }

    private fun showConnectionDialog() {
        val pad = (16 * resources.displayMetrics.density).toInt()
        val box = LinearLayout(this)
        box.orientation = LinearLayout.VERTICAL
        box.setPadding(pad, pad / 2, pad, 0)

        val l1 = TextView(this)
        l1.text = "Central na rede local (in loco)"
        val local = EditText(this)
        local.hint = "ex.: 192.168.0.10:8787 (vazio = automático)"
        local.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
        local.setText(prefs.localUrl.removePrefix("http://"))

        val l2 = TextView(this)
        l2.text = "Servidor na nuvem (Railway)"
        l2.setPadding(0, pad, 0, 0)
        val relay = EditText(this)
        relay.hint = "https://…up.railway.app"
        relay.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
        relay.setText(prefs.relayUrl)

        val info = TextView(this)
        info.setPadding(0, pad, 0, 0)
        info.text = "Erro mais recente: ${prefs.lastSyncError.ifBlank { "nenhum" }}"
        info.setTextColor(getColor(R.color.muted))

        box.addView(l1); box.addView(local); box.addView(l2); box.addView(relay); box.addView(info)

        AlertDialog.Builder(this)
            .setTitle("Conexão com a Central")
            .setView(box)
            .setPositiveButton("Salvar") { _, _ ->
                var lv = local.text.toString().trim()
                if (lv.isNotEmpty() && !lv.startsWith("http")) lv = "http://$lv"
                if (lv.isNotEmpty() && !lv.substringAfter("://").contains(":")) lv = "$lv:8787"
                prefs.localUrl = lv
                prefs.relayUrl = relay.text.toString().trim()
                syncInBackground(true)
            }
            .setNeutralButton("Procurar na rede") { _, _ ->
                Toast.makeText(this, "Procurando a Central na rede Wi-Fi…", Toast.LENGTH_SHORT).show()
                Thread {
                    val found = Discovery.discover(applicationContext, 2500)
                    if (found != null) prefs.localUrl = found
                    runOnUiThread {
                        Toast.makeText(this, if (found != null) "Central encontrada: $found" else "Nenhuma Central encontrada nesta rede", Toast.LENGTH_LONG).show()
                        if (found != null) syncInBackground(true)
                    }
                }.start()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
