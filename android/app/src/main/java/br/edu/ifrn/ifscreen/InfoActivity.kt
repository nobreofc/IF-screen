package br.edu.ifrn.ifscreen

import android.app.Activity
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Tela "Saber mais": explica a pesquisa, o que é (e o que não é) coletado,
 * os direitos do participante pela LGPD e as medidas de segurança — com um
 * resumo da situação de segurança deste aparelho.
 */
class InfoActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_info)
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        val list = findViewById<LinearLayout>(R.id.listInfo)
        list.removeAllViews()

        card(list, "Sobre o IF Screen",
            "O IF Screen é um aplicativo de pesquisa do Instituto Federal do Rio Grande do Norte (IFRN). " +
                "Ele faz parte do projeto “Associação entre aptidão física e desempenho cognitivo e acadêmico em " +
                "adolescentes da rede federal de ensino”, coordenado pelo Prof. Rodrigo Ramalho Aniceto.\n\n" +
                "O objetivo é medir quanto tempo você passa com o celular desbloqueado, para estudar a relação " +
                "entre o uso de telas e o desempenho escolar.")

        card(list, "Como a medição funciona",
            "• A contagem começa quando você desbloqueia o celular e para quando a tela apaga ou o celular bloqueia.\n" +
                "• Notificações que acendem a tela sem desbloqueio não contam.\n" +
                "• A medição roda sozinha, em segundo plano. Você não precisa abrir o app nem mandar prints.\n" +
                "• A notificação fixa “IF Screen ativo” mostra que a medição está ligada.")

        card(list, "O que é coletado",
            "• O horário de início e de fim de cada uso (do desbloqueio até a tela apagar) e o total de cada dia.\n" +
                "• As suas respostas do questionário diário (TV e computador).\n" +
                "• Dados técnicos para conferir a qualidade da medição: modelo do celular, versão do Android, " +
                "permissões concedidas e se a economia de bateria está ativa.")

        card(list, "O que nunca é coletado",
            "Nomes dos aplicativos que você usa, mensagens, conversas, fotos, vídeos, contatos, sites visitados, " +
                "senhas, localização, áudio e câmera. O IF Screen não lê o conteúdo da tela.\n\n" +
                "Para separar o tempo na tela inicial, o app verifica dentro do próprio celular se ela está aberta. " +
                "Essa verificação não sai do aparelho.")

        card(list, "Por que não pedimos prints",
            "Em muitas pesquisas, o participante precisa abrir o Bem-estar Digital e enviar prints do tempo de tela. " +
                "O IF Screen calcula o tempo sozinho e envia só os números, de forma segura. Você não precisa fazer " +
                "nada, e os seus dados não passam por aplicativos de mensagem.")

        card(list, "Seus direitos (LGPD)",
            "A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) garante a você e ao seu responsável:\n" +
                "• saber quais dados são tratados e para quê;\n" +
                "• ver e corrigir os seus dados;\n" +
                "• pedir a exclusão dos seus dados;\n" +
                "• retirar o consentimento e sair da pesquisa a qualquer momento, sem nenhum prejuízo.\n\n" +
                "Para exercer esses direitos, fale com a equipe da pesquisa no seu campus.")

        card(list, "Como protegemos os seus dados",
            "• A equipe identifica você por um código (ex.: P001), não pelo nome.\n" +
                "• Cada celular cria a sua própria chave secreta. Sem ela, ninguém consegue enviar dados em seu nome.\n" +
                "• Fora da escola, os dados viajam criptografados (HTTPS) até um servidor que só os guarda até a " +
                "Central confirmar o recebimento.\n" +
                "• Os dados ficam no computador da equipe da pesquisa. Só os pesquisadores têm acesso.\n" +
                "• Os resultados são publicados em grupo, sem identificar ninguém.")

        securityCard(list)

        card(list, "Como sair do estudo",
            "Avise a equipe da pesquisa. Ao desinstalar o IF Screen, a medição para na hora e os dados guardados " +
                "no celular são apagados. Se quiser que os dados já enviados também sejam apagados, peça à equipe: " +
                "a Central tem a opção “Excluir dados”.")

        card(list, "Equipe",
            "Coordenação: Prof. Rodrigo Ramalho Aniceto (IFRN)\n" +
                "Desenvolvimento: Daniel Reginaldo da Silva (IFRN)\n\n" +
                "IF Screen ${BuildConfig.VERSION_NAME} · algoritmo ${DayResult.ALGO}")
    }

    /** Situação de segurança deste aparelho, calculada na hora. */
    private fun securityCard(list: LinearLayout) {
        val p = Prefs(this)
        val box = newCard(list, "Segurança deste aparelho")

        val relay = p.relayUrl.trim()
        val (relayTxt, relayOk) = when {
            relay.isBlank() -> "não configurada" to true
            relay.startsWith("https://") -> "criptografada (HTTPS)" to true
            else -> "sem criptografia — avise a equipe" to false
        }
        val local = p.localUrl.isNotBlank()
        val usage = DayStore.hasUsageAccess(this)

        row(box, "Identificação", p.code, true)
        row(box, "Vínculo", when {
            p.removedFromStudy -> "retirado do estudo"
            p.linked -> "vinculado à Central"
            else -> "aguardando vínculo"
        }, !p.removedFromStudy)
        row(box, "Chave secreta", "guardada só neste celular", true)
        row(box, "Conexão pela nuvem", relayTxt, relayOk)
        row(box, "Conexão pela rede local", if (local) "Wi-Fi da pesquisa" else "não usada", true)
        row(box, "Acesso aos dados de uso", if (usage) "concedido (só eventos de tela)" else "não concedido", usage)
        row(box, "Último envio", if (p.lastSyncAt > 0) Ui.ago(p.lastSyncAt) else "ainda não", true)

        val note = TextView(this)
        note.text = "A rede local da escola não usa criptografia. Por isso, use apenas a rede Wi-Fi indicada pela equipe da pesquisa."
        note.setTextSize(12.5f)
        note.setTextColor(getColor(R.color.muted))
        note.setLineSpacing(2f * dp(), 1f)
        note.setPadding(0, dp(10), 0, 0)
        box.addView(note)
    }

    // ---------------------------------------------------------------- construção dos cartões
    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()
    private fun dp(): Float = resources.displayMetrics.density

    private fun newCard(list: LinearLayout, title: String): LinearLayout {
        val box = LinearLayout(this)
        box.orientation = LinearLayout.VERTICAL
        box.setBackgroundResource(R.drawable.bg_card)
        box.setPadding(dp(18), dp(16), dp(18), dp(16))
        val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        lp.setMargins(0, dp(14), 0, 0)
        list.addView(box, lp)

        val t = TextView(this)
        t.text = title
        t.setTextSize(16f)
        t.setTypeface(t.typeface, Typeface.BOLD)
        t.setTextColor(getColor(R.color.green_deep))
        box.addView(t)
        return box
    }

    private fun card(list: LinearLayout, title: String, body: String) {
        val box = newCard(list, title)
        val b = TextView(this)
        b.text = body
        b.setTextSize(14f)
        b.setTextColor(getColor(R.color.ink2))
        b.setLineSpacing(3f * dp(), 1f)
        b.setPadding(0, dp(6), 0, 0)
        box.addView(b)
    }

    private fun row(box: LinearLayout, label: String, value: String, ok: Boolean) {
        val r = LinearLayout(this)
        r.orientation = LinearLayout.HORIZONTAL
        r.gravity = Gravity.CENTER_VERTICAL
        r.setPadding(0, dp(8), 0, 0)

        val l = TextView(this)
        l.text = label
        l.setTextSize(13.5f)
        l.setTextColor(getColor(R.color.muted))
        r.addView(l, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

        val v = TextView(this)
        v.text = (if (ok) "✓ " else "! ") + value
        v.setTextSize(13.5f)
        v.setTypeface(v.typeface, Typeface.BOLD)
        v.setTextColor(getColor(if (ok) R.color.green_dark else R.color.red))
        v.gravity = Gravity.END
        r.addView(v, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.3f))
        box.addView(r)

        val sep = View(this)
        sep.setBackgroundColor(getColor(R.color.line))
        val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1)
        lp.setMargins(0, dp(8), 0, 0)
        box.addView(sep, lp)
    }
}
