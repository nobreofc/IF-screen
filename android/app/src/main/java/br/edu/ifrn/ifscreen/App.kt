package br.edu.ifrn.ifscreen

import android.app.Application

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Prefs(this).ensureIdentity()
        Notifier.createChannels(this)
        SyncWorker.schedule(this)
        Notifier.scheduleAlarms(this)
    }
}
