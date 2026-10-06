##

## Sistema de Consulta de Reservas Orçamentárias — V4.2.6

O **Sistema de Consulta de Reservas Orçamentárias** é uma aplicação web para importar, consultar e analisar as reservas orçamentárias exportadas do sistema Fiorilli. Ela transforma a planilha em painéis interativos, com filtros múltiplos, valores por Secretaria (Unidade Orçamentária - UO) e Fonte de Recurso, acompanhamento da execução das reservas e relatórios prontos para impressão ou PDF.

🔗 **Acesse:** https://rpdestro.github.io/newConsultaReservas/

##

## 🚀 Funcionalidades

### Aba "Consulta de Reservas"

* **Importação:** upload de relatórios `.xls`, `.xlsx` ou `.csv` do Fiorilli (clique ou arraste o arquivo), com detecção automática do layout e descarte de cabeçalhos, totais, rodapés e linhas vazias.
* **CSV do Fiorilli (novo na V4.2.5):** o arquivo `.csv` exportado pelo Fiorilli é lido pelo **nome das colunas** e gera exatamente os mesmos dados do `.xls` (layout exibido como "Fiorilli (CSV)"). Se o CSV tiver sido aberto e salvo de novo no Excel (que remove zeros à esquerda), os códigos são completados automaticamente (UO `20101` → `020101`, Processo `1.003` → `001.003`, Fonte `1` → `01`). Aceita UTF-8 ou ANSI, separador `;` ou `,` e textos com aspas soltas.
* **Conferência da importação (V4.2.6):** a área de upload mostra a quantidade de reservas e o total do Valor Reserva **do arquivo** (antes de filtros e edições), para conferir com o relatório do Fiorilli.
* **Filtros por coluna (estilo Excel):** Data, Reserva, Histórico, Ficha, UO, Natureza da Despesa, Processo, Fonte e demais colunas, com seleção múltipla.
* **Filtro por período:** data inicial e final, com atalhos "Últimos 30 dias", "Este mês" e "Este ano".
* **Pesquisa rápida:** procura em todas as colunas ao mesmo tempo, sem diferenciar maiúsculas e acentos (atalho `/`; `Esc` limpa). Com o CSV, também procura por status, responsável, nº do pedido, processo licitatório e centro de custo.
* **Mais filtros (V4.2.6, só com o CSV):** faixa acima da tabela com filtros de Status, Responsável, Nº do Pedido, Processo Licitatório, Centro de Custo, Fonte STN e Programa. Com o XLS, que não traz essas informações, a faixa não aparece.
* **Dashboard:** total filtrado, cards por Secretaria e Fonte (com a cor de cada fonte) e gráfico de barras.
* **Comparação de importações:** mostra o que entrou, saiu ou mudou em relação à importação anterior, ou entre dois arquivos escolhidos (XLS e CSV podem ser comparados entre si), com exportação para Excel.
* **Ficha da reserva:** detalhes de cada reserva, inclusão e edição manual. Com o CSV, a ficha mostra também as informações adicionais (responsável, pedido, licitação, centro de custo etc.), que são mantidas ao editar a reserva e saem no fim da exportação para Excel.
* **Avisos na própria página (V4.2.6):** mensagens e confirmações aparecem na tela da aplicação, no tema claro ou escuro, sem as janelas do navegador (`Esc` cancela uma confirmação).
* **Dados salvos no navegador (IndexedDB):** as reservas carregadas continuam disponíveis ao reabrir a página.

### Aba "Painel por Secretaria e Fonte"

* **Resumo:** total reservado e faixa com a participação de cada fonte de recurso.
* **Banners por fonte e cards por secretaria**, com destaque ao clicar em uma fonte. Cada fonte tem **cor fixa** pelo código (ex.: fonte 01 sempre azul), em todas as telas e relatórios, mesmo que alguma fonte não apareça no arquivo do mês (`Config.CORES_FONTES`).
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
* **Bibliotecas externas (versões fixas)**, lidas da pasta `lib/` quando existir ou, senão, da internet (CDN):
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

Se algum arquivo estiver faltando ou uma biblioteca externa não carregar, uma faixa vermelha no rodapé da página informa exatamente qual. A mesma faixa avisa se houver arquivos de versões diferentes misturados na pasta.

**Atualização de versão (para quem mantém o projeto):** no `index.html`, cada arquivo é chamado com a versão no endereço (ex.: `app.js?v=4.2.6.3`; o último número é a revisão, para entregas dentro da mesma versão). Isso obriga o navegador a baixar os arquivos novos, sem precisar de Ctrl+F5. Ao lançar uma nova versão, troque **juntos**: `VERSAO` no `config.js`, os `?v=` e a `VERSAO_HTML` no `index.html`.

**Sem internet (recomendado):** dê um duplo clique em `baixar-bibliotecas.bat` **uma vez**, com internet. Ele cria a pasta `lib/` com as três bibliotecas e, a partir daí, a aplicação não depende mais da internet nem de bloqueios da rede. Não é preciso mudar nada no `index.html`: ele procura primeiro a pasta `lib/` e só usa a internet se ela não existir. No GitHub Pages, envie também a pasta `lib/`.

Se preferir baixar à mão, salve estes arquivos dentro de uma pasta `lib/`, ao lado do `index.html`:

* https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
* https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js
* https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js

##

## 📁 Estrutura de Arquivos

Todos os arquivos ficam na mesma pasta; a única subpasta é a `lib/` (opcional, criada pelo `baixar-bibliotecas.bat`). A ordem dos `<script>` no `index.html` importa: cada arquivo usa os anteriores.

```text
/consultaReservas
    ├── index.html      - Ponto de entrada: estrutura da interface e chamada das bibliotecas;
    ├── style.css       - Interface gráfica, tema escuro e formatação de impressão;
    ├── brasao.png      - Brasão da Prefeitura (cabeçalho e relatórios);
    ├── config.js       - Secretarias, fontes, cores, colunas do Fiorilli e parâmetros (edite aqui);
    ├── utils.js        - Moeda, números, datas, fontes, cores e escape de HTML (reaproveitável);
    ├── avisos.js       - Avisos e confirmações na própria página;
    ├── dica.js         - Dica flutuante dos banners, cards e gráfico;
    ├── estado.js       - Dados em memória e gravação no navegador (IndexedDB);
    ├── execucao.js     - % utilizado das reservas e critérios de reservas paradas;
    ├── importacao.js   - Leitura do XLS/XLSX/CSV, detecção do layout e leitura do CSV do Fiorilli;
    ├── filtros.js      - Filtros por coluna, período e pesquisa;
    ├── comparacao.js   - Comparação entre importações ou entre dois arquivos;
    ├── dashboard.js    - Banner de total, cards e gráfico da aba Consulta;
    ├── tabela.js       - Tabela, totais e paginação;
    ├── modais.js       - Ficha da reserva e formulário de inclusão/edição;
    ├── exportacao.js   - Exportações para Excel;
    ├── relatorio.js    - Relatórios para impressão ou PDF;
    ├── painel.js       - Aba "Painel por Secretaria e Fonte";
    ├── app.js          - Inicialização e eventos da tela;
    ├── baixar-bibliotecas.bat - Baixa as bibliotecas para a pasta lib/ (uso sem internet);
    ├── lib/            - (opcional) cópia local das bibliotecas;
    └── README.md       - Documentação do projeto.
```

##

## 📄 Arquivos aceitos na importação

| Layout exibido | Arquivo | Como as colunas são localizadas |
|---|---|---|
| Fiorilli | Relatório `.xls`/`.xlsx` do Fiorilli | Pela **letra** da coluna (`Config.COLUNAS_FIORILLI`) |
| Fiorilli (CSV) | `.csv` exportado pelo Fiorilli | Pelo **nome** da coluna no cabeçalho (`Config.COLUNAS_FIORILLI_CSV`) |
| Simplificado | Planilha exportada por esta ferramenta | Pela posição, na ordem da exportação (`Config.COLUNAS_SIMPLES`) |

Correspondência entre o XLS e o CSV do Fiorilli:

| Campo | XLS | CSV | Ajuste automático |
|---|---|---|---|
| Data | B | DATA | — |
| Reserva | BT | RESERVA | — |
| Histórico | Q | HISTORICO | espaços nas pontas removidos (na comparação, espaços são ignorados) |
| Ficha | R | FICHA | — |
| UO | W | CODLO | 6 dígitos (`20101` → `020101`) |
| Natureza Desp. | Y | CATEC | — |
| UE | AJ | NO_UNIDADE | — |
| Processo | AS | PROCESSO | só se faltar zero: 1º trecho com 3 dígitos (`1.003` → `001.003`) |
| Valor Reserva | BP | VALORINICIAL | — |
| Fonte | BD | FONGRUPO | 2 dígitos (`1` → `01`) |
| Saldo Reserva | BL | SALDO_RESERVA | — |
| Saldo Atual | BM | SALDO | — |
| Empenhado (ficha) | BC | REALIZADO | — (não confundir com a coluna EMPENHADO do CSV) |

Se o Fiorilli mudar o nome de alguma coluna do CSV, basta ajustar `COLUNAS_FIORILLI_CSV` no `config.js`. Se faltar alguma coluna, a importação para e informa quais estão ausentes.

##

## 📝 Histórico de versões

* **V4.2.6:**
  * *Parte 1:* cor fixa por fonte de recurso; conferência da importação (quantidade e total do arquivo); versão no endereço dos arquivos (fim do Ctrl+F5) e aviso de arquivos de versões misturadas.
  * *Parte 2 (organização do código, sem mudança visual):* funções repetidas reunidas no `utils.js` (`rgba`, código e descrição da fonte); todas as cores no `config.js` (`CORES_FONTES`, `CORES_EXECUCAO`, `LIMITES_EXECUCAO`, `COR_ALERTA`, `PALETA_GRAFICO`); um único cálculo de somas por Secretaria × Fonte para as duas abas; removida a migração de dados da V3.0/V3.1.
  * *Parte 3:* filtros, ficha, pesquisa e exportação com as informações adicionais do CSV (`CAMPOS_EXTRAS`); avisos e confirmações na própria página no lugar das janelas do navegador (`avisos.js`); bibliotecas lidas da pasta `lib/` com reserva na internet (`baixar-bibliotecas.bat`).
* **V4.2.5:** leitura do CSV exportado pelo Fiorilli (pelo nome das colunas), com os mesmos dados do XLS. Conferido com o relatório completo de 01/10/2026: 9.859 reservas e total de R$ 312.317.424,31 nos dois formatos. Comparação entre XLS e CSV sem aviso de "layouts diferentes" e sem falsas alterações no Histórico.

  *Diferenças conhecidas entre os formatos (não afetam valores):* o XLS quebra alguns históricos com espaços extras ("ENCERRAM ENTO"), e o CSV remove o caractere `;` de dentro dos textos.
* **V4.2.4:** brasão da Prefeitura no cabeçalho e nos relatórios.

##

## 👨‍💻 Autor:
```text
Renato Pinheiro Destro
renato.destro@gmail.com
Auxiliar de Escritório / Prefeitura Municipal de Botucatu/SP
```
#### Seja LIVRE, use Linux!

##
