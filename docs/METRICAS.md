# IF Screen — Métricas: o que é usado e o que é descartado

Algoritmo **ifs-unlock-1**. Definição operacional: **tempo de tela = soma dos intervalos em que o celular está desbloqueado e com a tela ligada.** Cada sessão começa no desbloqueio e termina quando a tela apaga, o aparelho bloqueia ou desliga. Sessões que cruzam a meia-noite são divididas entre os dias (fuso do aparelho).

## O que conta

| Situação | Decisão | Por quê |
|---|---|---|
| Uso de qualquer app após desbloquear (inclui ligação com tela acesa, vídeo, jogos e o próprio IF Screen) | **Conta** | É o comportamento-alvo e o que o padrão-ouro registra |
| Tela inicial (launcher) após desbloquear | **Conta** e é medida à parte | Permite a variante “sem tela inicial” na análise de sensibilidade |
| Celular sem senha/bloqueio, tela ligada | **Conta** | Sem bloqueio, tela ligada = uso |
| Sessão contínua acima de 4 h | **Conta** e é sinalizada | Pode ser vídeo longo; fica marcada para inspeção, nunca é apagada automaticamente |

## O que é descartado

| Situação | Decisão | Por quê |
|---|---|---|
| Notificação acende a tela sem desbloqueio | **Descarta** | Não há uso; descartada na origem (não por filtro posterior) |
| Tela de bloqueio, Always-On Display, relógio/widgets da tela bloqueada | **Descarta** | Aparelho bloqueado |
| Tempo digitando PIN/padrão ou esperando a biometria | **Descarta** | A contagem começa no desbloqueio efetivo |
| Ligação, música ou vídeo com a tela apagada | **Descarta** | Tela desligada |
| Aparelho desligado ou sem bateria | **Descarta** | Registrado à parte como “tempo desligado” |

## Fontes de dados (coleta independente)

1. **Registro de eventos do sistema** (`UsageStatsManager`): tela ligada/desligada (eventos 15/16), bloqueio exibido/oculto (17/18), desligamento/inicialização (26/27) e, apenas para separar a tela inicial, app em primeiro plano (1/2/23). O Android grava esses eventos mesmo com o app encerrado; o IF Screen os lê e aplica **o seu próprio algoritmo** — não copia números do Bem-estar Digital.
2. **Registro próprio em tempo real**: o serviço do app grava `SCREEN_ON`, `SCREEN_OFF` e `USER_PRESENT` (desbloqueio). Serve de conferência cruzada e de reserva se o acesso aos dados de uso for retirado.

Nada além de horários de início e fim das sessões sai do celular: nenhum nome de app, conteúdo, mensagem, foto ou localização.

## Indicadores de qualidade enviados à Central

dia completo (24 h cobertas) · cobertura parcial · tempo desligado · sessões > 4 h · fonte (sistema ou registro próprio) · diferença para o registro próprio · permissões (acesso ao uso, notificações, bateria) · data/hora automática · versão do app e do algoritmo.

## Dia válido

Entra nas médias o dia **completo**: terminou e o registro cobre de 00:00 a 23:59. Dias em andamento ou com cobertura parcial aparecem marcados e ficam fora das médias.

## Concordância com o padrão-ouro

X = IF Screen (truncado ao minuto, como o Bem-estar Digital exibe); Y = Bem-estar Digital do mesmo aparelho, mesmo dia. Estatísticas: viés médio (X − Y) com IC95%, limites de concordância de Bland-Altman para medidas repetidas (Bland & Altman, 2007), erro absoluto médio, % de dias com |X − Y| ≤ 1, 5 e 15 min, Pearson e correlação de medidas repetidas (Bland & Altman, 1995). Referência de aceitabilidade: ±15 min/dia em 95% dos casos (Kristensen et al., 2022); meta do IF Screen: ±5 min.
