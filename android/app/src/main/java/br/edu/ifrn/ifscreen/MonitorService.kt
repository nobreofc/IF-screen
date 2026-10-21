package br.edu.ifrn.ifscreen

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import java.util.concurrent.Executors

/**
 * Serviço permanente em segundo plano (primeiro plano, com notificação fixa).
 * - grava o registro próprio de tela (ligada / desligada / desbloqueio);
 * - recalcula e sincroniza a cada 15 min e logo após o desbloqueio (se a última foi há mais de 10 min);
 * - dispara a notificação diária do questionário.
 * Mesmo que o sistema encerre o serviço, nada se perde: o cálculo usa o registro de eventos do Android.
 */
class MonitorService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val exec = Executors.newSingleThreadExecutor()
    private var receiver: BroadcastReceiver? = null

    private val tick = object : Runnable {
        override fun run() {
            background("tick")
            handler.postDelayed(this, TICK_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        running = true
        Notifier.createChannels(this)
        startInForeground()
        OwnLog.append(this, OwnLog.SVC)
        val r = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                when (i.action) {
                    Intent.ACTION_SCREEN_ON -> OwnLog.append(c, OwnLog.ON)
                    Intent.ACTION_SCREEN_OFF -> OwnLog.append(c, OwnLog.OFF)
                    Intent.ACTION_USER_PRESENT -> {
                        OwnLog.append(c, OwnLog.PRESENT)
                        if (System.currentTimeMillis() - Prefs(c).lastSyncAt > 10 * 60_000L) background("unlock")
                        else exec.execute { safe { Notifier.checkQuestionnaire(c) } }
                    }
                }
            }
        }
        val f = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_USER_PRESENT)
        }
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(r, f, Context.RECEIVER_NOT_EXPORTED) else registerReceiver(r, f)
        receiver = r
        handler.postDelayed(tick, 5_000)
    }

    private fun startInForeground() {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val n: Notification = Notification.Builder(this, Notifier.CH_MONITOR)
            .setSmallIcon(R.drawable.ic_stat_ifscreen)
            .setContentTitle("IF Screen ativo")
            .setContentText("Medindo o tempo de tela para a pesquisa")
            .setOngoing(true)
            .setShowWhen(false)
            .setContentIntent(open)
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF_ID, n)
        }
    }

    private fun background(reason: String) {
        exec.execute {
            safe { SyncManager.syncNow(applicationContext, reason) }
            safe { Notifier.checkQuestionnaire(applicationContext) }
            safe { OwnLog.prune(applicationContext) }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_SYNC) background("manual")
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        handler.removeCallbacksAndMessages(null)
        receiver?.let { try { unregisterReceiver(it) } catch (_: Exception) { } }
        exec.shutdown()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val NOTIF_ID = 1001
        const val TICK_MS = 15 * 60_000L
        const val ACTION_SYNC = "br.edu.ifrn.ifscreen.SYNC"

        @Volatile
        var running = false

        /** Inicia o serviço (permitido em primeiro plano, no boot e após atualização do app). */
        fun ensureRunning(ctx: Context, sync: Boolean = false) {
            val i = Intent(ctx, MonitorService::class.java)
            if (sync) i.action = ACTION_SYNC
            try { ctx.startForegroundService(i) } catch (_: Exception) { /* Android 12+ bloqueia início em segundo plano: o WorkManager cobre */ }
        }
    }
}

inline fun safe(block: () -> Unit) {
    try { block() } catch (_: Throwable) { }
}
