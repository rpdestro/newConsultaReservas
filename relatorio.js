/* =========================================================================
   relatorio.js — Relatórios para impressão ou PDF (botão "Relatório")
   O relatório abre numa visualização em folha A4, sempre com fundo claro
   (mesmo no tema escuro). Na janela de impressão do navegador, escolha a
   impressora ou "Salvar como PDF".
   ========================================================================= */

const Relatorio = (() => {
    const e = Utils.esc;
    const moeda = Utils.formatarMoeda;
    const decimal = Utils.formatarDecimal;
    const compacta = Utils.formatarMoedaCompacta;
    const pctTxt = Utils.formatarPercentual;
    const $ = id => document.getElementById(id);
    const num = n => n.toLocaleString('pt-BR');
    const pct = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);
    const largura = p => Math.min(Math.max(p, 0), 100).toFixed(2);
    const plural = (n, um, varios) => `${num(n)} ${n === 1 ? um : varios}`;

    let tituloOriginal = document.title;
    let aberto = false;

    // --------------------------- PARTES COMUNS ---------------------------

    function cabecalho(titulo) {
        const info = Estado.info;
        const filtros = Filtros.descrever();
        const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        return `
            <header class="rel-cab">
                <div class="rel-cab-esq">
                    <img src="brasao.png" alt="Brasão da Prefeitura de Botucatu" class="rel-logo">
                    <div class="rel-instituicao">
                        <strong>${e(Config.ORGAO)}</strong>
                        <span>${e(Config.DEPARTAMENTO)}</span>
                    </div>
                </div>
                <div class="rel-emissao">Emitido em ${agora}</div>
            </header>
            <h1 class="rel-titulo">${e(titulo)}</h1>
            <dl class="rel-meta">
                <div><dt>Arquivo</dt><dd>${info ? e(info.arquivo) : 'Registros incluídos manualmente'}${info && info.carregadoEm
                    ? `, carregado em ${new Date(info.carregadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</dd></div>
                <div><dt>Filtros</dt><dd>${filtros.length ? filtros.map(e).join('; ') : 'Nenhum: todas as reservas carregadas'}</dd></div>
            </dl>`;
    }

    function rodape() {
        return `<footer class="rel-rodape">${e(Config.ORGAO)}, ${e(Config.DEPARTAMENTO)}. Consulta de Reservas ${e(Config.VERSAO)}.</footer>`;
    }

    function nomeFonte(f) {
        return Utils.nomeFonte(f) || 'Nome não cadastrado';
    }

    // ------------------------------ CONSULTA ------------------------------
    // Somente o conteúdo dos banners: total filtrado + cards secretaria/fonte.

    function consulta() {
        const dados = Filtros.aplicar(Estado.registros);
        if (!dados.length) return Avisos.notificar('Não há dados para o relatório. Carregue um arquivo ou ajuste os filtros.', 'alerta');

        const { lista, total, secretarias, fontes } = Dashboard.agruparCards(dados);
        const cores = Painel.cores();

        const cards = lista.map(item => `
            <div class="rel-card" style="--cor:${cores[item.fonte] || '#64748b'}">
                <div class="rel-card-topo">
                    <span class="rel-card-sec">${e(Utils.nomeSecretaria(item.sec))}</span>
                    <span class="rel-tag">${e(Utils.rotuloFonte(item.fonte))}</span>
                </div>
                <div class="rel-card-fonte">${e(nomeFonte(item.fonte))}</div>
                <div class="rel-card-valor">${moeda(item.valor)}</div>
                <div class="rel-card-rodape">${plural(item.qtd, 'reserva', 'reservas')}, ${pctTxt(pct(item.valor, total))} do total</div>
            </div>`).join('');

        const html = cabecalho('Reservas Orçamentárias por Secretaria e Fonte') + `
            <section class="rel-destaque">
                <div class="rel-destaque-principal">
                    <span>Valor total reservado</span>
                    <strong>${moeda(total)}</strong>
                </div>
                <dl class="rel-numeros">
                    <div><dt>Reservas</dt><dd>${num(dados.length)}</dd></div>
                    <div><dt>Secretarias</dt><dd>${num(secretarias)}</dd></div>
                    <div><dt>Fontes</dt><dd>${num(fontes)}</dd></div>
                </dl>
            </section>
            <section class="rel-secao">
                <h2>Valor Reservado por Secretaria e Fonte de Recurso</h2>
                <div class="rel-grade rel-grade-3">${cards}</div>
            </section>` + rodape();

        abrir('Relatório da consulta', 'Relatorio_Consulta_Reservas', html);
    }

    // ------------------------------- PAINEL -------------------------------

    function resumoPainel(g, cores, dados) {
        const pe = Execucao.pctUtilizado(g.tot.utilizado, g.tot.original);
        const faixa = g.fontes.map(F => {
            const p = pct(Math.max(F.valor, 0), g.total);
            return `<span style="flex:${p.toFixed(4)} 0 0%;background:${cores[F.chave]}">${p >= 7 ? pctTxt(p) : ''}</span>`;
        }).join('');
        const legenda = g.fontes.map(F => `
            <span class="rel-leg"><i style="background:${cores[F.chave]}"></i>
                <b>${e(Utils.rotuloFonte(F.chave))}</b> ${e(Utils.nomeFonte(F.chave))} <em>${pctTxt(pct(F.valor, g.total))}</em></span>`).join('');

        return `
            <section class="rel-destaque">
                <div class="rel-destaque-principal">
                    <span>Total reservado</span>
                    <strong>${moeda(g.total)}</strong>
                    <small>${plural(dados.length, 'reserva', 'reservas')} em ${plural(g.secretarias.length, 'secretaria', 'secretarias')} e ${plural(g.fontes.length, 'fonte', 'fontes')} de recurso</small>
                </div>
                <dl class="rel-numeros">
                    <div><dt>Utilizado das reservas</dt><dd>${moeda(g.tot.utilizado)}</dd><dd class="rel-numeros-sub">${pctTxt(pe)} de ${compacta(g.tot.original)} originais</dd></div>
                    <div><dt>Saldo das reservas</dt><dd>${moeda(g.tot.saldo)}</dd><dd class="rel-numeros-sub">Ainda disponível</dd></div>
                </dl>
            </section>
            <div class="rel-faixa">${faixa}</div>
            <div class="rel-legenda">${legenda}</div>`;
    }

    function fontesPainel(g, cores) {
        const cards = g.fontes.map(F => {
            const p = pct(F.valor, g.total);
            const pe = Execucao.pctUtilizado(F.utilizado, F.original);
            const [secMaior, valMaior] = [...F.secs.entries()].sort((a, b) => b[1] - a[1])[0];
            return `
                <div class="rel-fonte" style="--cor:${cores[F.chave]}">
                    <div class="rel-fonte-topo"><b>${e(Utils.rotuloFonte(F.chave))}</b><span>${pctTxt(p)}</span></div>
                    <div class="rel-fonte-nome">${e(nomeFonte(F.chave))}</div>
                    <div class="rel-fonte-valor">${moeda(F.valor)}</div>
                    <div class="rel-barra"><span style="width:${largura(p)}%"></span></div>
                    <dl class="rel-mini">
                        <div><dt>Reservas</dt><dd>${num(F.qtd)}</dd></div>
                        <div><dt>Secretarias</dt><dd>${num(F.secs.size)}</dd></div>
                        <div><dt>Utilizado</dt><dd>${pctTxt(pe)}</dd></div>
                    </dl>
                    <div class="rel-fonte-maior">Maior: ${e(Utils.nomeSecretaria(secMaior))} (${compacta(valMaior)})</div>
                </div>`;
        }).join('');
        return `<section class="rel-secao"><h2>Por Fonte de Recurso</h2><div class="rel-grade rel-grade-3">${cards}</div></section>`;
    }

    function secretariasPainel(secretarias, g, cores) {
        const ordemFonte = new Map(g.fontes.map((F, i) => [F.chave, i]));
        const cards = secretarias.map(S => {
            const pe = Execucao.pctUtilizado(S.utilizado, S.original);
            const fontes = [...S.fontes.entries()].sort((a, b) => ordemFonte.get(a[0]) - ordemFonte.get(b[0]));
            const barra = fontes.map(([f, sf]) =>
                `<span style="flex:${pct(Math.max(sf.valor, 0), S.valor).toFixed(4)} 0 0%;background:${cores[f]}"></span>`).join('');
            const linhas = fontes.map(([f, sf]) => `
                <tr>
                    <td><i style="background:${cores[f]}"></i><b>${e(Utils.rotuloFonte(f))}</b> <span>${e(Utils.nomeFonte(f))}</span></td>
                    <td class="rel-num">${moeda(sf.valor)}</td>
                    <td class="rel-num rel-suave">${pctTxt(pct(sf.valor, S.valor))}</td>
                </tr>`).join('');
            return `
                <div class="rel-sec">
                    <div class="rel-sec-topo">
                        <b>${e(Utils.nomeSecretaria(S.sec))}</b>
                        <strong>${moeda(S.valor)}</strong>
                    </div>
                    <div class="rel-sec-sub">${pctTxt(pct(S.valor, g.total))} do total, ${plural(S.qtd, 'reserva', 'reservas')}, utilizado ${pctTxt(pe)}</div>
                    <div class="rel-sec-barra">${barra}</div>
                    <table class="rel-sec-fontes"><tbody>${linhas}</tbody></table>
                </div>`;
        }).join('');
        return `<section class="rel-secao"><h2>Por Secretaria</h2><div class="rel-grade rel-grade-2">${cards}</div></section>`;
    }

    function matrizPainel(secretarias, g, cores) {
        const maxPorFonte = {};
        g.fontes.forEach(F => { maxPorFonte[F.chave] = Math.max(0, ...[...F.secs.values()]); });

        const cab = g.fontes.map(F => `<th><i style="background:${cores[F.chave]}"></i>${e(Utils.rotuloFonte(F.chave))}</th>`).join('');
        const linhas = secretarias.map(S => {
            const celulas = g.fontes.map(F => {
                const sf = S.fontes.get(F.chave);
                if (!sf) return '<td class="rel-vazio">–</td>';
                const intensidade = maxPorFonte[F.chave] > 0 ? Math.max(sf.valor, 0) / maxPorFonte[F.chave] : 0;
                return `<td style="background:${Utils.rgba(cores[F.chave], 0.05 + intensidade * 0.3)}">${decimal(sf.valor)}</td>`;
            }).join('');
            return `<tr><th scope="row">${e(Utils.nomeSecretaria(S.sec))}</th>${celulas}<td class="rel-total">${decimal(S.valor)}</td></tr>`;
        }).join('');
        const totais = g.fontes.map(F => `<td class="rel-total">${decimal(F.valor)}</td>`).join('');
        const compacto = g.fontes.length > 6 ? ' rel-matriz-compacta' : '';

        return `
            <section class="rel-secao rel-secao-matriz">
                <h2>Secretaria × Fonte</h2>
                <p class="rel-nota">Valores reservados em R$. A intensidade da cor indica o peso da secretaria dentro de cada fonte.</p>
                <table class="rel-matriz${compacto}">
                    <thead><tr><th>Secretaria</th>${cab}<th>Total</th></tr></thead>
                    <tbody>${linhas}</tbody>
                    <tfoot><tr><th scope="row">Total</th>${totais}<td class="rel-total">${decimal(g.total)}</td></tr></tfoot>
                </table>
                <p class="rel-nota">Nomes das fontes: ${g.fontes.map(F => `${e(Utils.rotuloFonte(F.chave))}, ${e(nomeFonte(F.chave))}`).join('; ')}.</p>
            </section>`;
    }

    function painel() {
        const r = Painel.dadosRelatorio();
        if (!r.dados.length) return Avisos.notificar('Não há dados para o relatório. Carregue um arquivo ou ajuste os filtros.', 'alerta');
        const { g, cores, secretarias, dados } = r;

        const html = cabecalho('Valor Reservado por Secretaria e Fonte de Recurso') +
            resumoPainel(g, cores, dados) +
            fontesPainel(g, cores) +
            secretariasPainel(secretarias, g, cores) +
            matrizPainel(secretarias, g, cores) +
            rodape();

        abrir('Relatório do painel', 'Relatorio_Painel_Secretaria_Fonte', html);
    }

    // ---------------------------- VISUALIZAÇÃO ----------------------------

    function abrir(titulo, nomeArquivo, html) {
        Dica.esconder();
        Filtros.fecharTodos();
        $('rvTitulo').textContent = titulo;
        $('rvFolha').innerHTML = html;
        $('areaRelatorio').hidden = false;
        $('areaRelatorio').scrollTop = 0;
        document.body.classList.add('modo-relatorio');
        tituloOriginal = document.title;
        document.title = `${nomeArquivo}_${Utils.hojeISO()}`;    // nome sugerido ao salvar em PDF
        aberto = true;
        $('btnRvImprimir').focus();
    }

    function fechar() {
        if (!aberto) return;
        aberto = false;
        $('areaRelatorio').hidden = true;
        $('rvFolha').innerHTML = '';
        document.body.classList.remove('modo-relatorio');
        document.title = tituloOriginal;
    }

    function iniciar() {
        $('btnRvImprimir').addEventListener('click', () => window.print());
        $('btnRvFechar').addEventListener('click', fechar);
        document.addEventListener('keydown', evento => {
            if (evento.key === 'Escape' && aberto) fechar();
        });
    }

    return { iniciar, consulta, painel, fechar, estaAberto: () => aberto };
})();
