/* =========================================================================
   execucao.js — Execução das reservas (% utilizado) e reservas paradas

   Como o relatório do Fiorilli representa a execução:
   - Linhas com Valor Reserva POSITIVO são as reservas originais. O Saldo Reserva
     delas mostra quanto ainda resta.
   - Linhas com Valor Reserva NEGATIVO são reduções (baixas) de reservas da mesma
     ficha; o saldo delas vem zerado.
   - "Valor Empenhado" é o empenhado da FICHA: repete-se em todas as reservas da
     ficha e por isso NUNCA é somado (mesmo caso do Saldo Atual).

   Utilizado   = Valor Reserva − Saldo Reserva   (só reservas positivas)
   % utilizado = Utilizado ÷ Valor Reserva original (só reservas positivas)

   Reserva parada = reserva positiva com saldo a partir do valor mínimo e SEM
   movimentação há mais de N dias. Movimentação = data da própria reserva ou a
   redução mais recente registrada na mesma ficha (o que for mais recente).
   Os critérios são ajustados na tela e ficam salvos neste navegador.
   ========================================================================= */

const Execucao = (() => {
    let parametros = { dias: Config.PARADAS_DIAS, saldoMinimo: Config.PARADAS_SALDO_MINIMO };
    let ultimaReducaoPorFicha = new Map();   // ficha -> data (aaaa-mm-dd) da redução mais recente

    try {
        const salvo = JSON.parse(localStorage.getItem(Config.CHAVE_PARADAS));
        if (salvo && salvo.dias > 0 && salvo.saldoMinimo >= 0) parametros = salvo;
    } catch (e) { /* ignorado */ }

    function obterParametros() {
        return { dias: parametros.dias, saldoMinimo: parametros.saldoMinimo };
    }

    function definirParametros(dias, saldoMinimo) {
        parametros = {
            dias: Number.isFinite(dias) && dias > 0 ? Math.round(dias) : Config.PARADAS_DIAS,
            saldoMinimo: Number.isFinite(saldoMinimo) && saldoMinimo >= 0 ? saldoMinimo : Config.PARADAS_SALDO_MINIMO
        };
        try { localStorage.setItem(Config.CHAVE_PARADAS, JSON.stringify(parametros)); } catch (e) { /* ignorado */ }
    }

    /**
     * Refaz o índice de reduções por ficha. Usa TODOS os registros carregados
     * (não só os filtrados): uma redução fora do filtro também é movimentação.
     * Chamado pelo App a cada atualização da tela.
     */
    function recalcular(registros) {
        const mapa = new Map();
        registros.forEach(reg => {
            if (reg.ValorReserva >= 0 || !reg.DataISO || !reg.Ficha) return;
            const atual = mapa.get(reg.Ficha);
            if (!atual || reg.DataISO > atual) mapa.set(reg.Ficha, reg.DataISO);
        });
        ultimaReducaoPorFicha = mapa;
    }

    /** Dias corridos entre a data (aaaa-mm-dd) e hoje; null se não houver data. */
    function diasDesde(dataISO) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataISO || '');
        if (!m) return null;
        const h = new Date();
        const hoje = Date.UTC(h.getFullYear(), h.getMonth(), h.getDate());
        return Math.floor((hoje - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
    }

    /** Data (aaaa-mm-dd) da última movimentação: a reserva ou a redução mais recente da ficha. */
    function ultimaMovimentacao(reg) {
        const reducao = reg.Ficha ? ultimaReducaoPorFicha.get(reg.Ficha) : '';
        return reducao && reducao > (reg.DataISO || '') ? reducao : (reg.DataISO || '');
    }

    function diasSemMovimento(reg) {
        return diasDesde(ultimaMovimentacao(reg));
    }

    function ehParada(reg) {
        if (!(reg.ValorReserva > 0) || !(reg.SaldoReserva > 0) || reg.SaldoReserva < parametros.saldoMinimo) return false;
        const dias = diasSemMovimento(reg);
        return dias !== null && dias > parametros.dias;
    }

    /** Reservas paradas, da de maior saldo para a de menor. */
    function listarParadas(dados) {
        return dados.filter(ehParada)
            .map(reg => ({ reg, dias: diasSemMovimento(reg), ultima: ultimaMovimentacao(reg) }))
            .sort((a, b) => b.reg.SaldoReserva - a.reg.SaldoReserva || b.dias - a.dias);
    }

    /** Valor original da reserva (reduções, que são negativas, não entram). */
    function reservadoOriginal(reg) {
        return reg.ValorReserva > 0 ? reg.ValorReserva : 0;
    }

    /** Quanto da reserva já saiu dela (Valor Reserva − Saldo Reserva). */
    function utilizado(reg) {
        return reg.ValorReserva > 0 ? Math.max(reg.ValorReserva - reg.SaldoReserva, 0) : 0;
    }

    function pctUtilizado(valorUtilizado, original) {
        return original > 0 ? (valorUtilizado / original) * 100 : 0;
    }

    /** Cor da barra de execução: vermelho (< 30%), âmbar (< 70%), verde. */
    function corPct(pct) {
        if (pct < 30) return '#dc2626';
        if (pct < 70) return '#d97706';
        return '#059669';
    }

    return {
        obterParametros, definirParametros, recalcular, diasDesde, ultimaMovimentacao, diasSemMovimento,
        ehParada, listarParadas, reservadoOriginal, utilizado, pctUtilizado, corPct
    };
})();
