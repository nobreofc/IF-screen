package br.edu.ifrn.ifscreen

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/** Rede de segurança: a cada 15 min recalcula, sincroniza e confere o questionário, mesmo se o serviço for encerrado. */
class SyncWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        val c = applicationContext
        if (!MonitorService.running) MonitorService.ensureRunning(c)
        safe { SyncManager.syncNow(c, "worker") }
        safe { Notifier.checkQuestionnaire(c) }
        return Result.success()
    }

    companion object {
        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequest.Builder(SyncWorker::class.java, 15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(ctx.applicationContext)
                .enqueueUniquePeriodicWork("ifscreen-sync", ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
