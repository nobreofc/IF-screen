package br.edu.ifrn.ifscreen

import android.app.Activity
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.NumberPicker
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.TextView
import android.widget.Toast
import java.time.LocalDate

/** Questionário diário: uso de TV e de computador no dia anterior (recordatório de 24 h). */
class QuestionnaireActivity : Activity() {
    private lateinit var refDate: LocalDate
    private val minuteSteps = (0..55 step 5).toList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_questionnaire)
        refDate = intent.getStringExtra("refDate")?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
            ?: DayStore.today().minusDays(1)
        findViewById<TextView>(R.id.txtRefDate).text = "Sobre ontem: ${Ui.longDay(refDate)}"

        setupBlock(R.id.rgTv, R.id.rbTvYes, R.id.boxTvTime, R.id.npTvH, R.id.npTvM)
        setupBlock(R.id.rgPc, R.id.rbPcYes, R.id.boxPcTime, R.id.npPcH, R.id.npPcM)

        val existing = DayStore.loadQ(this, refDate.toString())
        if (existing != null) {
            fill(existing.tv, existing.tvMin, R.id.rbTvYes, R.id.rbTvNo, R.id.npTvH, R.id.npTvM)
            fill(existing.pc, existing.pcMin, R.id.rbPcYes, R.id.rbPcNo, R.id.npPcH, R.id.npPcM)
            val st = findViewById<TextView>(R.id.txtQStatus)
            st.visibility = View.VISIBLE
            st.text = "Você já respondeu. Pode corrigir até o fim de hoje."
            findViewById<Button>(R.id.btnSubmit).text = "Salvar correção"
        }
        // só é possível alterar a resposta até o fim do dia seguinte ao dia de referência
        if (DayStore.today().isAfter(refDate.plusDays(1))) {
            findViewById<Button>(R.id.btnSubmit).isEnabled = false
            val st = findViewById<TextView>(R.id.txtQStatus)
            st.visibility = View.VISIBLE
            st.text = "O prazo para responder sobre este dia terminou."
        }
        findViewById<Button>(R.id.btnSubmit).setOnClickListener { submit() }
    }

    private fun setupBlock(rg: Int, yes: Int, box: Int, npH: Int, npM: Int) {
        val h = findViewById<NumberPicker>(npH)
        h.minValue = 0; h.maxValue = 24; h.wrapSelectorWheel = false
        val m = findViewById<NumberPicker>(npM)
        m.minValue = 0; m.maxValue = minuteSteps.size - 1
        m.displayedValues = minuteSteps.map { it.toString().padStart(2, '0') }.toTypedArray()
        m.wrapSelectorWheel = true
        findViewById<RadioGroup>(rg).setOnCheckedChangeListener { _, id ->
            findViewById<View>(box).visibility = if (id == yes) View.VISIBLE else View.GONE
        }
    }

    private fun fill(used: Boolean, min: Int, yes: Int, no: Int, npH: Int, npM: Int) {
        findViewById<RadioButton>(if (used) yes else no).isChecked = true
        if (used) {
            findViewById<NumberPicker>(npH).value = minOf(24, min / 60)
            val idx = minuteSteps.indexOfFirst { it >= min % 60 }
            findViewById<NumberPicker>(npM).value = if (idx < 0) minuteSteps.size - 1 else idx
        }
    }

    /** Retorna (usou, minutos) ou null se a pergunta não foi respondida. */
    private fun read(yes: Int, no: Int, npH: Int, npM: Int): Pair<Boolean, Int>? {
        val y = findViewById<RadioButton>(yes).isChecked
        val n = findViewById<RadioButton>(no).isChecked
        if (!y && !n) return null
        if (n) return Pair(false, 0)
        val minutes = findViewById<NumberPicker>(npH).value * 60 + minuteSteps[findViewById<NumberPicker>(npM).value]
        return Pair(true, minOf(1440, minutes))
    }

    private fun submit() {
        val tv = read(R.id.rbTvYes, R.id.rbTvNo, R.id.npTvH, R.id.npTvM)
        val pc = read(R.id.rbPcYes, R.id.rbPcNo, R.id.npPcH, R.id.npPcM)
        if (tv == null || pc == null) {
            Toast.makeText(this, "Responda Sim ou Não nas duas perguntas", Toast.LENGTH_LONG).show(); return
        }
        if ((tv.first && tv.second == 0) || (pc.first && pc.second == 0)) {
            Toast.makeText(this, "Informe por quanto tempo (ou marque Não)", Toast.LENGTH_LONG).show(); return
        }
        val q = Questionnaire(refDate.toString(), tv.first, tv.second, pc.first, pc.second, System.currentTimeMillis())
        DayStore.saveQ(this, q)
        Notifier.cancel(this)
        Toast.makeText(this, "Obrigado! Resposta registrada.", Toast.LENGTH_LONG).show()
        Thread { safe { SyncManager.syncNow(applicationContext, "questionnaire") } }.start()
        finish()
    }
}
