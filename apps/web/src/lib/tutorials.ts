/**
 * Registro central de tutoriais — fonte única do tour guiado e da central de
 * ajuda.
 *
 * Toda tela do app precisa de uma entrada aqui. `scripts/check-tutorials.mjs`
 * roda no CI e falha quando uma rota nova aparece em `app/(platform)` sem
 * tutorial correspondente, então é impossível publicar uma tela sem explicar
 * para que ela serve — que é o mais perto de "atualizar sozinho" que dá para
 * garantir de verdade: o texto ainda é escrito por uma pessoa, mas o
 * esquecimento vira erro de build em vez de passar despercebido.
 *
 * Ao adicionar uma tela nova: acrescente a rota aqui com pelo menos um passo.
 */

export interface TourStep {
  /** Elemento a destacar, via data-tour="…". Ausente = balão centralizado. */
  target?: string;
  title: string;
  body: string;
}

export interface Tutorial {
  /** Rota exata, como aparece em app/(platform). */
  route: string;
  label: string;
  /** Resumo da tela na central de ajuda. */
  summary: string;
  steps: TourStep[];
}

export const TUTORIALS: Tutorial[] = [
  {
    route: "/overview",
    label: "Visão geral",
    summary:
      "O painel de entrada: patrimônio consolidado, evolução e os atalhos para o resto do app.",
    steps: [
      {
        title: "Bem-vindo ao InvestIQ",
        body:
          "Esta é a Visão geral — o resumo de tudo: quanto você tem investido, quanto entrou e saiu no mês e como o patrimônio evoluiu. Os números aqui são sempre consolidados, somando todas as suas carteiras.",
      },
      {
        target: "topbar-privacy",
        title: "Esconder valores",
        body:
          "Este botão troca todos os valores por pontinhos. Útil para abrir o app numa tela compartilhada ou numa reunião sem expor quanto você tem.",
      },
      {
        target: "topbar-period",
        title: "Período",
        body:
          "Muda a janela de tempo dos gráficos: último mês, seis meses, um ano ou tudo. A escolha vale para o app inteiro.",
      },
    ],
  },
  {
    route: "/finances",
    label: "Finanças pessoais",
    summary:
      "Receitas, despesas, contas a pagar e o saldo de cada carteira. É aqui que entra o dia a dia do dinheiro.",
    steps: [
      {
        title: "Suas finanças",
        body:
          "Aqui ficam os lançamentos do dia a dia: o que entrou, o que saiu, e o saldo de cada conta. Comece cadastrando uma carteira e lançando as primeiras transações.",
      },
      {
        target: "accounts-bar",
        title: "Carteiras",
        body:
          "Cada conta bancária é uma carteira, com um titular opcional — dá para administrar a sua e a de outra pessoa lado a lado. Clique numa carteira para filtrar a tela inteira só por ela; clique de novo para voltar ao consolidado.",
      },
      {
        target: "budgets-section",
        title: "Orçamentos",
        body:
          "Defina um teto de gasto por categoria. Cada carteira tem os seus próprios tetos: com uma carteira selecionada você edita os dela, e sem nenhuma edita o consolidado.",
      },
      {
        target: "new-transaction",
        title: "Novo lançamento",
        body:
          "Registra receita, despesa ou transferência entre carteiras. Se preencher um vencimento futuro, a conta entra como pendente e ganha um botão \"Pagar\" para confirmar depois.",
      },
    ],
  },
  {
    route: "/finances/planejamento",
    label: "Planejamento",
    summary: "Projeção de saldo dos próximos meses e as metas de poupança.",
    steps: [
      {
        title: "Planejamento",
        body:
          "A projeção estima o saldo dos próximos meses somando o que já é certo (recorrências, parcelas e faturas em aberto) com uma estimativa do resto, baseada na mediana dos seus últimos seis meses.",
      },
      {
        title: "Quando o saldo fica negativo",
        body:
          "Se a projeção cruzar o zero em algum mês, o gráfico avisa. É o número mais útil da tela: dá tempo de reagir antes de acontecer.",
      },
    ],
  },
  {
    route: "/finances/analise",
    label: "Análise financeira",
    summary: "Burn rate, taxa de poupança, fôlego e tendências por categoria.",
    steps: [
      {
        title: "Análise financeira",
        body:
          "Quatro números resumem sua saúde financeira: quanto você gasta por mês (burn rate), quanto sobra (taxa de poupança), por quantos meses o saldo aguenta sem receita (fôlego) e quais categorias subiram ou caíram.",
      },
      {
        title: "Tendência por categoria",
        body:
          "Cada categoria é comparada com a própria mediana de seis meses, não com a média — assim um seguro anual ou uma viagem não distorce o retrato.",
      },
    ],
  },
  {
    route: "/finances/importar",
    label: "Importar extrato",
    summary: "Traz lançamentos do banco por arquivo OFX ou CSV, sem digitar um a um.",
    steps: [
      {
        title: "Importar extrato",
        body:
          "Baixe o extrato do seu banco em OFX (ou CSV) e solte aqui. O app lê os lançamentos, sugere categorias e mostra tudo para você revisar antes de gravar.",
      },
      {
        title: "Duplicatas",
        body:
          "Importar o mesmo arquivo duas vezes não duplica nada: lançamentos já conhecidos vêm bloqueados, e os parecidos vêm desmarcados com o lançamento existente ao lado para você comparar.",
      },
    ],
  },
  {
    route: "/finances/cards",
    label: "Cartões de crédito",
    summary: "Faturas, limites e o lançamento das compras do cartão.",
    steps: [
      {
        title: "Cartões",
        body:
          "Cadastre seus cartões com limite e dia de vencimento para acompanhar as faturas. Dá para subir o PDF da fatura e deixar o app extrair as compras em vez de digitar.",
      },
    ],
  },
  {
    route: "/investments",
    label: "Investimentos",
    summary: "A carteira consolidada: posições, alocação, rentabilidade e proventos.",
    steps: [
      {
        title: "Sua carteira",
        body:
          "Aqui ficam suas posições com preço atual, lucro e prejuízo. Cadastre uma carteira, adicione os ativos e registre as compras — o app busca as cotações sozinho.",
      },
      {
        title: "Patrimônio internacional",
        body:
          "Ativos em moeda estrangeira aparecem num card próprio, com o valor na moeda original ao lado do equivalente em reais, em vez de só o valor já convertido.",
      },
    ],
  },
  {
    route: "/investments/[ticker]",
    label: "Detalhe do ativo",
    summary: "Gráfico, indicadores, fundamentos e análise por IA de um ativo.",
    steps: [
      {
        title: "Detalhe do ativo",
        body:
          "Gráfico de preços, indicadores técnicos e fundamentos do papel. Se você configurou uma chave de IA, o painel de análise interpreta esses dados em português.",
      },
    ],
  },
  {
    route: "/trader",
    label: "Trader",
    summary: "Mercado ao vivo, watchlist com mini-gráficos e alertas de preço.",
    steps: [
      {
        title: "Trader",
        body:
          "Acompanhe o mercado em tempo quase real: índices, câmbio e commodities no topo, e sua watchlist logo abaixo com um mini-gráfico da variação recente de cada papel.",
      },
      {
        title: "Alertas de preço",
        body:
          "Crie um alerta e o app avisa quando o papel cruzar o preço escolhido, sem você precisar ficar olhando a tela.",
      },
    ],
  },
  {
    route: "/transactions",
    label: "Transações",
    summary: "Todos os lançamentos num só lugar, com busca e filtros.",
    steps: [
      {
        title: "Transações",
        body:
          "A lista completa dos seus lançamentos, de todas as carteiras. Use a busca e os filtros para achar um lançamento específico; clique numa linha para ver o detalhe e o histórico da categoria.",
      },
    ],
  },
  {
    route: "/goals",
    label: "Metas",
    summary: "Objetivos de poupança com aportes e acompanhamento do progresso.",
    steps: [
      {
        title: "Metas",
        body:
          "Defina um objetivo com valor e prazo — uma reserva de emergência, uma viagem — e registre aportes. O app mostra o quanto falta e se o ritmo atual chega lá no prazo.",
      },
    ],
  },
  {
    route: "/reports",
    label: "Relatórios",
    summary: "Exporta o consolidado do mês em PDF ou Excel.",
    steps: [
      {
        title: "Relatórios",
        body:
          "Gera um documento com suas finanças e investimentos do mês. Escolha PDF para ler e arquivar, ou Excel se quiser continuar a conta na planilha.",
      },
      {
        target: "report-builder",
        title: "Montar o relatório",
        body:
          "Abre uma tela onde você escolhe período, formato e o que entra: finanças, investimentos e gráficos. Uma prévia mostra o que vai sair antes de gerar. Se as carteiras de investimento não são suas, é só desmarcar a seção. O mesmo botão existe nas telas de Finanças e de Investimentos.",
      },
    ],
  },
  {
    route: "/analysis",
    label: "Análise por IA",
    summary: "Leitura da sua carteira feita por um modelo de linguagem.",
    steps: [
      {
        title: "Análise por IA",
        body:
          "Pede a um modelo de IA uma leitura da sua carteira: concentração, riscos e pontos de atenção. Precisa de uma chave de API configurada — veja o tutorial na Central de ajuda.",
      },
    ],
  },
  {
    route: "/settings",
    label: "Configurações",
    summary: "Conta, aparência, fonte de cotações, chaves de IA e sessões ativas.",
    steps: [
      {
        title: "Configurações",
        body:
          "Aqui você escolhe o tema, a cor de destaque e o tamanho da fonte, define de onde vêm as cotações e cadastra suas chaves de IA.",
      },
      {
        target: "settings-ai",
        title: "Chaves de IA",
        body:
          "As análises por IA usam a SUA chave — ela é criptografada e nunca exibida de volta. A Central de ajuda tem o passo a passo para obter uma chave gratuita do Gemini.",
      },
    ],
  },
  {
    route: "/ajuda",
    label: "Central de ajuda",
    summary: "Tutoriais passo a passo e o que cada tela do app faz.",
    steps: [
      {
        title: "Central de ajuda",
        body:
          "Todos os tutoriais ficam aqui: como configurar a IA, como obter o token de cotações e o que cada tela faz. Use a busca para achar um assunto, ou o botão no fim da página para refazer o tour guiado.",
      },
    ],
  },
  {
    route: "/mobile-preview",
    label: "App mobile",
    summary: "Prévia de como as telas principais ficam no celular.",
    steps: [
      {
        title: "App mobile",
        body:
          "Uma prévia das telas principais no formato de celular, para conferir como o app fica na tela pequena.",
      },
    ],
  },
];

export const TUTORIALS_BY_ROUTE: Record<string, Tutorial> = Object.fromEntries(
  TUTORIALS.map((t) => [t.route, t])
);

/** Casa a rota atual com o tutorial mais específico (prefixo mais longo),
 * mesmo padrão que a sidebar usa para marcar o item ativo. */
export function tutorialForPath(pathname: string): Tutorial | undefined {
  const exact = TUTORIALS_BY_ROUTE[pathname];
  if (exact) return exact;
  return TUTORIALS.filter((t) => !t.route.includes("[") && pathname.startsWith(t.route)).sort(
    (a, b) => b.route.length - a.route.length
  )[0];
}

// ---------------------------------------------------------------------------
// Artigos da central de ajuda — passo a passo que não pertence a uma tela só.
// ---------------------------------------------------------------------------

export interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  note?: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "gemini",
    title: "Configurar a IA do Google (Gemini) — gratuito",
    summary:
      "As análises por IA usam a sua própria chave, então nada é cobrado do app e seus dados não passam por terceiros. O Gemini tem um nível gratuito que já dá conta.",
    steps: [
      "Abra o Google AI Studio em aistudio.google.com e entre com sua conta Google.",
      "No menu à esquerda, clique em \"Get API key\" (ou \"Obter chave de API\").",
      "Clique em \"Create API key\" e escolha um projeto — se não tiver nenhum, o próprio site cria um para você.",
      "Copie a chave gerada. Ela aparece uma única vez; se perder, é só gerar outra.",
      "No InvestIQ, vá em Configurações → Inteligência artificial.",
      "Escolha \"Gemini (Google)\" como provedor preferido.",
      "Cole a chave no campo \"Gemini (Google)\" e clique em Salvar.",
      "Pronto: abra a tela de Análise ou o painel de IA de um ativo para usar.",
    ],
    note:
      "A chave é guardada criptografada e nunca é exibida de volta — nem para você. Para trocar, basta colar uma nova por cima. O campo \"Modelo\" pode ficar vazio: sem ele o app usa um modelo rápido e barato por padrão.",
  },
  {
    id: "brapi",
    title: "Cotações da B3 com token da Brapi — gratuito",
    summary:
      "Ações brasileiras funcionam sem configurar nada, mas um token gratuito da Brapi deixa as cotações mais estáveis e completas.",
    steps: [
      "Acesse brapi.dev e crie uma conta gratuita.",
      "No painel, copie o seu token de acesso.",
      "No InvestIQ, vá em Configurações → Dados de mercado.",
      "Cole o token em \"Token Brapi (gratuito)\" e clique em Salvar.",
      "Se quiser que a Brapi seja a fonte principal, selecione \"Brapi (B3)\" como provedor.",
    ],
    note:
      "Mesmo sem token o app funciona: ele tenta o Yahoo Finance primeiro e usa a Brapi como reserva. O token só melhora a cobertura de papéis brasileiros.",
  },
  {
    id: "primeiros-passos",
    title: "Primeiros passos: do zero ao painel completo",
    summary: "A ordem que evita retrabalho quando você está começando.",
    steps: [
      "Em Finanças, cadastre suas carteiras (uma por conta bancária). Se administra a conta de outra pessoa, preencha o campo Titular.",
      "Ainda em Finanças, importe um extrato em OFX pela aba Importar — é bem mais rápido que digitar lançamento por lançamento.",
      "Revise as categorias sugeridas na tela de importação. O app aprende: corrigiu uma vez, acerta nas próximas.",
      "Defina orçamentos por categoria para as carteiras que você quer controlar de perto.",
      "Em Investimentos, crie uma carteira e cadastre suas posições com as compras que você já fez.",
      "Em Configurações, ajuste o tema e a cor de destaque, e cadastre uma chave de IA se quiser as análises automáticas.",
    ],
  },
  {
    id: "carteiras",
    title: "Como as carteiras funcionam",
    summary:
      "Carteiras são independentes em tudo: saldo, orçamento, taxa de poupança, projeção e relatório.",
    steps: [
      "Em Finanças, clique numa carteira no card de contas para filtrar a tela inteira só por ela.",
      "Com a carteira selecionada, o resumo, os gráficos, a projeção, a análise e os orçamentos passam a mostrar só os dados dela.",
      "Clique na carteira de novo (ou em \"Todas\") para voltar à visão consolidada.",
      "Orçamentos seguem o mesmo recorte: com uma carteira ativa você edita os tetos dela; sem nenhuma, edita os consolidados.",
      "Em Relatórios, dá para escolher quais carteiras entram no documento — cada uma vira uma seção própria.",
    ],
    note:
      "O filtro de carteira não é salvo entre sessões de propósito: reabrir o app dias depois já filtrado numa conta só, sem lembrar por quê, confundiria mais do que ajudaria.",
  },
  {
    id: "contas-a-pagar",
    title: "Contas a pagar e vencimentos",
    summary: "Registrar hoje uma conta que só vence depois, e confirmar o pagamento na hora certa.",
    steps: [
      "Ao criar uma transação, preencha o campo \"Vencimento (se diferente)\" com a data em que a conta vence.",
      "A conta entra como pendente e aparece com um selo de vencimento na lista.",
      "Quando pagar de verdade, clique em \"Pagar\" na linha para confirmar.",
      "O app avisa por notificação quando o vencimento chega e a conta ainda está em aberto.",
    ],
  },
];
