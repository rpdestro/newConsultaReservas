/* =========================================================================
   config.js — Parâmetros da aplicação
   Altere aqui nomes de secretarias, posição das colunas e demais ajustes,
   sem precisar mexer na lógica dos outros arquivos.
   ========================================================================= */

const Config = {
    VERSAO: 'V4.2.4',
    LINHAS_POR_PAGINA: 50,

    // Chaves no localStorage: tema (atual) e dados da V3.0/V3.1 (apenas para migração;
    // os dados agora ficam no IndexedDB, banco 'reservasBotucatu')
    CHAVE_DADOS: 'reservasBotucatu:dados:v1',
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
        'Processo', 'ValorReserva', 'Fonte', 'SaldoReserva', 'ValorEmpenhado'
    ],
    ATRASO_BUSCA_MS: 200,   // espera após a digitação antes de filtrar

    ROTULOS: {
        Data: 'Data', Reserva: 'Reserva', Historico: 'Histórico', Ficha: 'Ficha',
        UO: 'UO', NaturezaDespesa: 'Natureza Desp.', UE: 'UE', Processo: 'Processo',
        ValorReserva: 'Valor Reserva', Fonte: 'Fonte', SaldoReserva: 'Saldo Reserva',
        SaldoAtual: 'Saldo Atual', ValorEmpenhado: 'Empenhado (ficha)'
    },

    // Layout do relatório exportado pelo Fiorilli: campo -> letra da coluna no Excel
    COLUNAS_FIORILLI: {
        Data: 'B', Reserva: 'BT', Historico: 'Q', Ficha: 'R', UO: 'W',
        NaturezaDespesa: 'Y', UE: 'AJ', Processo: 'AS', ValorReserva: 'BP',
        Fonte: 'BD', SaldoReserva: 'BL', SaldoAtual: 'BM', ValorEmpenhado: 'BC'
    },

    // Layout simplificado: mesma ordem do arquivo exportado por esta ferramenta
    // (permite exportar, ajustar no Excel e importar de volta)
    COLUNAS_SIMPLES: {
        Data: 0, Reserva: 1, Historico: 2, Ficha: 3, UO: 4, NaturezaDespesa: 5,
        UE: 6, Processo: 7, ValorReserva: 8, Fonte: 9, SaldoReserva: 10,
        SaldoAtual: 11, ValorEmpenhado: 12
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
