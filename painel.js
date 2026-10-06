/* =========================================================================
   painel.js — Aba "Painel por secretaria e fonte"
   Mostra o Valor Reserva cruzando Secretaria x Fonte de recurso, a execução
   (% utilizado das reservas, ver execucao.js) e as reservas paradas, sempre sobre os MESMOS dados da aba
   Consulta (filtros das colunas + período + pesquisa).

   Regra visual: COR = FONTE. Cada fonte tem uma cor fixa (definida pela
   ordem das fontes no arquivo carregado), usada em todo o aplicativo.
   ========================================================================= */

const Painel = (() => {
    const e = Utils.esc;
    const moeda = Utils.formatarMoeda;
    const compacta = Utils.formatarMoedaCompacta;
    const pctTxt = Utils.formatarPercentual;
    const ORDEM_NATURAL = { numeric: true, sensitivity: 'base' };
    const PASSO_PARADAS = 30;

    let ultimosDados = [];
    let pendente = true;             // dados mudaram enquanto a aba estava escondida
    let visivel = false;
    let ordem = 'valor';             // cards e matriz: 'valor' | 'codigo'
    let fonteFoco = null;            // fonte destacada (clique no banner) ou null
    let animarFaixa = true;          // anima a faixa só quando os DADOS mudam
    let semAnimacao = false;         // próxima atualização não anima (troca de critério)
    let modoMatriz = 'reservado';    // 'reservado' | 'execucao'
    let modoExecucao = 'secretaria'; // 'secretaria' | 'fonte'
    let ordemExecucao = 'pct';       // 'pct' (menor % primeiro) | 'valor'
    let paradasSec = null;           // secretaria escolhida na lista de paradas
    let limiteParadas = PASSO_PARADAS;

    // Calculados a cada desenho
    let paradas = [];
    let paradasPorSec = new Map();
    let paradasPorFonte = new Map();

    const pct = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);
    const pctUso = acc => Execucao.pctUtilizado(acc.utilizado, acc.original);
    const larguraBarra = p => Math.min(Math.max(p, 0), 100).toFixed(2);
    const num = n => n.toLocaleString('pt-BR');
    const plural = (n, um, varios) => `${num(n)} ${n === 1 ? um : varios}`;

    // ------------------------------ DADOS ------------------------------

    /** Cor de cada fonte. V4.2.6: cor FIXA pelo código da fonte (Config.CORES_FONTES),
        igual em qualquer arquivo, mesmo que alguma fonte não apareça no mês. */
    function mapaCores() {
        const mapa = {};
        Estado.registros.forEach(r => {
            if (!(r.Fonte in mapa)) mapa[r.Fonte] = Utils.corFonte(r.Fonte);
        });
        return mapa;
    }

    // valor = soma do Valor Reserva (líquido: reservas − reduções, como no Fiorilli)
    // original / utilizado = só reservas positivas (base do % utilizado)
    const novoAcumulador = () => ({ valor: 0, original: 0, utilizado: 0, saldo: 0, qtd: 0 });

    function somar(acc, reg) {
        acc.valor += reg.ValorReserva;
        acc.original += Execucao.reservadoOriginal(reg);
        acc.utilizado += Execucao.utilizado(reg);
        acc.saldo += reg.SaldoReserva;
        acc.qtd++;
    }

    function agrupar(dados) {
        const porFonte = new Map();
        const porSec = new Map();
        const tot = novoAcumulador();

        dados.forEach(reg => {
            const sec = Utils.codigoSecretaria(reg.UO);
            const fonte = reg.Fonte;
            somar(tot, reg);

            let F = porFonte.get(fonte);
            if (!F) { F = Object.assign(novoAcumulador(), { chave: fonte, secs: new Map() }); porFonte.set(fonte, F); }
            somar(F, reg);
            F.secs.set(sec, (F.secs.get(sec) || 0) + reg.ValorReserva);

            let S = porSec.get(sec);
            if (!S) { S = Object.assign(novoAcumulador(), { sec, maior: 0, fontes: new Map() }); porSec.set(sec, S); }
            somar(S, reg);
            S.maior = Math.max(S.maior, reg.ValorReserva);

            let SF = S.fontes.get(fonte);
            if (!SF) { SF = novoAcumulador(); S.fontes.set(fonte, SF); }
            somar(SF, reg);
        });

        const fontes = [...porFonte.values()].sort((a, b) => a.chave.localeCompare(b.chave, undefined, ORDEM_NATURAL));
        return { total: tot.valor, tot, fontes, secretarias: [...porSec.values()], porFonte, porSec };
    }

    function contarParadas() {
        paradas = Execucao.listarParadas(ultimosDados);
        paradasPorSec = new Map();
        paradasPorFonte = new Map();
        paradas.forEach(({ reg }) => {
            const sec = Utils.codigoSecretaria(reg.UO);
            const s = paradasPorSec.get(sec) || { qtd: 0, saldo: 0 };
            s.qtd++; s.saldo += reg.SaldoReserva;
            paradasPorSec.set(sec, s);
            const f = paradasPorFonte.get(reg.Fonte) || { qtd: 0, saldo: 0 };
            f.qtd++; f.saldo += reg.SaldoReserva;
            paradasPorFonte.set(reg.Fonte, f);
        });
        if (paradasSec !== null && !paradasPorSec.has(paradasSec)) paradasSec = null;
    }

    /** Valores da secretaria considerando a fonte em destaque (se houver). */
    function accExibido(S, usarFoco = true) {
        if (!usarFoco || fonteFoco === null) return S;
        return S.fontes.get(fonteFoco) || novoAcumulador();
    }

    function ordenarSecretarias(lista, usarFoco = true) {
        if (ordem === 'codigo') {
            return lista.sort((a, b) => a.sec.localeCompare(b.sec, undefined, ORDEM_NATURAL));
        }
        return lista.sort((a, b) => accExibido(b, usarFoco).valor - accExibido(a, usarFoco).valor);
    }

    // ------------------------------ DICAS ------------------------------

    function subFonte(fonte) {
        return Utils.nomeFonte(fonte) || 'Nome não cadastrado em config.js';
    }

    function linhasExecucao(acc) {
        return [
            ['Utilizado das reservas', `${moeda(acc.utilizado)} (${pctTxt(pctUso(acc))})`],
            ['Saldo das reservas', moeda(acc.saldo)]
        ];
    }

    /** Dica de uma fonte (banner e faixa): números gerais + 3 maiores secretarias. */
    function dicaFonte(F, g, cores) {
        const p = pct(F.valor, g.total);
        const maiores = [...F.secs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
        return Dica.atributo({
            titulo: Utils.rotuloFonte(F.chave),
            sub: subFonte(F.chave),
            cor: cores[F.chave],
            selo: pctTxt(p),
            valor: moeda(F.valor),
            pct: p,
            linhas: [
                ['Reservas', num(F.qtd)],
                ['Secretarias', num(F.secs.size)],
                ['Média por reserva', moeda(F.qtd ? F.valor / F.qtd : 0)]
            ].concat(linhasExecucao(F)),
            listaTitulo: maiores.length > 1 ? 'Maiores secretarias' : 'Secretaria',
            lista: maiores.map(([sec, v]) => [Utils.nomeSecretaria(sec), `${compacta(v)} (${pctTxt(pct(v, F.valor))})`]),
            acao: fonteFoco === F.chave ? 'Clique para remover o destaque' : 'Clique para destacar esta fonte nas secretarias'
        });
    }

    /** Dica de uma secretaria dentro de uma fonte (card e matriz). */
    function dicaSecFonte(S, f, sf, g, cores) {
        const totalFonte = g.porFonte.get(f).valor;
        return Dica.atributo({
            titulo: Utils.nomeSecretaria(S.sec),
            sub: `${Utils.rotuloFonte(f)}, ${subFonte(f)}`,
            cor: cores[f],
            selo: pctTxt(pct(sf.valor, totalFonte)) + ' da fonte',
            valor: moeda(sf.valor),
            pct: pct(sf.valor, totalFonte),
            linhas: [
                ['Reservas', num(sf.qtd)],
                ['Na secretaria', pctTxt(pct(sf.valor, S.valor))],
                ['No total filtrado', pctTxt(pct(sf.valor, g.total))]
            ].concat(linhasExecucao(sf)),
            acao: 'Clique para ver estas reservas na Consulta'
        });
    }

    // ------------------------------ HTML ------------------------------

    function nomeFonteHTML(fonte) {
        const nome = Utils.nomeFonte(fonte);
        return nome ? `<span class="nome-fonte">${e(nome)}</span>` : '';
    }

    function botaoAlternar(acao, valorAtual, valor, texto) {
        return `<button type="button" data-acao="${acao}" data-valor="${valor}" aria-pressed="${valorAtual === valor}">${texto}</button>`;
    }

    function filtrosAtivosHTML() {
        const itens = Filtros.descrever();
        if (itens.length === 0) {
            return `<p class="painel-filtros-info">Mostrando todas as ${num(Estado.registros.length)} reservas carregadas, sem filtros.</p>`;
        }
        return `
            <div class="painel-filtros">
                <span class="painel-filtros-info">Valores filtrados por</span>
                ${itens.map(c => `<span class="chip-filtro" title="${e(c)}">${e(c)}</span>`).join('')}
                <button type="button" class="link-acao" data-acao="limpar-filtros">Limpar filtros</button>
            </div>`;
    }

    // -------------------------- RESUMO + FAIXA --------------------------

    function resumoHTML(g, cores) {
        const partes = g.fontes.map(F => `${Utils.rotuloFonte(F.chave)} ${pctTxt(pct(F.valor, g.total))}`).join(', ');
        const estado = F => (fonteFoco === null ? '' : (fonteFoco === F.chave ? ' em-foco' : ' apagado'));

        const segmentos = g.fontes.map((F, i) => {
            const p = pct(Math.max(F.valor, 0), g.total);
            const rotulo = p >= 6 ? `<span class="faixa-seg-pct">${pctTxt(p)}</span>` : '';
            return `<button type="button" class="faixa-seg${estado(F)}" style="--cor:${cores[F.chave]};--i:${i};flex:${p.toFixed(4)} 0 0%"
                        data-acao="foco-fonte" data-fonte="${e(F.chave)}" aria-pressed="${fonteFoco === F.chave}"
                        aria-label="${e(Utils.rotuloFonte(F.chave))}: ${pctTxt(p)}" ${dicaFonte(F, g, cores)}>${rotulo}</button>`;
        }).join('');

        const legenda = g.fontes.map(F => {
            const nome = Utils.nomeFonte(F.chave);
            return `<button type="button" class="faixa-leg${estado(F)}" style="--cor:${cores[F.chave]}"
                        data-acao="foco-fonte" data-fonte="${e(F.chave)}" aria-pressed="${fonteFoco === F.chave}"
                        ${dicaFonte(F, g, cores)}>
                        <span class="faixa-leg-cor" aria-hidden="true"></span>
                        <span class="faixa-leg-texto"><b>${e(Utils.rotuloFonte(F.chave))}</b>${nome ? `<span>${e(nome)}</span>` : ''}</span>
                        <span class="faixa-leg-pct">${pctTxt(pct(F.valor, g.total))}</span>
                    </button>`;
        }).join('');

        const classeFaixa = 'faixa-fontes' + (animarFaixa ? ' entrada' : '') + (fonteFoco !== null ? ' com-foco' : '');

        return `
            <section class="painel-resumo" aria-label="Resumo">
                <div class="painel-resumo-topo">
                    <div class="painel-resumo-total">
                        <span class="painel-rotulo">Total reservado</span>
                        <strong class="painel-valor-total">${moeda(g.total)}</strong>
                        <span class="painel-sub">
                            ${plural(ultimosDados.length, 'reserva', 'reservas')} em
                            ${plural(g.secretarias.length, 'secretaria', 'secretarias')} e
                            ${plural(g.fontes.length, 'fonte', 'fontes')} de recurso
                        </span>
                    </div>
                </div>
                <div class="faixa-bloco">
                    <div class="${classeFaixa}" role="group" aria-label="Participação no total: ${e(partes)}">${segmentos}</div>
                    <div class="faixa-legenda" role="group" aria-label="Fontes de recurso">${legenda}</div>
                </div>
            </section>`;
    }

    // ----------------------------- FONTES -----------------------------

    function bannersFonteHTML(g, cores) {
        const banners = g.fontes.map(F => {
            const p = pct(F.valor, g.total);
            const [secMaior, valMaior] = [...F.secs.entries()].sort((a, b) => b[1] - a[1])[0];
            const ativo = fonteFoco === F.chave;
            const classe = fonteFoco === null ? '' : (ativo ? ' em-foco' : ' apagado');
            return `
                <button type="button" class="banner-fonte${classe}" style="--cor:${cores[F.chave]}"
                        data-acao="foco-fonte" data-fonte="${e(F.chave)}" aria-pressed="${ativo}"
                        ${dicaFonte(F, g, cores)}>
                    <span class="bf-topo">
                        <span class="bf-codigo">${e(Utils.rotuloFonte(F.chave))}</span>
                        <span class="bf-pct">${pctTxt(p)}</span>
                    </span>
                    <span class="bf-nome">${e(Utils.nomeFonte(F.chave) || 'Nome não cadastrado')}</span>
                    <span class="bf-valor">${moeda(F.valor)}</span>
                    <span class="bf-barra"><span style="width:${larguraBarra(p)}%"></span></span>
                    <span class="bf-meta">${plural(F.qtd, 'reserva', 'reservas')} em ${plural(F.secs.size, 'secretaria', 'secretarias')}</span>
                    <span class="bf-meta">Maior: ${e(Utils.nomeSecretaria(secMaior))} (${compacta(valMaior)})</span>
                    <span class="bf-meta bf-exec">Utilizado ${pctTxt(pctUso(F))} (${compacta(F.utilizado)})</span>
                </button>`;
        }).join('');

        const aviso = fonteFoco === null
            ? '<p class="painel-dica">Clique numa fonte para ver só a participação dela em cada secretaria.</p>'
            : `<p class="painel-dica painel-dica-foco">Destacando <b>${e(Utils.rotuloFonte(fonteFoco))}</b> nas secretarias abaixo.
                   <button type="button" class="link-acao" data-acao="foco-fonte" data-fonte="${e(fonteFoco)}">Remover destaque</button></p>`;

        return `
            <section class="painel-secao" aria-labelledby="tituloFontes">
                <div class="painel-secao-topo">
                    <h2 id="tituloFontes">Por fonte de recurso</h2>
                </div>
                <div class="grade-fontes">${banners}</div>
                ${aviso}
            </section>`;
    }

    // --------------------------- SECRETARIAS ---------------------------

    function execucaoCardHTML(acc) {
        const pe = pctUso(acc);
        return `
            <div class="cs-exec">
                <div class="cs-exec-topo"><span>Utilizado das reservas</span><b>${pctTxt(pe)}</b></div>
                <div class="cs-exec-barra"><span style="width:${larguraBarra(pe)}%;background:${Execucao.corPct(pe)}"></span></div>
                <div class="cs-exec-valores"><span>${compacta(acc.utilizado)} de ${compacta(acc.original)}</span><span>Saldo ${compacta(acc.saldo)}</span></div>
            </div>`;
    }

    function cardSecretariaHTML(S, g, cores) {
        const acc = accExibido(S);
        const nome = Utils.nomeSecretaria(S.sec);
        const baseFoco = fonteFoco === null ? g.total : g.porFonte.get(fonteFoco).valor;
        const legendaPct = fonteFoco === null
            ? `${pctTxt(pct(acc.valor, g.total))} do total`
            : `${pctTxt(pct(acc.valor, baseFoco))} da ${e(Utils.rotuloFonte(fonteFoco))}`;

        const fontesSec = [...S.fontes.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], undefined, ORDEM_NATURAL));

        const barra = fontesSec.map(([f, sf]) =>
            `<span style="flex-grow:${pct(Math.max(sf.valor, 0), S.valor)};background:${cores[f]}"
                   class="${fonteFoco !== null && f !== fonteFoco ? 'apagado' : ''}"></span>`
        ).join('');

        const linhas = fontesSec.map(([f, sf]) => `
            <li>
                <button type="button" class="cs-fonte${fonteFoco !== null && f !== fonteFoco ? ' apagado' : ''}"
                        data-acao="ver" data-sec="${e(S.sec)}" data-fonte="${e(f)}"
                        ${dicaSecFonte(S, f, sf, g, cores)}>
                    <span class="cs-ponto" style="background:${cores[f]}"></span>
                    <span class="cs-fonte-nome"><b>${e(Utils.rotuloFonte(f))}</b>${nomeFonteHTML(f)}</span>
                    <span class="cs-fonte-valor">
                        ${moeda(sf.valor)}
                        <small>${pctTxt(pct(sf.valor, S.valor))} da secretaria</small>
                    </span>
                </button>
            </li>`).join('');

        const par = paradasPorSec.get(S.sec);
        const alerta = par
            ? `<button type="button" class="selo-alerta" data-acao="paradas-sec" data-sec="${e(S.sec)}"
                       ${Dica.atributo({ titulo: 'Reservas paradas', sub: nome, cor: Config.COR_ALERTA, valor: moeda(par.saldo), linhas: [['Reservas', num(par.qtd)]], acao: 'Clique para ver a lista' })}>
                   ${plural(par.qtd, 'parada', 'paradas')}</button>`
            : '';

        return `
            <article class="card-sec">
                <header class="cs-topo">
                    <div class="cs-nome" title="${e(nome)}">${e(nome)}</div>
                    <div class="cs-valor">${moeda(acc.valor)}</div>
                    <div class="cs-pct">${legendaPct}</div>
                </header>
                <div class="cs-barra" aria-hidden="true">${barra}</div>
                ${execucaoCardHTML(acc)}
                <ul class="cs-fontes">${linhas}</ul>
                <footer class="cs-rodape">
                    <span class="cs-rodape-texto">${plural(S.qtd, 'reserva', 'reservas')}, maior ${compacta(S.maior)}</span>
                    ${alerta}
                    <button type="button" class="link-acao" data-acao="ver" data-sec="${e(S.sec)}">Ver reservas</button>
                </footer>
            </article>`;
    }

    function secretariasHTML(g, cores) {
        let lista = g.secretarias;
        if (fonteFoco !== null) lista = lista.filter(S => S.fontes.has(fonteFoco));
        lista = ordenarSecretarias(lista.slice());

        return `
            <section class="painel-secao" aria-labelledby="tituloSecretarias">
                <div class="painel-secao-topo">
                    <h2 id="tituloSecretarias">Por secretaria
                        <span class="painel-contagem">${lista.length}</span></h2>
                    <div class="seletor-ordem" role="group" aria-label="Ordenar secretarias">
                        ${botaoAlternar('ordem', ordem, 'valor', 'Maior valor')}${botaoAlternar('ordem', ordem, 'codigo', 'Código da UO')}
                    </div>
                </div>
                <div class="grade-secretarias">${lista.map(S => cardSecretariaHTML(S, g, cores)).join('')}</div>
            </section>`;
    }

    // ---------------------------- EXECUÇÃO ----------------------------

    function execucaoHTML(g, cores) {
        const porFonte = modoExecucao === 'fonte';
        let itens = porFonte
            ? g.fontes.map(F => ({
                acc: F, cor: cores[F.chave], paradas: (paradasPorFonte.get(F.chave) || {}).qtd || 0,
                nome: Utils.rotuloFonte(F.chave), sub: Utils.nomeFonte(F.chave),
                botao: `data-acao="ver-fonte" data-fonte="${e(F.chave)}"`
            }))
            : g.secretarias.map(S => ({
                acc: S, cor: null, paradas: (paradasPorSec.get(S.sec) || {}).qtd || 0,
                nome: Utils.nomeSecretaria(S.sec), sub: '',
                botao: `data-acao="ver" data-sec="${e(S.sec)}"`
            }));

        itens = ordemExecucao === 'pct'
            ? itens.sort((a, b) => pctUso(a.acc) - pctUso(b.acc) || b.acc.original - a.acc.original)
            : itens.sort((a, b) => b.acc.original - a.acc.original);

        const barra = acc => {
            const pe = pctUso(acc);
            return `<span class="ex-barra"><span style="width:${larguraBarra(pe)}%;background:${Execucao.corPct(pe)}"></span></span><b>${pctTxt(pe)}</b>`;
        };

        const linhas = itens.map(it => `
            <tr>
                <th scope="row">
                    <button type="button" class="ex-nome" ${it.botao}>
                        ${it.cor ? `<span class="cs-ponto" style="background:${it.cor}"></span>` : ''}
                        <span>${e(it.nome)}${it.sub ? `<small>${e(it.sub)}</small>` : ''}</span>
                    </button>
                </th>
                <td class="num">${moeda(it.acc.original)}</td>
                <td class="num">${moeda(it.acc.utilizado)}</td>
                <td class="num">${moeda(it.acc.saldo)}</td>
                <td class="ex-pct">${barra(it.acc)}</td>
                <td class="num">${it.paradas ? `<span class="selo-alerta selo-estatico">${num(it.paradas)}</span>` : '<span class="ex-zero">–</span>'}</td>
            </tr>`).join('');

        return `
            <section class="painel-secao" aria-labelledby="tituloExecucao">
                <div class="painel-secao-topo">
                    <h2 id="tituloExecucao">Execução das reservas</h2>
                    <div class="painel-controles">
                        <div class="seletor-ordem" role="group" aria-label="Agrupar execução">
                            ${botaoAlternar('modo-exec', modoExecucao, 'secretaria', 'Por secretaria')}${botaoAlternar('modo-exec', modoExecucao, 'fonte', 'Por fonte')}
                        </div>
                        <div class="seletor-ordem" role="group" aria-label="Ordenar execução">
                            ${botaoAlternar('ordem-exec', ordemExecucao, 'pct', 'Menor % utilizado')}${botaoAlternar('ordem-exec', ordemExecucao, 'valor', 'Maior valor')}
                        </div>
                    </div>
                </div>
                <p class="painel-dica">% utilizado = (valor reservado − saldo da reserva) ÷ valor reservado, considerando só as reservas originais; as reduções (valores negativos) já estão refletidas no saldo.
                    <span class="leg-exec"><i style="background:${Config.CORES_EXECUCAO.baixa}"></i>abaixo de ${Config.LIMITES_EXECUCAO[0]}%</span>
                    <span class="leg-exec"><i style="background:${Config.CORES_EXECUCAO.media}"></i>${Config.LIMITES_EXECUCAO[0]}% a ${Config.LIMITES_EXECUCAO[1]}%</span>
                    <span class="leg-exec"><i style="background:${Config.CORES_EXECUCAO.alta}"></i>${Config.LIMITES_EXECUCAO[1]}% ou mais</span></p>
                <div class="matriz-rolagem">
                    <table class="tabela-exec">
                        <thead><tr>
                            <th scope="col">${porFonte ? 'Fonte' : 'Secretaria'}</th>
                            <th scope="col" class="num">Reservado originalmente</th><th scope="col" class="num">Utilizado</th>
                            <th scope="col" class="num">Saldo da reserva</th><th scope="col">% utilizado</th>
                            <th scope="col" class="num">Paradas</th>
                        </tr></thead>
                        <tbody>${linhas}</tbody>
                        <tfoot><tr>
                            <th scope="row">Total</th>
                            <td class="num">${moeda(g.tot.original)}</td><td class="num">${moeda(g.tot.utilizado)}</td>
                            <td class="num">${moeda(g.tot.saldo)}</td><td class="ex-pct">${barra(g.tot)}</td>
                            <td class="num">${num(paradas.length)}</td>
                        </tr></tfoot>
                    </table>
                </div>
            </section>`;
    }

    // ---------------------------- PARADAS ----------------------------

    function paradasFiltradas() {
        return paradasSec === null ? paradas : paradas.filter(p => Utils.codigoSecretaria(p.reg.UO) === paradasSec);
    }

    function paradasHTML(cores) {
        const { dias, saldoMinimo } = Execucao.obterParametros();
        const lista = paradasFiltradas();
        const saldoLista = lista.reduce((s, p) => s + p.reg.SaldoReserva, 0);

        const chips = [...paradasPorSec.entries()].sort((a, b) => b[1].saldo - a[1].saldo).map(([sec, s]) => `
            <button type="button" class="chip-sec" data-acao="paradas-sec" data-sec="${e(sec)}" aria-pressed="${paradasSec === sec}">
                ${e(Utils.nomeSecretaria(sec))} <b>${num(s.qtd)}</b> <span>${compacta(s.saldo)}</span>
            </button>`).join('');

        const linhas = lista.slice(0, limiteParadas).map(({ reg, dias: d, ultima }) => `
            <tr>
                <td class="txt-centro"><button type="button" class="link-acao" data-acao="ficha" data-id="${reg._id}">${e(reg.Reserva)}</button></td>
                <td class="txt-centro">${e(reg.Data)}</td>
                <td class="txt-centro">${e(Utils.dataISOparaBR(ultima))}</td>
                <td class="num"><span class="dias-parada">${num(d)}</span></td>
                <td>${e(Utils.nomeSecretaria(reg.UO))}</td>
                <td class="txt-centro"><span class="cs-ponto" style="background:${cores[reg.Fonte] || '#94a3b8'}"></span> ${e(reg.Fonte)}</td>
                <td class="par-historico" title="${e(reg.Historico)}">${e(reg.Historico)}</td>
                <td class="num">${moeda(reg.ValorReserva)}</td>
                <td class="num">${pctTxt(Execucao.pctUtilizado(Execucao.utilizado(reg), reg.ValorReserva))}</td>
                <td class="num"><b>${moeda(reg.SaldoReserva)}</b></td>
            </tr>`).join('');

        const restantes = lista.length - Math.min(lista.length, limiteParadas);

        const corpo = lista.length === 0
            ? `<div class="paradas-vazio">Nenhuma reserva parada com estes critérios${paradasSec ? ' nesta secretaria' : ''}.</div>`
            : `
                <div class="matriz-rolagem">
                    <table class="tabela-paradas">
                        <thead><tr>
                            <th>Reserva</th><th>Data</th><th>Última movimentação</th><th class="num">Dias parada</th><th>Secretaria</th><th>Fonte</th><th>Histórico</th>
                            <th class="num">Valor reserva</th><th class="num">% utilizado</th><th class="num">Saldo reserva</th>
                        </tr></thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                ${restantes > 0 ? `<button type="button" class="btn btn-secondary btn-mais-paradas" data-acao="paradas-mais">Mostrar mais (${num(Math.min(restantes, PASSO_PARADAS))} de ${num(restantes)} restantes)</button>` : ''}`;

        return `
            <section class="painel-secao" id="secaoParadas" aria-labelledby="tituloParadas">
                <div class="painel-secao-topo">
                    <h2 id="tituloParadas">Reservas paradas <span class="painel-contagem">${num(paradas.length)}</span></h2>
                    <div class="painel-controles">
                        <button type="button" class="btn btn-secondary" data-acao="paradas-consulta" ${lista.length ? '' : 'disabled'}>Ver na Consulta</button>
                        <button type="button" class="btn" data-acao="paradas-excel" ${lista.length ? '' : 'disabled'}>Exportar (XLSX)</button>
                    </div>
                </div>
                <div class="paradas-criterios">
                    <label for="parDias">Sem movimentação há mais de</label>
                    <input type="number" id="parDias" min="1" step="1" value="${dias}" inputmode="numeric">
                    <label for="parSaldo">dias e saldo a partir de R$</label>
                    <input type="text" id="parSaldo" value="${Utils.formatarDecimal(saldoMinimo)}" inputmode="numeric">
                    <span class="painel-dica">Tecle Enter ou saia do campo para aplicar.</span>
                </div>
                <p class="painel-dica">Reservas com saldo e sem movimentação recente: úteis para a cobrança das secretarias.
                    Conta como movimentação a data da reserva ou a redução mais recente na mesma ficha.
                    ${lista.length ? `A lista soma <b>${moeda(saldoLista)}</b> de saldo.` : ''}</p>
                ${chips ? `<div class="chips-secretarias" role="group" aria-label="Filtrar paradas por secretaria">
                    <button type="button" class="chip-sec" data-acao="paradas-sec" data-sec="" aria-pressed="${paradasSec === null}">Todas <b>${num(paradas.length)}</b></button>${chips}</div>` : ''}
                ${corpo}
            </section>`;
    }

    // ----------------------------- MATRIZ -----------------------------

    function matrizHTML(g, cores) {
        const secs = ordenarSecretarias(g.secretarias.slice());
        const exec = modoMatriz === 'execucao';
        const maxPorFonte = {};
        g.fontes.forEach(F => { maxPorFonte[F.chave] = Math.max(0, ...[...F.secs.values()]); });

        const cabecalho = g.fontes.map(F => {
            const foco = fonteFoco === F.chave ? ' class="mz-foco"' : '';
            return `<th${foco} scope="col"><span class="cs-ponto" style="background:${cores[F.chave]}"></span>${e(Utils.rotuloFonte(F.chave))}</th>`;
        }).join('');

        const texto = acc => (exec ? pctTxt(pctUso(acc)) : compacta(acc.valor));

        const linhas = secs.map(S => {
            const celulas = g.fontes.map(F => {
                const sf = S.fontes.get(F.chave);
                if (!sf) return '<td class="mz-vazio">–</td>';
                const intensidade = exec
                    ? Math.min(Math.max(pctUso(sf), 0), 100) / 100
                    : (maxPorFonte[F.chave] > 0 ? Math.max(sf.valor, 0) / maxPorFonte[F.chave] : 0);
                const alfa = 0.08 + intensidade * 0.82;
                return `<td><button type="button" class="mz-cel${alfa > 0.5 ? ' mz-cel-escura' : ''}"
                            style="background:${Utils.rgba(cores[F.chave], alfa)}"
                            data-acao="ver" data-sec="${e(S.sec)}" data-fonte="${e(F.chave)}"
                            ${dicaSecFonte(S, F.chave, sf, g, cores)}>${texto(sf)}</button></td>`;
            }).join('');
            return `<tr><th scope="row">${e(Utils.nomeSecretaria(S.sec))}</th>${celulas}<td class="mz-total">${texto(S)}</td></tr>`;
        }).join('');

        const totais = g.fontes.map(F => `<td class="mz-total">${texto(F)}</td>`).join('');

        return `
            <section class="painel-secao" aria-labelledby="tituloMatriz">
                <div class="painel-secao-topo">
                    <h2 id="tituloMatriz">Secretaria × fonte</h2>
                    <div class="painel-controles">
                        <div class="seletor-ordem" role="group" aria-label="Valor exibido na matriz">
                            ${botaoAlternar('modo-matriz', modoMatriz, 'reservado', 'Valor reservado')}${botaoAlternar('modo-matriz', modoMatriz, 'execucao', '% utilizado')}
                        </div>
                        <button type="button" class="btn" data-acao="exportar-matriz">Exportar para Excel</button>
                    </div>
                </div>
                <p class="painel-dica">${exec
                    ? 'Quanto mais forte a cor, maior o % utilizado das reservas. Clique num valor para ver as reservas.'
                    : 'Quanto mais forte a cor, maior o valor dentro daquela fonte. Clique num valor para ver as reservas.'}</p>
                <div class="matriz-rolagem">
                    <table class="matriz">
                        <thead><tr><th scope="col">Secretaria</th>${cabecalho}<th scope="col">Total</th></tr></thead>
                        <tbody>${linhas}</tbody>
                        <tfoot><tr><th scope="row">Total</th>${totais}<td class="mz-total">${texto(g.tot)}</td></tr></tfoot>
                    </table>
                </div>
            </section>`;
    }

    function vazioHTML(titulo, texto, acao, rotuloAcao) {
        return `
            <div class="painel-vazio">
                <strong>${titulo}</strong>
                <p>${texto}</p>
                <button type="button" class="btn" data-acao="${acao}">${rotuloAcao}</button>
            </div>`;
    }

    // ---------------------------- DESENHO ----------------------------

    function desenhar() {
        pendente = false;
        const alvo = document.getElementById('conteudoPainel');

        if (Estado.registros.length === 0) {
            alvo.innerHTML = vazioHTML('Nenhum relatório carregado',
                'Carregue o arquivo de reservas na aba Consulta para montar o painel.',
                'ir-consulta', 'Ir para a Consulta');
            return;
        }
        if (ultimosDados.length === 0) {
            alvo.innerHTML = filtrosAtivosHTML() + vazioHTML('Nenhuma reserva atende aos filtros atuais',
                'Os filtros, o período e a pesquisa da aba Consulta também valem para este painel.',
                'limpar-filtros', 'Limpar filtros');
            return;
        }

        const g = agrupar(ultimosDados);
        if (fonteFoco !== null && !g.porFonte.has(fonteFoco)) fonteFoco = null;
        const cores = mapaCores();
        contarParadas();

        alvo.innerHTML =
            filtrosAtivosHTML() +
            resumoHTML(g, cores) +
            bannersFonteHTML(g, cores) +
            secretariasHTML(g, cores) +
            execucaoHTML(g, cores) +
            paradasHTML(cores) +
            matrizHTML(g, cores);
        animarFaixa = false;
    }

    /** Chamado a cada mudança de dados/filtros; só desenha se a aba estiver visível. */
    function atualizar(dados) {
        ultimosDados = dados;
        animarFaixa = !semAnimacao;
        semAnimacao = false;
        limiteParadas = PASSO_PARADAS;
        if (visivel) desenhar();
        else pendente = true;
    }

    function definirVisivel(sim) {
        visivel = sim;
        if (sim && pendente) desenhar();
    }

    /** Dados prontos para o relatório e a exportação (sem o destaque de fonte). */
    function dadosRelatorio() {
        const g = agrupar(ultimosDados);
        return { dados: ultimosDados, g, cores: mapaCores(), secretarias: ordenarSecretarias(g.secretarias.slice(), false) };
    }

    // ----------------------------- EVENTOS -----------------------------

    function tratarClique(evento) {
        const alvo = evento.target.closest('[data-acao]');
        if (!alvo || alvo.disabled) return;
        const acao = alvo.dataset.acao;
        const valor = alvo.dataset.valor;

        switch (acao) {
            case 'foco-fonte':
                fonteFoco = fonteFoco === alvo.dataset.fonte ? null : alvo.dataset.fonte;
                desenhar(); break;
            case 'ordem': ordem = valor; desenhar(); break;
            case 'modo-exec': modoExecucao = valor; desenhar(); break;
            case 'ordem-exec': ordemExecucao = valor; desenhar(); break;
            case 'modo-matriz': modoMatriz = valor; desenhar(); break;
            case 'ver':
                App.verReservas(alvo.dataset.sec, alvo.dataset.fonte === undefined ? null : alvo.dataset.fonte); break;
            case 'ver-fonte': App.verReservas(null, alvo.dataset.fonte); break;
            case 'limpar-filtros': App.limparFiltros(); break;
            case 'ir-consulta': App.trocarAba('consulta'); break;
            case 'ir-paradas':
                document.getElementById('secaoParadas').scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
            case 'paradas-sec': {
                const sec = alvo.dataset.sec || null;
                paradasSec = paradasSec === sec ? null : sec;
                limiteParadas = PASSO_PARADAS;
                desenhar();
                document.getElementById('secaoParadas').scrollIntoView({ behavior: 'smooth', block: 'start' });
                break;
            }
            case 'paradas-mais': limiteParadas += PASSO_PARADAS; desenhar(); break;
            case 'paradas-consulta': App.filtrarReservas(paradasFiltradas().map(p => p.reg), false); break;
            case 'paradas-excel': Exportacao.paradas(paradasFiltradas()); break;
            case 'exportar-matriz': Exportacao.matriz(dadosRelatorio()); break;
            case 'ficha': {
                const reg = Estado.buscar(Number(alvo.dataset.id));
                if (reg) Modais.abrirFicha(reg);
                break;
            }
        }
    }

    /** Critérios das reservas paradas: aplicados ao sair do campo ou teclar Enter. */
    function tratarMudanca(evento) {
        if (evento.target.id !== 'parDias' && evento.target.id !== 'parSaldo') return;
        const dias = parseInt(document.getElementById('parDias').value, 10);
        const saldo = Utils.converterParaNumero(document.getElementById('parSaldo').value);
        Execucao.definirParametros(dias, saldo);
        semAnimacao = true;
        const foco = evento.target.id;
        App.renderizar();                        // a tabela da Consulta também marca as paradas
        const campo = document.getElementById(foco);
        if (campo && document.activeElement === document.body) campo.focus();
    }

    /** Passar o mouse num segmento da faixa realça o item da legenda (e vice-versa). */
    function realcarFonte(evento, ligar) {
        const item = evento.target.closest('.faixa-seg, .faixa-leg');
        if (!item) return;
        if (!ligar && evento.relatedTarget && item.contains(evento.relatedTarget)) return;
        const bloco = item.closest('.faixa-bloco');
        bloco.classList.toggle('com-realce', ligar);
        bloco.querySelectorAll('.faixa-seg, .faixa-leg').forEach(el => {
            el.classList.toggle('realcado', ligar && el.dataset.fonte === item.dataset.fonte);
        });
    }

    function iniciar() {
        const alvo = document.getElementById('conteudoPainel');
        alvo.addEventListener('click', tratarClique);
        alvo.addEventListener('change', tratarMudanca);
        alvo.addEventListener('input', evento => {
            if (evento.target.id === 'parSaldo') Modais.aplicarMascaraMoeda(evento.target);
        });
        alvo.addEventListener('pointerover', ev => realcarFonte(ev, true));
        alvo.addEventListener('pointerout', ev => realcarFonte(ev, false));
    }

    return { iniciar, atualizar, definirVisivel, cores: mapaCores, agrupar, dadosRelatorio };
})();
