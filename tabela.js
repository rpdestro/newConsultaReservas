/* =========================================================================
   tabela.js — Linhas da tabela, rodapé de totais e botão "Carregar mais"
   Os botões de cada linha são tratados por delegação de eventos (app.js),
   usando o data-id do registro.
   ========================================================================= */

const Tabela = (() => {
    const e = Utils.esc;
    const moeda = Utils.formatarMoeda;

    /** Selo "parada": reserva com saldo e sem movimentação há mais de N dias (ver execucao.js). */
    function seloParada(reg) {
        if (!Execucao.ehParada(reg)) return '';
        const { dias } = Execucao.obterParametros();
        return `<span class="selo-parada" ${Dica.atributo({
            titulo: 'Reserva parada',
            sub: `Sem movimentação há ${Execucao.diasSemMovimento(reg)} dias (critério: mais de ${dias})`,
            cor: Config.COR_ALERTA,
            valor: Utils.formatarMoeda(reg.SaldoReserva) + ' de saldo',
            linhas: [
                ['Última movimentação', Utils.dataISOparaBR(Execucao.ultimaMovimentacao(reg))],
                ['Utilizado', Utils.formatarPercentual(Execucao.pctUtilizado(Execucao.utilizado(reg), reg.ValorReserva))]
            ],
            acao: 'Critérios ajustáveis no Painel, seção Reservas paradas'
        })}>parada</span>`;
    }

    function linhaHTML(reg) {
        return `
            <tr data-id="${reg._id}">
                <td class="col-acoes">
                    <button type="button" class="btn btn-info btn-sm" data-acao="ficha">Ficha</button>
                    <button type="button" class="btn btn-warning btn-sm" data-acao="editar">Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" data-acao="excluir">Excluir</button>
                </td>
                <td class="txt-centro">${e(reg.Data)}</td>
                <td class="txt-centro"><b>${e(reg.Reserva)}</b>${seloParada(reg)}</td>
                <td class="col-texto-longo">${e(reg.Historico)}</td>
                <td class="txt-centro">${e(reg.Ficha)}</td>
                <td class="txt-centro">${e(reg.UO)}</td>
                <td>${e(reg.NaturezaDespesa)}</td>
                <td class="txt-centro">${e(reg.UE)}</td>
                <td class="col-texto-longo">${e(reg.Processo)}</td>
                <td class="col-valores valor-reserva">${moeda(reg.ValorReserva)}</td>
                <td class="txt-centro">${e(reg.Fonte)}</td>
                <td class="col-valores">${moeda(reg.SaldoReserva)}</td>
                <td class="col-valores cor-saldo-atual">${moeda(reg.SaldoAtual)}</td>
                <td class="col-valores">${moeda(reg.ValorEmpenhado)}</td>
            </tr>`;
    }

    function mensagemHTML(texto) {
        return `<tr><td colspan="14" class="empty-table-message">${texto}</td></tr>`;
    }

    /**
     * Rodapé com os totais dos registros filtrados.
     * Saldo Atual e Valor Empenhado NÃO são somados: são valores da FICHA e se
     * repetem em todas as reservas da mesma ficha, então a soma daria um valor inflado.
     */
    function subtotalHTML(dados) {
        const soma = campo => dados.reduce((total, r) => total + r[campo], 0);
        return `
            <tr>
                <td class="col-acoes"></td>
                <td colspan="8">Total dos ${dados.length} registros filtrados</td>
                <td class="col-valores valor-reserva">${moeda(soma('ValorReserva'))}</td>
                <td></td>
                <td class="col-valores">${moeda(soma('SaldoReserva'))}</td>
                <td class="col-valores txt-centro" title="Saldo da ficha não é somado (repete-se entre reservas)">—</td>
                <td class="col-valores txt-centro" title="Empenhado da ficha não é somado (repete-se entre reservas)">—</td>
            </tr>`;
    }

    function renderizar(dados) {
        const tbody = document.getElementById('tabelaCorpo');
        const rodape = document.getElementById('tabelaRodapeSubtotal');
        const info = document.getElementById('infoRegistros');
        const btnMais = document.getElementById('btnCarregarMais');

        if (Estado.registros.length === 0) {
            tbody.innerHTML = mensagemHTML('Nenhum arquivo carregado. Selecione o relatório de reservas do Fiorilli acima para começar.');
            rodape.innerHTML = '';
            info.textContent = '';
            btnMais.classList.add('oculto');
            return;
        }

        if (dados.length === 0) {
            tbody.innerHTML = mensagemHTML('Nenhum registro atende aos filtros atuais. Use "Limpar filtros" para ver todos.');
            rodape.innerHTML = '';
            info.textContent = `0 de ${Estado.registros.length} registros`;
            btnMais.classList.add('oculto');
            return;
        }

        const visiveis = Math.min(dados.length, Estado.limiteLinhas);
        tbody.innerHTML = dados.slice(0, visiveis).map(linhaHTML).join('');
        rodape.innerHTML = subtotalHTML(dados);
        info.textContent = `Exibindo ${visiveis} de ${dados.length} registros filtrados (${Estado.registros.length} no total)`;

        const restantes = dados.length - visiveis;
        if (restantes > 0) {
            btnMais.textContent = `Carregar mais (${Math.min(restantes, Config.LINHAS_POR_PAGINA)} de ${restantes} restantes)`;
            btnMais.classList.remove('oculto');
        } else {
            btnMais.classList.add('oculto');
        }
    }

    return { renderizar };
})();
