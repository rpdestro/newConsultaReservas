/* =========================================================================
   exportacao.js — Exportações para Excel
   (os relatórios para impressão/PDF ficam em relatorio.js)
   ========================================================================= */

const Exportacao = (() => {
    const FORMATO_MOEDA = '"R$"#,##0.00;("R$"#,##0.00);"-"';
    const FORMATO_PCT = '0.0%';
    const nomeFonteCompleto = f => Utils.rotuloFonte(f) + (Utils.nomeFonte(f) ? ` - ${Utils.nomeFonte(f)}` : '');

    function bibliotecaOk() {
        if (typeof XLSX !== 'undefined') return true;
        Avisos.notificar('A biblioteca de Excel (SheetJS) não foi carregada. Verifique a internet ou execute baixar-bibliotecas.bat para usar a cópia local (veja README.md).', 'erro');
        return false;
    }

    /**
     * Monta uma planilha a partir de cabeçalho + linhas.
     * opcoes: { moeda: [col], pct: [col], data: [col], larguras: [wch], filtro: bool }
     * Colunas de % recebem frações (0,452 = 45,2%). Datas recebem "aaaa-mm-dd".
     */
    function folha(cabecalho, linhas, opcoes = {}) {
        const { moeda = [], pct = [], data = [], larguras = [], filtro = true } = opcoes;
        const corpo = linhas.map(l => l.map((v, c) =>
            (data.includes(c) && v) ? (Utils.isoParaSerialExcel(v) || v) : v));
        const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...corpo]);

        for (let r = 1; r <= corpo.length; r++) {
            const formatar = (cols, z) => cols.forEach(c => {
                const cel = ws[XLSX.utils.encode_cell({ c, r })];
                if (cel && cel.t === 'n') cel.z = z;
            });
            formatar(moeda, FORMATO_MOEDA);
            formatar(pct, FORMATO_PCT);
            formatar(data, 'dd/mm/yyyy');
        }
        ws['!cols'] = cabecalho.map((_, i) => ({ wch: larguras[i] || 16 }));
        if (filtro && corpo.length) ws['!autofilter'] = { ref: ws['!ref'] };
        return ws;
    }

    function salvar(abas, nome) {
        const wb = XLSX.utils.book_new();
        abas.forEach(([titulo, ws]) => XLSX.utils.book_append_sheet(wb, ws, titulo.substring(0, 31)));
        XLSX.writeFile(wb, `${nome}_${Utils.hojeISO()}.xlsx`);
    }

    /** Aba "Informações": arquivo de origem, emissão e filtros usados. */
    function folhaInformacoes(titulo) {
        const filtros = Filtros.descrever();
        const linhas = [
            ['Relatório', titulo],
            ['Órgão', `${Config.ORGAO} - ${Config.DEPARTAMENTO}`],
            ['Arquivo', Estado.info ? Estado.info.arquivo : 'Registros incluídos manualmente'],
            ['Emitido em', new Date().toLocaleString('pt-BR')],
            ['Filtros', filtros.length ? filtros.join('; ') : 'Nenhum (todas as reservas carregadas)']
        ];
        return folha(['Item', 'Descrição'], linhas, { larguras: [14, 90], filtro: false });
    }

    // --------------------------- RESERVAS ---------------------------

    function excel(dados) {
        if (!dados.length) return Avisos.notificar('Não há dados para exportar.', 'alerta');
        if (!bibliotecaOk()) return;

        // V4.2.6: com dados do CSV, as informações adicionais entram no fim (todas, na ordem de
        // Config.COLUNAS_SIMPLES, para que o arquivo exportado possa ser importado de volta)
        const extras = Config.CAMPOS_EXTRAS || [];
        const temExtras = dados.some(reg => extras.some(c => Utils.texto(reg[c]) !== ''));
        const campos = temExtras ? Config.CAMPOS.concat(extras) : Config.CAMPOS;

        const cabecalho = campos.map(c => Config.ROTULOS[c]);
        const linhas = dados.map(reg => campos.map(campo => (campo === 'Data' ? (reg.DataISO || reg.Data) : Utils.texto(reg[campo]) === '' && extras.includes(campo) ? '' : reg[campo])));
        const col = c => campos.indexOf(c);
        const ws = folha(cabecalho, linhas, {
            moeda: Config.CAMPOS_MONETARIOS.map(col),
            data: [col('Data')],
            larguras: campos.map(c => (c === 'Historico' || c === 'Programa' ? 50 : c === 'NaturezaDespesa' || c === 'CentroCusto' ? 28 : c === 'Processo' || c === 'Responsavel' ? 20 : 15))
        });
        salvar([['Reservas', ws]], 'Relatorio_Reservas');
    }

    // ---------------------------- PAINEL ----------------------------

    /** Matriz Secretaria x Fonte (reservado, utilizado, %) + execução por secretaria e por fonte. */
    function matriz({ dados, g, secretarias }) {
        if (!dados.length) return Avisos.notificar('Não há dados para exportar.', 'alerta');
        if (!bibliotecaOk()) return;

        const cab = ['Secretaria', ...g.fontes.map(F => nomeFonteCompleto(F.chave)), 'Total'];
        const n = g.fontes.length;
        const cols = Array.from({ length: n + 1 }, (_, i) => i + 1);
        const larguras = [30, ...g.fontes.map(() => 20), 20];
        const pctDe = acc => (acc.original > 0 ? acc.utilizado / acc.original : 0);

        function tabela(valorDe) {
            const linhas = secretarias.map(S => [
                Utils.nomeSecretaria(S.sec),
                ...g.fontes.map(F => { const sf = S.fontes.get(F.chave); return sf ? valorDe(sf) : null; }),
                valorDe(S)
            ]);
            linhas.push(['Total', ...g.fontes.map(valorDe), valorDe(g.tot)]);
            return linhas;
        }

        const execucao = (itens, nome) => folha(
            [nome, 'Valor reserva (líquido)', 'Reservado originalmente', 'Utilizado', 'Saldo da reserva', '% utilizado', 'Reservas'],
            itens.map(([rotulo, acc]) => [rotulo, acc.valor, acc.original, acc.utilizado, acc.saldo, pctDe(acc), acc.qtd])
                .concat([['Total', g.tot.valor, g.tot.original, g.tot.utilizado, g.tot.saldo, pctDe(g.tot), g.tot.qtd]]),
            { moeda: [1, 2, 3, 4], pct: [5], larguras: [34, 20, 22, 18, 18, 12, 10] });

        salvar([
            ['Valor reservado', folha(cab, tabela(a => a.valor), { moeda: cols, larguras, filtro: false })],
            ['Utilizado', folha(cab, tabela(a => a.utilizado), { moeda: cols, larguras, filtro: false })],
            ['% utilizado', folha(cab, tabela(pctDe), { pct: cols, larguras, filtro: false })],
            ['Execução por secretaria', execucao(secretarias.map(S => [Utils.nomeSecretaria(S.sec), S]), 'Secretaria')],
            ['Execução por fonte', execucao(g.fontes.map(F => [nomeFonteCompleto(F.chave), F]), 'Fonte')],
            ['Informações', folhaInformacoes('Secretaria x fonte')]
        ], 'Matriz_Secretaria_Fonte');
    }

    /** Lista de reservas paradas (para cobrança das secretarias). */
    function paradas(lista) {
        if (!lista.length) return Avisos.notificar('Não há reservas paradas para exportar.', 'alerta');
        if (!bibliotecaOk()) return;
        const { dias, saldoMinimo } = Execucao.obterParametros();

        const linhas = lista.map(({ reg, dias: d, ultima }) => [
            reg.Reserva, reg.DataISO || reg.Data, ultima, d, Utils.nomeSecretaria(reg.UO), reg.Fonte, reg.Historico,
            reg.Processo, reg.Ficha, reg.ValorReserva, Execucao.utilizado(reg), reg.SaldoReserva,
            reg.ValorReserva > 0 ? Execucao.utilizado(reg) / reg.ValorReserva : 0
        ]);
        const ws = folha(
            ['Reserva', 'Data', 'Última movimentação', 'Dias parada', 'Secretaria', 'Fonte', 'Histórico', 'Processo', 'Ficha',
                'Valor Reserva', 'Utilizado', 'Saldo Reserva', '% utilizado'],
            linhas,
            { data: [1, 2], moeda: [9, 10, 11], pct: [12], larguras: [12, 12, 14, 10, 28, 8, 50, 20, 8, 16, 16, 16, 12] });

        const info = folhaInformacoes(`Reservas paradas: sem movimentação há mais de ${dias} dias e saldo a partir de ${Utils.formatarMoeda(saldoMinimo)}`);
        salvar([['Reservas paradas', ws], ['Informações', info]], 'Reservas_Paradas');
    }

    // -------------------------- COMPARAÇÃO --------------------------

    function comparacao(c) {
        if (!c) return Avisos.notificar('Ainda não há comparação para exportar.', 'alerta');
        if (!bibliotecaOk()) return;

        const listaReservas = lista => folha(
            ['Reserva', 'Data', 'Secretaria', 'Fonte', 'Histórico', 'Processo', 'Valor Reserva', 'Empenhado (ficha)', 'Saldo Reserva'],
            lista.map(r => [r.Reserva, r.DataISO || r.Data, Utils.nomeSecretaria(r.UO), r.Fonte, r.Historico, r.Processo,
                r.ValorReserva, r.ValorEmpenhado, r.SaldoReserva]),
            { data: [1], moeda: [6, 7, 8], larguras: [12, 12, 28, 8, 50, 20, 16, 16, 16] });

        // Alteradas: uma linha por campo alterado (com Data e Fonte para filtrar no Excel)
        const alteradas = [];
        c.alteradas.forEach(a => a.campos.forEach(campo => {
            const mon = Config.CAMPOS_MONETARIOS.includes(campo);
            alteradas.push([a.depois.Reserva, a.depois.DataISO || a.depois.Data, Utils.nomeSecretaria(a.depois.UO), a.depois.Fonte,
                Config.ROTULOS[campo],
                mon ? a.antes[campo] : Utils.texto(a.antes[campo]), mon ? a.depois[campo] : Utils.texto(a.depois[campo]),
                mon ? a.depois[campo] - a.antes[campo] : null]);
        }));
        const wsAlt = folha(['Reserva', 'Data', 'Secretaria', 'Fonte', 'Campo', 'Antes', 'Depois', 'Diferença'], alteradas,
            { data: [1], larguras: [12, 12, 28, 8, 18, 40, 40, 16] });
        // Formato de moeda só nas linhas de campos monetários
        alteradas.forEach((l, i) => {
            if (l[7] === null) return;
            [5, 6, 7].forEach(col => { const cel = wsAlt[XLSX.utils.encode_cell({ c: col, r: i + 1 })]; if (cel) cel.z = FORMATO_MOEDA; });
        });

        // Resumo: rótulos conforme a origem (importação anterior ou dois arquivos escolhidos)
        const manual = c.origem === 'manual';
        const [rotA, rotB] = manual ? ['Arquivo A', 'Arquivo B'] : ['Anterior', 'Atual'];
        const data = iso => (iso ? new Date(iso).toLocaleString('pt-BR') : '');
        const A = c.anterior;
        const B = c.atual;
        const linhasResumo = [
            ['Arquivo', A.arquivo, B.arquivo, ''],
            ['Carregado em', data(A.carregadoEm), data(B.carregadoEm), ''],
            ['Reservas', A.qtd, B.qtd, B.qtd - A.qtd],
            ['Valor reservado', A.valor, B.valor, B.valor - A.valor],
            ['Saldo das reservas', A.saldo, B.saldo, B.saldo - A.saldo],
            ['Novas', '', c.entraram.length, ''],
            ['Saíram', '', c.sairam.length, ''],
            ['Alteradas', '', c.alteradas.length, ''],
            ['Sem alteração', '', c.iguais, '']
        ];
        const resumo = folha(['Item', rotA, rotB, 'Variação'], linhasResumo, { larguras: [22, 40, 40, 18], filtro: false });
        // Moeda identificada pelo rótulo da linha (não por posição fixa)
        const LINHAS_MOEDA = ['Valor reservado', 'Saldo das reservas'];
        linhasResumo.forEach((l, i) => {
            if (!LINHAS_MOEDA.includes(l[0])) return;
            [1, 2, 3].forEach(col => { const cel = resumo[XLSX.utils.encode_cell({ c: col, r: i + 1 })]; if (cel) cel.z = FORMATO_MOEDA; });
        });

        salvar([
            ['Resumo', resumo], ['Novas', listaReservas(c.entraram)],
            ['Saíram', listaReservas(c.sairam)], ['Alteradas', wsAlt]
        ], manual ? 'Comparacao_Arquivos' : 'Comparacao_Importacoes');
    }

    return { excel, matriz, paradas, comparacao };
})();
