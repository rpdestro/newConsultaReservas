/* =========================================================================
   comparacao.js — O que entrou, saiu ou mudou entre duas listas de reservas

   Dois modos:
   - Última importação (automático): feito quando um arquivo novo substitui
     outro já carregado (Estado.substituirTodos). Salvo no navegador.
   - Comparar dois arquivos (manual): o usuário escolhe o Arquivo A (mais
     antigo) e o Arquivo B (mais recente). Fica só na sessão
     (Estado.comparacaoManual) e não altera os dados da Consulta.

   A chave de comparação é o nº da Reserva (repetições viram "1234#2").

   Processos-chave: além do total geral, soma as reservas dos
   processos listados em Config.PROCESSOS_CHAVE, separadas por fonte de
   recurso, com a Config.FONTE_DESTAQUE em evidência. Clicar em um processo
   filtra as listas de Novas, Saíram e Alteradas.
   ========================================================================= */

const Comparacao = (() => {
    const e = Utils.esc;
    const moeda = Utils.formatarMoeda;
    const $ = id => document.getElementById(id);
    const LIMITE_TELA = 300;          // linhas por lista na tela (a exportação traz todas)

    let aba = 'entraram';             // 'entraram' | 'sairam' | 'alteradas'
    let modo = 'auto';                // 'auto' | 'manual'

    // Bloco "Processos-chave"
    let metrica = 'saldo';            // 'saldo' | 'valor'
    let ocultarZeros = true;          // esconde processo/fonte sem variação nem movimento
    let filtro = null;                // chave "processo|fonte" que filtra as listas (ou null)
    let abertas = new Set([String(Config.FONTE_DESTAQUE)]);   // fontes expandidas na tabela

    // Dados do modo manual (somente em memória)
    const manual = {
        arquivoA: null, arquivoB: null,   // File escolhidos
        listaA: null, listaB: null,       // registros já normalizados (permitem inverter sem reler)
        infoA: null, infoB: null,
        processando: false,
        pedido: 0,                        // descarta leituras antigas se o usuário limpar no meio
        msg: null                         // { texto, tipo: 'info' | 'ok' | 'aviso' | 'erro' }
    };

    /** Comparação exibida no momento (conforme o modo escolhido). */
    function ativa() {
        return modo === 'manual' ? Estado.comparacaoManual : Estado.comparacao;
    }

    const ehManual = c => !!c && c.origem === 'manual';
    const rotulos = c => (ehManual(c) ? ['Arquivo A', 'Arquivo B'] : ['Anterior', 'Atual']);

    // ------------------------------ CÁLCULO ------------------------------

    function indexar(lista) {
        const vezes = {};
        const mapa = new Map();
        let repetidas = 0;
        lista.forEach(reg => {
            const base = reg.Reserva;
            vezes[base] = (vezes[base] || 0) + 1;
            if (vezes[base] > 1) repetidas++;
            mapa.set(vezes[base] === 1 ? base : `${base}#${vezes[base]}`, reg);
        });
        return { mapa, repetidas };
    }

    function diferente(campo, a, b) {
        if (Config.CAMPOS_MONETARIOS.includes(campo)) return Math.abs((a || 0) - (b || 0)) > 0.004;
        return Utils.texto(a).trim() !== Utils.texto(b).trim();
    }

    function resumoArquivo(info, lista) {
        const soma = campo => lista.reduce((t, r) => t + (r[campo] || 0), 0);
        return {
            arquivo: info ? info.arquivo : 'Registros incluídos manualmente',
            carregadoEm: info ? info.carregadoEm : null,
            qtd: lista.length,
            valor: soma('ValorReserva'),
            saldo: soma('SaldoReserva')
        };
    }

    // ------------------------- PROCESSOS-CHAVE -------------------------

    /** "001.003 - Descrição" -> "001.003" (comparação exata, sem incluir subitens). */
    function codigoProcesso(valor) {
        const m = Utils.texto(valor).trim().match(/^[\d.]+/);
        return m ? m[0].replace(/\.+$/, '') : '';
    }

    /** "01", "1" ou "01.110.0000" -> 1; vazio -> null. */
    function codigoFonte(valor) {
        const m = Utils.texto(valor).trim().match(/^\d+/);
        return m ? parseInt(m[0], 10) : null;
    }

    /** Chave "processo|fonte" da reserva, ou null se o processo não é acompanhado. */
    function grupoDe(reg) {
        const processo = codigoProcesso(reg.Processo);
        if (!(Config.PROCESSOS_CHAVE || []).includes(processo)) return null;
        const fonte = codigoFonte(reg.Fonte);
        return `${processo}|${fonte === null ? '' : fonte}`;
    }

    function nomeFonte(fonte) {
        if (fonte === null) return 'Sem fonte';
        const nome = Config.FONTES && Config.FONTES[fonte];
        return `Fonte ${String(fonte).padStart(2, '0')}${nome ? ` – ${nome}` : ''}`;
    }

    const chaveFonte = f => (f === null ? 'sem' : String(f));

    function calcular(antes, depois, infoAntes, infoDepois) {
        const { mapa: A, repetidas: repA } = indexar(antes);
        const { mapa: D, repetidas: repD } = indexar(depois);
        const entraram = [];
        const sairam = [];
        const alteradas = [];
        let iguais = 0;

        // Totais por processo-chave e fonte
        const grupos = new Map();
        const grupo = reg => {
            const chave = grupoDe(reg);
            if (!chave) return null;
            if (!grupos.has(chave)) {
                const [processo, f] = chave.split('|');
                grupos.set(chave, {
                    processo, fonte: f === '' ? null : Number(f),
                    antes: { valor: 0, saldo: 0, qtd: 0 }, depois: { valor: 0, saldo: 0, qtd: 0 },
                    novas: 0, sairam: 0, alteradas: 0, iguais: 0
                });
            }
            return grupos.get(chave);
        };
        const somar = lado => reg => {
            const g = grupo(reg);
            if (!g) return;
            g[lado].valor += reg.ValorReserva || 0;
            g[lado].saldo += reg.SaldoReserva || 0;
            g[lado].qtd++;
        };
        antes.forEach(somar('antes'));
        depois.forEach(somar('depois'));

        D.forEach((reg, chave) => {
            const anterior = A.get(chave);
            if (!anterior) { entraram.push(reg); return; }
            const campos = Config.CAMPOS_COMPARACAO.filter(c => diferente(c, anterior[c], reg[c]));
            if (campos.length) {
                alteradas.push({ antes: anterior, depois: reg, campos });
            } else {
                iguais++;
                const g = grupo(reg);
                if (g) g.iguais++;
            }
        });
        A.forEach((reg, chave) => { if (!D.has(chave)) sairam.push(reg); });

        entraram.forEach(r => { const g = grupo(r); if (g) g.novas++; });
        sairam.forEach(r => { const g = grupo(r); if (g) g.sairam++; });
        alteradas.forEach(a => {                     // se mudou de processo/fonte, conta nos dois grupos
            const gD = grupo(a.depois);
            const gA = grupo(a.antes);
            if (gD) gD.alteradas++;
            if (gA && gA !== gD) gA.alteradas++;
        });

        return {
            calculadaEm: new Date().toISOString(),
            anterior: resumoArquivo(infoAntes, antes),
            atual: resumoArquivo(infoDepois, depois),
            entraram, sairam, alteradas, iguais,
            repetidas: repA + repD,
            processosChave: {
                processos: [...(Config.PROCESSOS_CHAVE || [])],
                fonteDestaque: Config.FONTE_DESTAQUE,
                grupos: [...grupos.values()]
            }
        };
    }

    /** "12 novas, 3 saíram e 40 alteradas" */
    function resumoTexto(c) {
        const partes = [
            `${c.entraram.length.toLocaleString('pt-BR')} ${c.entraram.length === 1 ? 'nova' : 'novas'}`,
            `${c.sairam.length.toLocaleString('pt-BR')} ${c.sairam.length === 1 ? 'saiu' : 'saíram'}`,
            `${c.alteradas.length.toLocaleString('pt-BR')} ${c.alteradas.length === 1 ? 'alterada' : 'alteradas'}`
        ];
        return `${partes[0]}, ${partes[1]} e ${partes[2]}`;
    }

    // ------------------------------- TELA -------------------------------

    function dataHora(iso) {
        return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'data não registrada';
    }

    function valorCampo(campo, valor) {
        if (Config.CAMPOS_MONETARIOS.includes(campo)) return moeda(valor);
        const t = Utils.texto(valor).trim();
        return t === '' ? '(vazio)' : t;
    }

    function variacao(antes, depois) {
        const d = depois - antes;
        if (Math.abs(d) < 0.005) return '<span class="cmp-igual">sem variação</span>';
        return `<span class="${d > 0 ? 'cmp-sobe' : 'cmp-desce'}">${d > 0 ? '+' : '−'} ${moeda(Math.abs(d))}</span>`;
    }

    function arquivosHTML(c) {
        const [rotA, rotB] = rotulos(c);
        const bloco = (rotulo, a) => `
            <div class="cmp-arquivo">
                <span class="cmp-arquivo-rotulo">${rotulo}</span>
                <strong title="${e(a.arquivo)}">${e(a.arquivo)}</strong>
                <small>Carregado em ${dataHora(a.carregadoEm)}, ${a.qtd.toLocaleString('pt-BR')} reservas</small>
            </div>`;
        const linha = (rotulo, campo) => `
            <tr><th scope="row">${rotulo}</th><td>${moeda(c.anterior[campo])}</td><td>${moeda(c.atual[campo])}</td>
                <td>${variacao(c.anterior[campo], c.atual[campo])}</td></tr>`;

        return `
            <div class="cmp-arquivos">${bloco(rotA, c.anterior)}${bloco(rotB, c.atual)}</div>
            <table class="tabela-simples cmp-totais">
                <thead><tr><th scope="col">Total</th><th scope="col">${rotA}</th><th scope="col">${rotB}</th><th scope="col">Variação</th></tr></thead>
                <tbody>${linha('Valor reservado', 'valor')}${linha('Saldo das reservas', 'saldo')}</tbody>
            </table>`;
    }

    /** Separa reservas (valor positivo) de anulações (valor negativo). */
    function detalheValores(lista) {
        let reservado = 0;
        let anulado = 0;
        lista.forEach(r => {
            const v = r.ValorReserva || 0;
            if (v < 0) anulado -= v; else reservado += v;
        });
        return anulado > 0.004
            ? `${moeda(reservado)} reservados<br>${moeda(anulado)} anulados`
            : `${moeda(reservado)} reservados`;
    }

    function detalheAlteradas(c) {
        const dif = c.alteradas.reduce((t, a) => t + ((a.depois.SaldoReserva || 0) - (a.antes.SaldoReserva || 0)), 0);
        return `Saldo: ${variacao(0, dif)}<br>${c.iguais.toLocaleString('pt-BR')} sem alteração`;
    }

    function abasHTML(c) {
        const botao = (id, rotulo, qtd, detalhe) => `
            <button type="button" role="tab" class="cmp-aba cmp-aba-${id}" data-acao="aba-comparacao" data-aba="${id}"
                    aria-selected="${aba === id}">
                <span>${rotulo}</span>
                <strong>${qtd.toLocaleString('pt-BR')}</strong>
                <small>${detalhe}</small>
            </button>`;
        return `
            <div class="cmp-abas" role="tablist" aria-label="Diferenças">
                ${botao('entraram', 'Novas', c.entraram.length, detalheValores(c.entraram))}
                ${botao('sairam', 'Saíram', c.sairam.length, detalheValores(c.sairam))}
                ${botao('alteradas', 'Alteradas', c.alteradas.length, detalheAlteradas(c))}
            </div>`;
    }

    function listaReservasHTML(lista, podeVer) {
        if (!lista.length) return '<p class="cmp-vazio">Nenhuma reserva nesta lista.</p>';
        const linhas = lista.slice(0, LIMITE_TELA).map(r => `
            <tr>
                <td class="txt-centro"><b>${e(r.Reserva)}</b></td>
                <td class="txt-centro">${e(r.Data)}</td>
                <td>${e(Utils.nomeSecretaria(r.UO))}</td>
                <td class="txt-centro">${e(r.Fonte)}</td>
                <td class="cmp-historico">${e(r.Historico)}</td>
                <td class="num">${moeda(r.ValorReserva)}</td>
                <td class="num">${moeda(r.SaldoReserva)}</td>
            </tr>`).join('');
        return `
            ${avisoLimite(lista.length)}
            <div class="cmp-rolagem"><table class="tabela-simples">
                <thead><tr><th>Reserva</th><th>Data</th><th>Secretaria</th><th>Fonte</th><th>Histórico</th><th class="num">Valor reserva</th><th class="num">Saldo reserva</th></tr></thead>
                <tbody>${linhas}</tbody>
            </table></div>
            ${podeVer ? '<button type="button" class="btn btn-sm-inline" data-acao="ver-consulta">Ver estas reservas na Consulta</button>' : ''}`;
    }

    function alteradasHTML(c, podeVer) {
        if (!c.alteradas.length) return '<p class="cmp-vazio">Nenhuma reserva foi alterada.</p>';

        const porCampo = {};
        c.alteradas.forEach(a => a.campos.forEach(campo => { porCampo[campo] = (porCampo[campo] || 0) + 1; }));
        const resumo = Object.entries(porCampo).sort((a, b) => b[1] - a[1])
            .map(([campo, n]) => `<span class="chip-filtro">${e(Config.ROTULOS[campo])}: ${n.toLocaleString('pt-BR')}</span>`).join('');

        const linhas = c.alteradas.slice(0, LIMITE_TELA).map(a => a.campos.map((campo, i) => {
            const monetario = Config.CAMPOS_MONETARIOS.includes(campo);
            const primeira = i === 0 ? `
                <td rowspan="${a.campos.length}" class="txt-centro"><b>${e(a.depois.Reserva)}</b></td>
                <td rowspan="${a.campos.length}">${e(Utils.nomeSecretaria(a.depois.UO))}</td>` : '';
            return `
                <tr class="${i === 0 ? 'cmp-primeira' : ''}">
                    ${primeira}
                    <td>${e(Config.ROTULOS[campo])}</td>
                    <td class="${monetario ? 'num' : ''} cmp-antes">${e(valorCampo(campo, a.antes[campo]))}</td>
                    <td class="${monetario ? 'num' : ''}">${e(valorCampo(campo, a.depois[campo]))}</td>
                    <td class="num">${monetario ? variacao(a.antes[campo], a.depois[campo]) : ''}</td>
                </tr>`;
        }).join('')).join('');

        return `
            <div class="cmp-campos"><span class="painel-filtros-info">Campos alterados</span>${resumo}</div>
            ${avisoLimite(c.alteradas.length)}
            <div class="cmp-rolagem"><table class="tabela-simples">
                <thead><tr><th>Reserva</th><th>Secretaria</th><th>Campo</th><th>Antes</th><th>Depois</th><th class="num">Diferença</th></tr></thead>
                <tbody>${linhas}</tbody>
            </table></div>
            ${podeVer ? '<button type="button" class="btn btn-sm-inline" data-acao="ver-consulta">Ver estas reservas na Consulta</button>' : ''}`;
    }

    // ----------------------- TELA: PROCESSOS-CHAVE -----------------------

    const dif = (g, m) => g.depois[m] - g.antes[m];
    const mudou = g => Math.abs(dif(g, 'valor')) > 0.004 || Math.abs(dif(g, 'saldo')) > 0.004 ||
        g.novas > 0 || g.sairam > 0 || g.alteradas > 0;

    /** Soma vários grupos em um só (subtotal da fonte, total da faixa). */
    function somarGrupos(lista) {
        const t = { antes: { valor: 0, saldo: 0, qtd: 0 }, depois: { valor: 0, saldo: 0, qtd: 0 }, novas: 0, sairam: 0, alteradas: 0 };
        lista.forEach(g => {
            ['antes', 'depois'].forEach(l => ['valor', 'saldo', 'qtd'].forEach(k => { t[l][k] += g[l][k]; }));
            t.novas += g.novas; t.sairam += g.sairam; t.alteradas += g.alteradas;
        });
        return t;
    }

    /** "2 novas · 1 saiu · 5 alteradas" (só o que houve). */
    function movimentoTexto(g) {
        const partes = [];
        if (g.novas) partes.push(`${g.novas.toLocaleString('pt-BR')} ${g.novas === 1 ? 'nova' : 'novas'}`);
        if (g.sairam) partes.push(`${g.sairam.toLocaleString('pt-BR')} ${g.sairam === 1 ? 'saiu' : 'saíram'}`);
        if (g.alteradas) partes.push(`${g.alteradas.toLocaleString('pt-BR')} ${g.alteradas === 1 ? 'alterada' : 'alteradas'}`);
        return partes.length ? partes.join(' · ') : 'sem movimento';
    }

    const chaveGrupo = g => `${g.processo}|${g.fonte === null ? '' : g.fonte}`;

    function controlesChaveHTML(c) {
        const [rotA, rotB] = rotulos(c);
        const botao = (id, rotulo) => `<button type="button" class="cmp-chave-opcao" data-acao="cmp-metrica" data-metrica="${id}" aria-pressed="${metrica === id}">${rotulo}</button>`;
        return `
            <div class="cmp-chave-topo">
                <div>
                    <h4 class="cmp-chave-titulo">Processos-chave</h4>
                    <p class="cmp-chave-sub">${(c.processosChave.processos || []).map(e).join(' · ')} — ${rotA} → ${rotB}</p>
                </div>
                <div class="cmp-chave-controles">
                    <div class="cmp-chave-alternar" role="group" aria-label="Valor exibido">
                        ${botao('saldo', 'Saldo das reservas')}${botao('valor', 'Valor reservado')}
                    </div>
                    <button type="button" class="cmp-chave-opcao cmp-chave-zeros" data-acao="cmp-zeros" aria-pressed="${ocultarZeros}">Ocultar sem variação</button>
                </div>
            </div>`;
    }

    /** Faixa de destaque: um card por processo na fonte em destaque + total. */
    function faixaDestaqueHTML(pc) {
        const fd = pc.fonteDestaque;
        const card = (titulo, g, chave) => {
            if (!g || (g.antes.qtd === 0 && g.depois.qtd === 0)) {
                return `<div class="cmp-chave-card cmp-chave-card-vazio"><span>${e(titulo)}</span><strong>—</strong><small>Sem reservas nesta fonte</small></div>`;
            }
            const ativo = chave && filtro === chave;
            const tag = chave ? 'button' : 'div';
            const attrs = chave ? ` type="button" data-acao="cmp-filtro-chave" data-chave="${e(chave)}" aria-pressed="${ativo}" title="Filtrar as listas por este processo"` : '';
            return `
                <${tag} class="cmp-chave-card${chave ? '' : ' cmp-chave-card-total'}"${attrs}>
                    <span>${e(titulo)}</span>
                    <strong>${variacao(g.antes[metrica], g.depois[metrica])}</strong>
                    <small>${moeda(g.antes[metrica])} → ${moeda(g.depois[metrica])}</small>
                    <small class="cmp-chave-mov">${movimentoTexto(g)}</small>
                </${tag}>`;
        };
        const daFonte = pc.grupos.filter(g => g.fonte === fd);
        const cards = pc.processos.map(p => {
            const g = daFonte.find(x => x.processo === p);
            return card(`Processo ${p}`, g, g ? chaveGrupo(g) : null);
        }).join('');
        const total = daFonte.length ? somarGrupos(daFonte) : null;
        return `
            <div class="cmp-chave-destaque">
                <div class="cmp-chave-destaque-titulo">${e(nomeFonte(fd))} <small>(destaque)</small></div>
                <div class="cmp-chave-cards">${cards}${card(`Total ${nomeFonte(fd).split(' – ')[0]}`, total, null)}</div>
            </div>`;
    }

    /** Tabela agrupada por fonte: fonte em destaque primeiro, demais pela maior variação. */
    function tabelaFontesHTML(c, pc) {
        const [rotA, rotB] = rotulos(c);
        const fd = pc.fonteDestaque;
        const porFonte = new Map();
        pc.grupos.forEach(g => {
            const k = chaveFonte(g.fonte);
            if (!porFonte.has(k)) porFonte.set(k, { fonte: g.fonte, grupos: [] });
            porFonte.get(k).grupos.push(g);
        });
        const ordem = p => pc.processos.indexOf(p);
        let fontes = [...porFonte.values()].map(f => {
            f.grupos.sort((a, b) => ordem(a.processo) - ordem(b.processo));
            f.total = somarGrupos(f.grupos);
            f.visiveis = ocultarZeros ? f.grupos.filter(mudou) : f.grupos;
            return f;
        });
        if (ocultarZeros) fontes = fontes.filter(f => f.visiveis.length);
        fontes.sort((a, b) => {
            if (a.fonte === fd) return -1;
            if (b.fonte === fd) return 1;
            return Math.abs(dif(b.total, metrica)) - Math.abs(dif(a.total, metrica));
        });

        if (!fontes.length) {
            return `<p class="cmp-vazio">${pc.grupos.length ? 'Nenhuma variação nos processos-chave.' : 'Nenhuma reserva dos processos-chave nos arquivos comparados.'}</p>`;
        }

        const corpo = fontes.map(f => {
            const k = chaveFonte(f.fonte);
            const aberta = abertas.has(k);
            const destaque = f.fonte === fd ? ' cmp-fonte-destaque' : '';
            const cabecalho = `
                <tr class="cmp-fonte-linha${destaque}">
                    <th scope="rowgroup">
                        <button type="button" class="cmp-fonte-botao" data-acao="cmp-grupo" data-fonte="${e(k)}" aria-expanded="${aberta}">
                            <span class="cmp-seta" aria-hidden="true">${aberta ? '▾' : '▸'}</span>${e(nomeFonte(f.fonte))}
                        </button>
                    </th>
                    <td class="num">${moeda(f.total.antes[metrica])}</td>
                    <td class="num">${moeda(f.total.depois[metrica])}</td>
                    <td class="num">${variacao(f.total.antes[metrica], f.total.depois[metrica])}</td>
                    <td class="cmp-chave-mov">${movimentoTexto(f.total)}</td>
                </tr>`;
            const linhas = aberta ? f.visiveis.map(g => {
                const chave = chaveGrupo(g);
                return `
                <tr class="cmp-processo-linha${filtro === chave ? ' cmp-processo-ativo' : ''}">
                    <td><button type="button" class="cmp-processo-botao" data-acao="cmp-filtro-chave" data-chave="${e(chave)}"
                        aria-pressed="${filtro === chave}" title="Filtrar as listas por este processo e fonte">Processo ${e(g.processo)}</button></td>
                    <td class="num">${moeda(g.antes[metrica])}</td>
                    <td class="num">${moeda(g.depois[metrica])}</td>
                    <td class="num">${variacao(g.antes[metrica], g.depois[metrica])}</td>
                    <td class="cmp-chave-mov">${movimentoTexto(g)}</td>
                </tr>`;
            }).join('') : '';
            return `<tbody>${cabecalho}${linhas}</tbody>`;
        }).join('');

        return `
            <div class="cmp-rolagem"><table class="tabela-simples cmp-chave-tabela">
                <thead><tr><th>Fonte / processo</th><th class="num">${rotA}</th><th class="num">${rotB}</th><th class="num">Variação</th><th>Movimento</th></tr></thead>
                ${corpo}
            </table></div>`;
    }

    function processosChaveHTML(c) {
        const pc = c.processosChave;
        if (!pc) {
            return `<section class="cmp-chave"><p class="cmp-limite">Esta comparação foi gerada por uma versão anterior e não tem o detalhamento dos processos-chave. ` +
                'Importe o arquivo novamente ou use "Comparar dois arquivos".</p></section>';
        }
        return `
            <section class="cmp-chave" aria-label="Processos-chave por fonte">
                ${controlesChaveHTML(c)}
                ${faixaDestaqueHTML(pc)}
                ${tabelaFontesHTML(c, pc)}
            </section>`;
    }

    /** Comparação restrita ao processo/fonte escolhido (para os banners e as listas). */
    function visao(c) {
        if (!filtro || !c.processosChave) return c;
        const g = c.processosChave.grupos.find(x => chaveGrupo(x) === filtro);
        if (!g) { filtro = null; return c; }
        const ok = r => grupoDe(r) === filtro;
        return {
            ...c,
            entraram: c.entraram.filter(ok),
            sairam: c.sairam.filter(ok),
            alteradas: c.alteradas.filter(a => ok(a.depois) || ok(a.antes)),
            iguais: g.iguais
        };
    }

    function filtroAtivoHTML(c) {
        if (!filtro || !c.processosChave) return '';
        const [processo, f] = filtro.split('|');
        const fonte = f === '' ? null : Number(f);
        return `
            <div class="cmp-filtro-ativo">
                <span class="painel-filtros-info">Listas filtradas:</span>
                <span class="chip-filtro">Processo ${e(processo)} · ${e(nomeFonte(fonte))}</span>
                <button type="button" class="link-acao" data-acao="cmp-limpar-filtro">Limpar filtro</button>
            </div>`;
    }

    /** Volta o bloco ao estado inicial (nova comparação, troca de modo). */
    function reiniciarChave() {
        filtro = null;
        abertas = new Set([chaveFonte(Config.FONTE_DESTAQUE ?? null)]);
    }

    function avisoLimite(total) {
        return total > LIMITE_TELA
            ? `<p class="cmp-limite">Mostrando ${LIMITE_TELA} de ${total.toLocaleString('pt-BR')}. Use "Exportar comparação" para ver a lista completa.</p>`
            : '';
    }

    function avisoRepetidas(c) {
        if (!(c.repetidas > 0)) return '';
        const n = c.repetidas.toLocaleString('pt-BR');
        return `<p class="cmp-limite">${n} ${c.repetidas === 1 ? 'linha tem' : 'linhas têm'} nº de reserva repetido. ` +
            'Nesses casos, a comparação depende da ordem das linhas no arquivo.</p>';
    }

    function desenhar() {
        const c = ativa();
        $('tituloComparacao').textContent = modo === 'manual'
            ? 'Comparação entre dois arquivos'
            : 'Comparação com a importação anterior';
        atualizarControles();

        const alvo = $('conteudoComparacao');
        if (!c) {
            alvo.innerHTML = modo === 'manual'
                ? '<p class="cmp-vazio">Escolha o Arquivo A (mais antigo) e o Arquivo B (mais recente) e clique em "Comparar".</p>'
                : '<p class="cmp-vazio">Ainda não há comparação. Ela é feita automaticamente quando um arquivo novo substitui outro já carregado. ' +
                  'Para comparar dois arquivos quaisquer, escolha "Comparar dois arquivos".</p>';
            return;
        }

        const podeVer = !ehManual(c);    // no modo manual os registros não estão na Consulta
        const v = visao(c);              // listas restritas ao processo/fonte escolhido, se houver
        let lista;
        if (aba === 'entraram') {
            lista = listaReservasHTML(v.entraram, podeVer);
        } else if (aba === 'sairam') {
            const nota = ehManual(c)
                ? 'Estas reservas estão no Arquivo A, mas não no Arquivo B.'
                : 'Estas reservas não estão no arquivo atual, por isso não aparecem na Consulta.';
            lista = listaReservasHTML(v.sairam, false) + (v.sairam.length ? `<p class="cmp-limite">${nota}</p>` : '');
        } else {
            lista = alteradasHTML(v, podeVer);
        }

        alvo.innerHTML = arquivosHTML(c) + processosChaveHTML(c) + filtroAtivoHTML(c) + abasHTML(v) + avisoRepetidas(c) +
            `<div class="cmp-lista" role="tabpanel">${lista}</div>`;
    }

    // ---------------------------- MODO MANUAL ----------------------------

    function atualizarControles() {
        const emManual = modo === 'manual';
        const ocupado = manual.processando;

        $('cmpManual').hidden = !emManual;
        document.querySelectorAll('input[name="cmpModo"]').forEach(r => {
            r.checked = r.value === modo;
            r.disabled = ocupado;
        });

        $('cmpNomeA').textContent = manual.arquivoA ? manual.arquivoA.name : 'Nenhum arquivo escolhido';
        $('cmpNomeB').textContent = manual.arquivoB ? manual.arquivoB.name : 'Nenhum arquivo escolhido';
        $('cmpArquivoA').disabled = ocupado;
        $('cmpArquivoB').disabled = ocupado;

        const comparar = $('btnCmpComparar');
        comparar.disabled = ocupado || !manual.arquivoA || !manual.arquivoB;
        comparar.textContent = ocupado ? 'Comparando…' : 'Comparar';
        $('btnCmpInverter').disabled = ocupado || !manual.listaA;
        $('btnCmpLimpar').disabled = ocupado || (!manual.arquivoA && !manual.arquivoB && !Estado.comparacaoManual);

        const caixa = $('cmpMensagem');
        caixa.hidden = !emManual || !manual.msg;
        if (manual.msg) {
            caixa.textContent = manual.msg.texto;
            caixa.className = `cmp-mensagem cmp-mensagem-${manual.msg.tipo}`;
        }

        $('btnExportarComparacao').disabled = !ativa();
    }

    function mensagem(texto, tipo = 'info') {
        manual.msg = texto ? { texto, tipo } : null;
        atualizarControles();
    }

    function mesmoArquivo(a, b) {
        return !!a && !!b && a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
    }

    const dataMaisRecente = lista => lista.reduce((m, r) => (r.DataISO && r.DataISO > m ? r.DataISO : m), '');

    /** Alertas que não impedem a comparação. */
    function avisos() {
        const lista = [];
        if (mesmoArquivo(manual.arquivoA, manual.arquivoB)) {
            lista.push('Os dois campos parecem ter o mesmo arquivo.');
        }
        if (manual.infoA.layout !== manual.infoB.layout) {
            lista.push(`Os arquivos têm layouts diferentes (A: ${manual.infoA.layout}; B: ${manual.infoB.layout}). ` +
                'Colunas ausentes em um deles podem aparecer como alteradas.');
        }
        const dA = dataMaisRecente(manual.listaA);
        const dB = dataMaisRecente(manual.listaB);
        if (dA && dB && dA > dB) {
            lista.push('O Arquivo A tem reservas mais recentes que o B. Se estiverem trocados, use "Inverter A ↔ B".');
        }
        return lista;
    }

    function recalcular() {
        reiniciarChave();
        Estado.comparacaoManual = {
            ...calcular(manual.listaA, manual.listaB, manual.infoA, manual.infoB),
            origem: 'manual'
        };
        const alertas = avisos();
        if (alertas.length) mensagem(alertas.join('\n'), 'aviso');
        else mensagem(`Comparação concluída: ${resumoTexto(Estado.comparacaoManual)}.`, 'ok');
        desenhar();
    }

    function lerComRotulo(arquivo, rotulo) {
        return Importacao.lerArquivo(arquivo).catch(erro => {
            throw new Error(`${rotulo} (${arquivo.name}): ${erro.message}`);
        });
    }

    async function compararArquivos() {
        const { arquivoA, arquivoB } = manual;
        if (!arquivoA || !arquivoB) return mensagem('Escolha os dois arquivos antes de comparar.', 'erro');

        const pedido = ++manual.pedido;
        manual.processando = true;
        mensagem('Lendo e comparando os arquivos…');

        try {
            const [ra, rb] = await Promise.all([lerComRotulo(arquivoA, 'Arquivo A'), lerComRotulo(arquivoB, 'Arquivo B')]);
            if (pedido !== manual.pedido) return;          // o usuário limpou durante a leitura

            const agora = new Date().toISOString();
            const info = (arq, r) => ({ arquivo: arq.name, layout: r.layout, carregadoEm: agora, ignoradas: r.ignoradas });
            manual.listaA = ra.registros.map(r => Estado.normalizarRegistro(r, false));
            manual.listaB = rb.registros.map(r => Estado.normalizarRegistro(r, false));
            manual.infoA = info(arquivoA, ra);
            manual.infoB = info(arquivoB, rb);
            manual.processando = false;
            aba = 'entraram';
            recalcular();
        } catch (erro) {
            if (pedido !== manual.pedido) return;
            manual.processando = false;
            mensagem(`Não foi possível comparar. ${erro.message}`, 'erro');
        }
    }

    function inverter() {
        if (!manual.listaA || manual.processando) return;
        [manual.arquivoA, manual.arquivoB] = [manual.arquivoB, manual.arquivoA];
        [manual.listaA, manual.listaB] = [manual.listaB, manual.listaA];
        [manual.infoA, manual.infoB] = [manual.infoB, manual.infoA];
        recalcular();
    }

    function escolherArquivo(lado, input) {
        const arquivo = input.files && input.files[0];
        input.value = '';                          // permite escolher o mesmo arquivo de novo
        if (!arquivo) return;
        manual['arquivo' + lado] = arquivo;
        if (manual.listaA) {                       // já havia comparação: precisa refazer
            manual.listaA = null;
            manual.listaB = null;
            mensagem(`Arquivo ${lado} trocado. Clique em "Comparar" para atualizar o resultado.`, 'aviso');
        } else {
            atualizarControles();
        }
    }

    /** Descarta a comparação manual (também chamada por Estado.limparTudo). */
    function limparManual() {
        manual.pedido++;
        Object.assign(manual, {
            arquivoA: null, arquivoB: null, listaA: null, listaB: null,
            infoA: null, infoB: null, processando: false, msg: null
        });
        Estado.comparacaoManual = null;
        if ($('conteudoComparacao')) desenhar();
    }

    // ------------------------------ EVENTOS ------------------------------

    function abrir() {
        if (modo === 'auto' && !Estado.comparacao) modo = 'manual';
        aba = 'entraram';
        reiniciarChave();
        desenhar();
        Modais.abrir('modalComparacao');
    }

    function tratarClique(evento) {
        const alvo = evento.target.closest('[data-acao]');
        const c = ativa();
        if (!alvo || !c) return;
        const acao = alvo.dataset.acao;
        if (acao === 'aba-comparacao') {
            aba = alvo.dataset.aba;
            desenhar();
        } else if (acao === 'cmp-metrica') {
            metrica = alvo.dataset.metrica === 'valor' ? 'valor' : 'saldo';
            desenhar();
        } else if (acao === 'cmp-zeros') {
            ocultarZeros = !ocultarZeros;
            desenhar();
        } else if (acao === 'cmp-grupo') {
            const k = alvo.dataset.fonte;
            if (abertas.has(k)) abertas.delete(k); else abertas.add(k);
            desenhar();
        } else if (acao === 'cmp-filtro-chave') {
            filtro = filtro === alvo.dataset.chave ? null : alvo.dataset.chave;
            desenhar();
        } else if (acao === 'cmp-limpar-filtro') {
            filtro = null;
            desenhar();
        } else if (acao === 'ver-consulta' && !ehManual(c)) {
            const v = visao(c);
            const regs = aba === 'entraram' ? v.entraram : v.alteradas.map(a => a.depois);
            Modais.fechar('modalComparacao');
            App.filtrarReservas(regs, true);
        }
    }

    function iniciar() {
        $('conteudoComparacao').addEventListener('click', tratarClique);

        document.querySelectorAll('input[name="cmpModo"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                modo = radio.value;
                aba = 'entraram';
                reiniciarChave();
                desenhar();
            });
        });

        $('cmpArquivoA').addEventListener('change', ev => escolherArquivo('A', ev.target));
        $('cmpArquivoB').addEventListener('change', ev => escolherArquivo('B', ev.target));
        $('btnCmpComparar').addEventListener('click', compararArquivos);
        $('btnCmpInverter').addEventListener('click', inverter);
        $('btnCmpLimpar').addEventListener('click', () => {
            if (Estado.comparacaoManual && !confirm('Descartar a comparação entre arquivos?')) return;
            limparManual();
        });
    }

    return { calcular, resumoTexto, abrir, iniciar, ativa, limparManual };
})();
