##

## Sistema de Consulta de Reservas Orçamentárias — V4.2.4

O **Sistema de Consulta de Reservas Orçamentárias** é uma aplicação web para importar, consultar e analisar as reservas orçamentárias exportadas do sistema Fiorilli. Ela transforma a planilha em painéis interativos, com filtros múltiplos, valores por Secretaria (Unidade Orçamentária - UO) e Fonte de Recurso, acompanhamento da execução das reservas e relatórios prontos para impressão ou PDF.

🔗 **Acesse:** https://rpdestro.github.io/newConsultaReservas/

##

## 🚀 Funcionalidades

### Aba "Consulta de Reservas"

* **Importação:** upload de relatórios `.xls`, `.xlsx` ou `.csv` do Fiorilli (clique ou arraste o arquivo), com detecção automática do layout e descarte de cabeçalhos, totais e rodapés.
* **Filtros por coluna (estilo Excel):** Data, Reserva, Histórico, Ficha, UO, Natureza da Despesa, Processo, Fonte e demais colunas, com seleção múltipla.
* **Filtro por período:** data inicial e final, com atalhos "Últimos 30 dias", "Este mês" e "Este ano".
* **Pesquisa rápida:** procura em todas as colunas ao mesmo tempo, sem diferenciar maiúsculas e acentos (atalho `/`; `Esc` limpa).
* **Dashboard:** total filtrado, cards por Secretaria e Fonte (com a cor de cada fonte) e gráfico de barras.
* **Comparação de importações:** mostra o que entrou, saiu ou mudou em relação à importação anterior, ou entre dois arquivos escolhidos, com exportação para Excel.
* **Ficha da reserva:** detalhes de cada reserva, inclusão e edição manual.
* **Dados salvos no navegador (IndexedDB):** as reservas carregadas continuam disponíveis ao reabrir a página.

### Aba "Painel por Secretaria e Fonte"

* **Resumo:** total reservado e faixa com a participação de cada fonte de recurso.
* **Banners por fonte e cards por secretaria**, com destaque ao clicar em uma fonte.
* **Execução das reservas:** % utilizado por secretaria ou por fonte (Utilizado = Valor Reserva − Saldo Reserva).
* **Reservas paradas:** reservas sem movimentação há mais de N dias e com saldo a partir de R$ X (critérios ajustáveis na tela), com exportação para Excel.
* **Matriz Secretaria × Fonte**, com exportação para Excel.
* **Filtros ativos exibidos por extenso** (ex.: "Processo: 001.003, 001.003.1, 001.005"), com o atalho "Limpar filtros".

### Relatórios e exportações

* **Relatórios em folha A4** Use para "Imprimir ou salvar PDF".
* **Exportação para Excel**
* **Tema claro e escuro.**

##

## 💻 Tecnologias Utilizadas

A aplicação é **100% Client-Side** (processamento local no navegador), sem servidor nem banco de dados externo. Os dados do Fiorilli não saem do computador do usuário.

* **HTML5:** estrutura e semântica da página.
* **CSS3:** interface, responsividade, tema escuro e regras de impressão (`@media print`).
* **JavaScript (Vanilla):** organizado em módulos, um arquivo por responsabilidade.
* **IndexedDB:** armazenamento local das reservas importadas.
* **Bibliotecas externas via CDN (versões fixas):**
  * *SheetJS 0.20.3 (`xlsx.full.min.js`):* leitura e geração de arquivos Excel.
  * *Chart.js 4.4.1 & ChartDataLabels 2.2.0:* gráfico da aba Consulta.

##

## ⚙️ Como usar

Não é preciso instalar nada. Funciona em qualquer navegador moderno (Google Chrome, Edge, Firefox etc.).

**Online:** acesse https://rpdestro.github.io/newConsultaReservas/

**No computador:**

1. Faça o download ou clone este repositório;
2. Mantenha **todos os arquivos na mesma pasta** do `index.html`;
3. Dê um duplo clique no `index.html`.

Se algum arquivo estiver faltando ou uma biblioteca externa não carregar, uma faixa vermelha no rodapé da página informa exatamente qual.

**Sem internet (opcional):** baixe as três bibliotecas abaixo para a mesma pasta e, no `index.html`, troque os endereços pelos nomes dos arquivos locais:

* https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
* https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js
* https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js

##

## 📁 Estrutura de Arquivos

Todos os arquivos ficam na mesma pasta, sem subdiretórios. A ordem dos `<script>` no `index.html` importa: cada arquivo usa os anteriores.

```text
/consultaReservas
    ├── index.html      - Ponto de entrada: estrutura da interface e chamada das bibliotecas;
    ├── style.css       - Interface gráfica, tema escuro e formatação de impressão;
    ├── brasao.png      - Brasão da Prefeitura (cabeçalho e relatórios);
    ├── config.js       - Secretarias, fontes, colunas do Fiorilli e parâmetros (edite aqui);
    ├── utils.js        - Moeda, números, datas e escape de HTML (reaproveitável);
    ├── dica.js         - Dica flutuante dos banners, cards e gráfico;
    ├── estado.js       - Dados em memória e gravação no navegador (IndexedDB);
    ├── execucao.js     - % utilizado das reservas e critérios de reservas paradas;
    ├── importacao.js   - Leitura do XLS/XLSX/CSV e detecção do layout;
    ├── filtros.js      - Filtros por coluna, período e pesquisa;
    ├── comparacao.js   - Comparação entre importações ou entre dois arquivos;
    ├── dashboard.js    - Banner de total, cards e gráfico da aba Consulta;
    ├── tabela.js       - Tabela, totais e paginação;
    ├── modais.js       - Ficha da reserva e formulário de inclusão/edição;
    ├── exportacao.js   - Exportações para Excel;
    ├── relatorio.js    - Relatórios para impressão ou PDF;
    ├── painel.js       - Aba "Painel por Secretaria e Fonte";
    ├── app.js          - Inicialização e eventos da tela;
    └── README.md       - Documentação do projeto.
```

##

## 👨‍💻 Autor:
```text
Renato Pinheiro Destro
renato.destro@gmail.com
Auxiliar de Escritório / Prefeitura Municipal de Botucatu/SP
```
#### Seja LIVRE, use Linux!

##
