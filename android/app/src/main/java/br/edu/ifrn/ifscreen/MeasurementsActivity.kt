package br.edu.ifrn.ifscreen

import android.app.Activity
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView

/** Modo teste: o tempo medido por dia, para comparar com o Bem-estar Digital do aparelho. */
class MeasurementsActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_measurements)
    }

    override fun onResume() {
        super.onResume()
        render()
        Thread {
            safe { DayStore.recompute(applicationContext) }
            runOnUiThread { if (!isFinishing) render() }
        }.start()
    }

    private fun render() {
        val list = findViewById<LinearLayout>(R.id.listDays)
        list.removeAllViews()
        val dp = resources.displayMetrics.density
        val today = DayStore.today()
        val first = DayStore.dateOf(Prefs(this).installAt)
        var d = today
        var i = 0
        while (!d.isBefore(first) && i < 14) {
            val r = DayStore.loadDay(this, d.toString())
            val row = LinearLayout(this)
            row.orientation = LinearLayout.HORIZONTAL
            row.gravity = Gravity.CENTER_VERTICAL
            row.setPadding(0, (12 * dp).toInt(), 0, (12 * dp).toInt())

            val left = LinearLayout(this)
            left.orientation = LinearLayout.VERTICAL
            val day = TextView(this)
            day.text = Ui.dayLabel(d)
            day.textSize = 16f
            day.setTypeface(day.typeface, Typeface.BOLD)
            day.setTextColor(getColor(R.color.ink))
            val sub = TextView(this)
            sub.textSize = 12.5f
            sub.setTextColor(getColor(R.color.muted))
            sub.text = when {
                r == null -> "sem dados"
                d == today -> "em andamento"
                r.complete -> "completo · ${r.sessions.size} sessões · sem tela inicial ${Ui.dur(r.screenMs - r.launcherMs)}"
                else -> "incompleto (cobertura parcial)"
            }
            left.addView(day)
            left.addView(sub)
            row.addView(left, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

            val v = TextView(this)
            v.text = Ui.dur(r?.screenMs)
            v.textSize = 18f
            v.setTypeface(v.typeface, Typeface.BOLD)
            v.setTextColor(getColor(if (r != null && r.complete) R.color.green_deep else R.color.ink2))
            row.addView(v)
            list.addView(row)

            val sep = View(this)
            sep.setBackgroundColor(getColor(R.color.line))
            list.addView(sep, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1))
            d = d.minusDays(1)
            i++
        }
        if (list.childCount > 0) list.removeViewAt(list.childCount - 1)
    }
}
