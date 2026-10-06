/* =========================================================================
   config.js — Parâmetros da aplicação
   Altere aqui nomes de secretarias, posição das colunas e demais ajustes,
   sem precisar mexer na lógica dos outros arquivos.
   ========================================================================= */

const Config = {
    VERSAO: 'V4.2.6',
    LINHAS_POR_PAGINA: 50,

    // Chaves no localStorage (preferências da tela). Os dados ficam no IndexedDB, banco 'reservasBotucatu'.
    CHAVE_TEMA: 'reservasBotucatu:tema',
    CHAVE_ABA: 'reservasBotucatu:aba',
    CHAVE_PARADAS: 'reservasBotucatu:paradas',

    // Cabeçalho dos relatórios (botão "Relatório")
    ORGAO: 'Prefeitura Municipal de Botucatu',
    DEPARTAMENTO: 'Departamento de Planejamento e Orçamento',

    // Reservas paradas: data da reserva há MAIS de N dias e saldo a partir do valor mínimo.
    // São só os valores iniciais: podem ser alterados na tela (ficam salvos no navegador).
    PARADAS_DIAS: 60,
    PARADAS_SALDO_MINIMO: 1000,

    // Campos comparados entre duas importações. Saldo Atual e Valor Empenhado ficam de fora:
    // são valores da FICHA e mudam com qualquer movimento dela, gerando "alterações" falsas.
    CAMPOS_COMPARACAO: [
        'Data', 'Historico', 'Ficha', 'UO', 'NaturezaDespesa', 'UE', 'Processo',
        'ValorReserva', 'Fonte', 'SaldoReserva'
    ],

    // Ordem oficial dos campos (usada na tabela, nos filtros e na exportação)
    CAMPOS: [
        'Data', 'Reserva', 'Historico', 'Ficha', 'UO', 'NaturezaDespesa', 'UE',
        'Processo', 'ValorReserva', 'Fonte', 'SaldoReserva', 'SaldoAtual', 'ValorEmpenhado'
    ],

    // Comparação: processos acompanhados no bloco "Processos-chave".
    // Comparação EXATA com o código do início da coluna Processo (AS): cada código é uma linha
    // própria ("001.003" não inclui "001.003.1"). Para acompanhar outro processo, inclua-o aqui.
    PROCESSOS_CHAVE: ['001.003', '001.003.1', '001.003.3', '001.005'],

    // Fonte de recurso em destaque na comparação (código lido da coluna Fonte, BD: "01" -> 1)
    FONTE_DESTAQUE: 1,

    CAMPOS_MONETARIOS: ['ValorReserva', 'SaldoReserva', 'SaldoAtual', 'ValorEmpenhado'],

    // Campos consultados pela "Pesquisa rápida" (o nome da secretaria também é incluído).
    // O Saldo Atual fica de fora: é o saldo da ficha e se repete em várias reservas.
    CAMPOS_BUSCA: [
        'Data', 'Reserva', 'Historico', 'Ficha', 'UO', 'NaturezaDespesa', 'UE',
        'Processo', 'ValorReserva', 'Fonte', 'SaldoReserva', 'ValorEmpenhado',
        'Status', 'Responsavel', 'Pedido', 'Licitacao', 'CentroCusto'   // V4.2.6: só vêm no CSV
    ],
    ATRASO_BUSCA_MS: 200,   // espera após a digitação antes de filtrar

    ROTULOS: {
        Data: 'Data', Reserva: 'Reserva', Historico: 'Histórico', Ficha: 'Ficha',
        UO: 'UO', NaturezaDespesa: 'Natureza Desp.', UE: 'UE', Processo: 'Processo',
        ValorReserva: 'Valor Reserva', Fonte: 'Fonte', SaldoReserva: 'Saldo Reserva',
        SaldoAtual: 'Saldo Atual', ValorEmpenhado: 'Empenhado (ficha)',
        // V4.2.6: informações adicionais (só no CSV do Fiorilli)
        Status: 'Status', Responsavel: 'Responsável', Pedido: 'Nº do Pedido', Licitacao: 'Processo Licitatório',
        CentroCusto: 'Centro de Custo', FonteSTN: 'Fonte STN', Programa: 'Programa'
    },

    // V4.2.6: informações adicionais que SÓ o CSV do Fiorilli traz (no XLS ficam em branco).
    // Aparecem como filtros extras acima da tabela, na ficha da reserva, na pesquisa e na exportação.
    // Para incluir outra coluna do CSV: acrescente aqui, em COLUNAS_EXTRAS_CSV e em ROTULOS.
    CAMPOS_EXTRAS: ['Status', 'Responsavel', 'Pedido', 'Licitacao', 'CentroCusto', 'FonteSTN', 'Programa'],

    // Layout do relatório exportado pelo Fiorilli: campo -> letra da coluna no Excel
    COLUNAS_FIORILLI: {
        Data: 'B', Reserva: 'BT', Historico: 'Q', Ficha: 'R', UO: 'W',
        NaturezaDespesa: 'Y', UE: 'AJ', Processo: 'AS', ValorReserva: 'BP',
        Fonte: 'BD', SaldoReserva: 'BL', SaldoAtual: 'BM', ValorEmpenhado: 'BC'
    },

    // V4.2.5: layout do CSV exportado pelo Fiorilli: campo -> NOME da coluna no cabeçalho.
    // O CSV traz os dados "crus" (sem a formatação do relatório), por isso a leitura é pelo
    // nome da coluna, e não pela letra. Validado com os mesmos dados do XLS (13 campos idênticos).
    // Atenção: Empenhado (ficha) vem de REALIZADO; a coluna EMPENHADO do CSV é outro valor.
    COLUNAS_FIORILLI_CSV: {
        Data: 'DATA', Reserva: 'RESERVA', Historico: 'HISTORICO', Ficha: 'FICHA', UO: 'CODLO',
        NaturezaDespesa: 'CATEC', UE: 'NO_UNIDADE', Processo: 'PROCESSO', ValorReserva: 'VALORINICIAL',
        Fonte: 'FONGRUPO', SaldoReserva: 'SALDO_RESERVA', SaldoAtual: 'SALDO', ValorEmpenhado: 'REALIZADO'
    },

    // V4.2.5: no CSV os códigos vêm sem zeros à esquerda. Nº de dígitos para igualar ao XLS:
    // UO 20101 -> 020101 | Processo 1.003 -> 001.003 (só o 1º trecho) | Fonte 1 -> 01
    DIGITOS_CSV: { UO: 6, Processo: 3, Fonte: 2 },

    // V4.2.6: colunas opcionais do CSV (campo -> nome da coluna). Se faltarem, a importação continua.
    COLUNAS_EXTRAS_CSV: {
        Status: 'DESCR_STATUS', Responsavel: 'LOGINNOME', Pedido: 'NUMPED', Licitacao: 'PROCLIC',
        CentroCusto: 'CENTRO_CUSTO', FonteSTN: 'FONTE_STN', Programa: 'PROGRAMADESCR'
    },

    // Layout simplificado: mesma ordem do arquivo exportado por esta ferramenta
    // (permite exportar, ajustar no Excel e importar de volta)
    COLUNAS_SIMPLES: {
        Data: 0, Reserva: 1, Historico: 2, Ficha: 3, UO: 4, NaturezaDespesa: 5,
        UE: 6, Processo: 7, ValorReserva: 8, Fonte: 9, SaldoReserva: 10,
        SaldoAtual: 11, ValorEmpenhado: 12,
        // V4.2.6: informações adicionais (exportadas após as colunas acima, quando existem)
        Status: 13, Responsavel: 14, Pedido: 15, Licitacao: 16, CentroCusto: 17, FonteSTN: 18, Programa: 19
    },

    // Nome das fontes de recurso (código AUDESP) exibido no Painel.
    // O código é lido do início do campo Fonte: "1", "01" ou "01.110.0000" -> 1.
    // Confira/ajuste os nomes conforme o uso no Município.
    FONTES: {
        1: 'Tesouro',
        2: 'Transferências e convênios estaduais',
        3: 'Recursos próprios de fundos especiais',
        4: 'Recursos próprios da adm. indireta',
        5: 'Transferências e convênios federais',
        6: 'Outras fontes de recursos',
        7: 'Operações de crédito',
        8: 'Emendas parlamentares individuais'
    },

    // V4.2.6: cor FIXA de cada fonte (mesmo código = mesma cor em qualquer arquivo e em todas as telas).
    // Tons escuros o bastante para texto branco legível. Fonte sem cor aqui usa COR_FONTE_PADRAO.
    CORES_FONTES: {
        1: '#1d4ed8',   // azul
        2: '#be185d',   // rosa
        3: '#047857',   // verde
        4: '#0e7490',   // ciano
        5: '#b45309',   // âmbar
        6: '#b91c1c',   // vermelho
        7: '#4d7c0f',   // oliva
        8: '#6d28d9'    // roxo
    },
    COR_FONTE_PADRAO: '#64748b',

    // V4.2.6: demais cores da aplicação reunidas aqui
    // Barras de execução (% utilizado): abaixo de LIMITES[0] = baixa; abaixo de LIMITES[1] = média; demais = alta
    LIMITES_EXECUCAO: [30, 70],
    CORES_EXECUCAO: { baixa: '#dc2626', media: '#d97706', alta: '#059669' },
    COR_ALERTA: '#dc2626',   // reservas paradas
    // Gráfico de barras por secretaria (aba Consulta)
    PALETA_GRAFICO: [
        '#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0',
        '#2ec4b6', '#ff9f1c', '#e71d36', '#fb8500', '#06d6a0',
        '#118ab2', '#073b4c', '#8338ec', '#ff006e', '#8ac926',
        '#1982c4', '#6a4c93', '#ff595e', '#ffca3a', '#10002b'
    ],

    // Código da UO (4 primeiros dígitos) -> nome da secretaria
    SECRETARIAS: {
        '0201': 'GABINETE',
        '0202': 'HABITAÇÃO',
        '0204': 'EDUCAÇÃO',
        '0206': 'SAÚDE',
        '0207': 'ESPORTES',
        '0208': 'SEGURANÇA',
        '0209': 'ASSIST. SOCIAL',
        '0210': 'FUNDO ASSIST. SOCIAL',
        '0211': 'CULTURA',
        '0212': 'INFRAESTRUTURA',
        '0232': 'PROCURADORIA',
        '0234': 'DESENVOLVIMENTO',
        '0235': 'ZELADORIA',
        '0236': 'GOVERNO',
        '0237': 'ADMINISTRAÇÃO',
        '0238': 'FAZENDA',
        '0239': 'COMUNICAÇÃO',
        '0240': 'TURISMO',
        '0241': 'MEIO AMBIENTE',
        '0242': 'AGRICULTURA'
    }
};
