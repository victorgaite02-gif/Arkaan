# 📘 Arkaan - Documentação da Plataforma Financeira

**Versão:** 1.2.4  
**Desenvolvido por:** Whale Corporate

---

## 1. Visão Geral
O **Arkaan** é um painel de controle financeiro pessoal avançado, projetado para centralizar a gestão de receitas, despesas fixas, assinaturas, compras variáveis e dívidas. A plataforma se diferencia pelo uso intensivo de **Inteligência Artificial (Gemini)** para gerar relatórios, criar metas estratégicas e facilitar o lançamento de dados via linguagem natural.

### Principais Diferenciais
*   **IA Integrada:** Assistente virtual e relatórios de saúde financeira gerados automaticamente.
*   **Gestão de Parcelamento:** Controle inteligente de compras parceladas no cartão de crédito.
*   **Modo Privacidade:** Ocultação de valores sensíveis com um clique (blur).
*   **Animações Fluidas:** Interface moderna com transições suaves e gráficos interativos.
*   **Cross-Platform:** Responsivo para Desktop e Mobile (PWA).

---

## 2. Módulos do Sistema

### 📊 Dashboard
O centro de comando da plataforma.
*   **KPIs Animados:** Exibe Entradas, Saídas, Fatura do Cartão e Saldo Final com efeito de contagem.
*   **Gráficos:**
    *   *Análise Mensal:* Comparativo de Receitas vs. Despesas dos últimos 12 meses.
    *   *Breakdown:* Gráfico de pizza dividindo gastos entre Fixos, Assinaturas, Compras e Dívidas.
    *   *Tendências:* Gráfico de área mostrando a evolução das 3 principais categorias de gastos.
*   **Extrato Recente:** Lista das últimas transações realizadas.
*   **Metas Ativas:** Visualização rápida do progresso das metas financeiras.

### 💳 Assinaturas (Recorrência)
Gerenciamento de serviços recorrentes (Netflix, Spotify, Academias).
*   **Multimoeda:** Suporte para BRL e USD (com cálculo automático de IOF e cotação configurável).
*   **Previsão:** Calcula o total gasto até uma data futura.
*   **Status:** Permite pausar ou cancelar assinaturas, mantendo o histórico.

### 🏠 Despesas Fixas
Contas de consumo obrigatórias (Aluguel, Luz, Internet).
*   **Checklist Mensal:** Permite marcar o que já foi pago no mês corrente.
*   **Histórico:** O sistema lembra quais meses foram pagos individualmente.

### 🛒 Compras
Módulo complexo para gastos variáveis.
*   **Lógica de Cartão de Crédito:**
    *   Lança compras na fatura correta baseada no dia de fechamento do cartão.
    *   **Parcelamento:** Calcula automaticamente quanto de cada parcela cai em cada mês futuro.
    *   **Saldo Devedor:** Mostra o total comprometido em parcelas futuras.
*   **IA Review:** Transações inseridas pelo Chatbot ficam em uma aba "Revisão" para confirmação.
*   **Estornos:** Funcionalidade para estornar compras, gerando créditos na fatura.

### 📉 Dívidas (Loans)
Gestão de passivos e empréstimos.
*   **Método Bola de Neve:** O sistema sugere a ordem de pagamento (focando em menores saldos ou maiores juros).
*   **Negociação:** Diferencia dívidas "Em Negociação" de dívidas "Renegociadas" (parceladas).
*   **Acompanhamento:** Barra de progresso visual para a quitação total.

### 💰 Receitas (Incomes)
Registro de entradas financeiras.
*   **Fontes:** Salário, Freelance, Dividendos.
*   **Vínculo PJ:** Pode-se vincular receitas a empresas cadastradas no sistema.

### 🎯 Metas Inteligentes (Smart Goals)
Onde a IA brilha. O usuário não apenas define um valor, a IA cria o plano.
*   **Tipos de Meta:**
    1.  **Quitar Dívidas:** Gera um checklist de pagamento.
    2.  **Reserva de Emergência:** Calcula o custo de vida e sugere o valor de segurança (3 a 12 meses).
    3.  **Reduzir Despesas:** Define um teto de gastos e monitora o progresso em tempo real.
*   **Plano Estratégico:** A IA gera recomendações de cortes e limites por categoria.

### 🤖 Relatórios & IA
*   **Score de Saúde:** Nota de 0 a 100 para a saúde financeira do mês.
*   **Análise Qualitativa:** A IA analisa o contexto (ex: se há dívidas acumuladas, ela alerta mesmo que o saldo do mês seja positivo).
*   **Fluxo Diário:** Gráfico de barras dia-a-dia do mês selecionado.

---

## 3. Funcionalidades Transversais

### 🤖 Chatbot (Arkaan Assistant)
Localizado no botão flutuante (FAB), permite interação natural.
*   **Comandos:** "Lançar compra de 50 reais no Uber ontem", "Como estão minhas finanças?", "Apagar a última compra".
*   **Tecnologia:** Utiliza Google Gemini 2.5 Flash.

### ⚙️ Configurações
*   **Perfil:** Upload de foto com recorte (crop) e compressão automática.
*   **Categorias:** Gerenciamento completo de categorias para todas as áreas (arrastar e soltar).
*   **Cartões:** Cadastro de cartões com datas de fechamento e vencimento.
*   **Integrações:** Configuração (Beta) para envio de lançamentos via WhatsApp.
*   **Pessoas:** Cadastro de membros da família para atribuir gastos.

### 👁️ Controle de Visualização
*   **Olho Mágico:** Oculta todos os valores monetários da tela (persiste no navegador).
*   **Toggle de Animação:** Permite desativar as animações para dispositivos mais lentos ou preferência do usuário.

---

## 4. Detalhes Técnicos

*   **Frontend:** React 19, Vite, TypeScript.
*   **Estilização:** Tailwind CSS.
*   **Gráficos:** Recharts.
*   **Backend/Database:** Supabase (PostgreSQL).
*   **IA:** Google Gemini API via SDK oficial `@google/genai`.
*   **Performance:** Utiliza *Lazy Rendering* e *Memoization* para garantir que apenas a aba ativa consuma recursos, tornando a navegação instantânea.

---

*© 2025 Whale Corporate. Todos os direitos reservados.*
