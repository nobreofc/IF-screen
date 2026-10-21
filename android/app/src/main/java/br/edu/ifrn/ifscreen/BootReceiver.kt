package br.edu.ifrn.ifscreen

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Reinicia o monitoramento após ligar o celular / atualizar o app, e trata os alarmes do questionário. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> {
                if (intent.action == Intent.ACTION_BOOT_COMPLETED) OwnLog.append(ctx, OwnLog.BOOT)
                MonitorService.ensureRunning(ctx)
                SyncWorker.schedule(ctx)
                Notifier.scheduleAlarms(ctx)
            }
            Notifier.ACTION_ALARM -> {
                val pending = goAsync()
                Thread {
                    safe { Notifier.checkQuestionnaire(ctx.applicationContext) }
                    pending.finish()
                }.start()
            }
        }
    }
}
