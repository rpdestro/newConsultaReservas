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
   recurso, com a Config.FONTE_DESTAQUE em evidência.

   A tela mostra só os arquivos comparados e os processos-chave. As listas
   de Novas, Saíram e Alteradas continuam sendo calculadas (usadas na
   mensagem de conclusão e na exportação), mas não são exibidas.
   ========================================================================= */

const Comparacao = (() => {
    const e = Utils.esc;
    const moeda = Utils.formatarMoeda;
    const $ = id => document.getElementById(id);
    let modo = 'auto';                // 'auto' | 'manual'

    // Bloco "Processos-chave"
    let metrica = 'saldo';            // 'saldo' | 'valor'
    let ocultarZeros = true;          // esconde processo/fonte sem variação nem movimento
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
        // V4.2.5: no Histórico, espaços não contam. O XLS do Fiorilli quebra o texto com espaços
        // extras ("ENCERRAM ENTO"); o CSV traz o texto corrido ("ENCERRAMENTO").
        if (campo === 'Historico') {
            const s = v => Utils.texto(v).replace(/\s+/g, '');
            return s(a) !== s(b);
        }
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

    /** Chave "processo|fonte" da reserva, ou null se o processo não é acompanhado. */
    function grupoDe(reg) {
        const processo = codigoProcesso(reg.Processo);
        if (!(Config.PROCESSOS_CHAVE || []).includes(processo)) return null;
        const fonte = Utils.codigoFonte(reg.Fonte);
        return `${processo}|${fonte === null ? '' : fonte}`;
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
        return `<div class="cmp-arquivos">${bloco(rotA, c.anterior)}${bloco(rotB, c.atual)}</div>`;
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
        const card = (titulo, g, total) => {
            if (!g || (g.antes.qtd === 0 && g.depois.qtd === 0)) {
                return `<div class="cmp-chave-card cmp-chave-card-vazio"><span>${e(titulo)}</span><strong>—</strong><small>Sem reservas nesta fonte</small></div>`;
            }
            return `
                <div class="cmp-chave-card${total ? ' cmp-chave-card-total' : ''}">
                    <span>${e(titulo)}</span>
                    <strong>${variacao(g.antes[metrica], g.depois[metrica])}</strong>
                    <small>${moeda(g.antes[metrica])} → ${moeda(g.depois[metrica])}</small>
                    <small class="cmp-chave-mov">${movimentoTexto(g)}</small>
                </div>`;
        };
        const daFonte = pc.grupos.filter(g => g.fonte === fd);
        const cards = pc.processos.map(p => {
            const g = daFonte.find(x => x.processo === p);
            return card(`Processo ${p}`, g, false);
        }).join('');
        const total = daFonte.length ? somarGrupos(daFonte) : null;
        return `
            <div class="cmp-chave-destaque">
                <div class="cmp-chave-destaque-titulo">${e(Utils.descricaoFonte(fd))} <small>(destaque)</small></div>
                <div class="cmp-chave-cards">${cards}${card(`Total ${Utils.descricaoFonte(fd).split(' – ')[0]}`, total, true)}</div>
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
                            <span class="cmp-seta" aria-hidden="true">${aberta ? '▾' : '▸'}</span>${e(Utils.descricaoFonte(f.fonte))}
                        </button>
                    </th>
                    <td class="num">${moeda(f.total.antes[metrica])}</td>
                    <td class="num">${moeda(f.total.depois[metrica])}</td>
                    <td class="num">${variacao(f.total.antes[metrica], f.total.depois[metrica])}</td>
                    <td class="cmp-chave-mov">${movimentoTexto(f.total)}</td>
                </tr>`;
            const linhas = aberta ? f.visiveis.map(g => `
                <tr class="cmp-processo-linha">
                    <td>Processo ${e(g.processo)}</td>
                    <td class="num">${moeda(g.antes[metrica])}</td>
                    <td class="num">${moeda(g.depois[metrica])}</td>
                    <td class="num">${variacao(g.antes[metrica], g.depois[metrica])}</td>
                    <td class="cmp-chave-mov">${movimentoTexto(g)}</td>
                </tr>`).join('') : '';
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

    /** Volta o bloco ao estado inicial (nova comparação, troca de modo). */
    function reiniciarChave() {
        abertas = new Set([chaveFonte(Config.FONTE_DESTAQUE ?? null)]);
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
            ? 'Comparação Entre Dois Arquivos'
            : 'Comparação com a Importação Anterior';
        atualizarControles();

        const alvo = $('conteudoComparacao');
        if (!c) {
            alvo.innerHTML = modo === 'manual'
                ? '<p class="cmp-vazio">Escolha o Arquivo A (mais antigo) e o Arquivo B (mais recente) e clique em "Comparar".</p>'
                : '<p class="cmp-vazio">Ainda não há comparação. Ela é feita automaticamente quando um arquivo novo substitui outro já carregado. ' +
                  'Para comparar dois arquivos quaisquer, escolha "Comparar dois arquivos".</p>';
            return;
        }

        alvo.innerHTML = arquivosHTML(c) + processosChaveHTML(c) + avisoRepetidas(c);
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
        // V4.2.5: XLS e CSV do Fiorilli trazem os mesmos campos; não geram aviso entre si
        const base = layout => String(layout || '').replace(' (CSV)', '');
        if (base(manual.infoA.layout) !== base(manual.infoB.layout)) {
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
        reiniciarChave();
        desenhar();
        Modais.abrir('modalComparacao');
    }

    function tratarClique(evento) {
        const alvo = evento.target.closest('[data-acao]');
        const c = ativa();
        if (!alvo || !c) return;
        const acao = alvo.dataset.acao;
        if (acao === 'cmp-metrica') {
            metrica = alvo.dataset.metrica === 'valor' ? 'valor' : 'saldo';
            desenhar();
        } else if (acao === 'cmp-zeros') {
            ocultarZeros = !ocultarZeros;
            desenhar();
        } else if (acao === 'cmp-grupo') {
            const k = alvo.dataset.fonte;
            if (abertas.has(k)) abertas.delete(k); else abertas.add(k);
            desenhar();
        }
    }

    function iniciar() {
        $('conteudoComparacao').addEventListener('click', tratarClique);

        document.querySelectorAll('input[name="cmpModo"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                modo = radio.value;
                reiniciarChave();
                desenhar();
            });
        });

        $('cmpArquivoA').addEventListener('change', ev => escolherArquivo('A', ev.target));
        $('cmpArquivoB').addEventListener('change', ev => escolherArquivo('B', ev.target));
        $('btnCmpComparar').addEventListener('click', compararArquivos);
        $('btnCmpInverter').addEventListener('click', inverter);
        $('btnCmpLimpar').addEventListener('click', async () => {
            if (Estado.comparacaoManual && !(await Avisos.confirmar('A comparação entre os dois arquivos será descartada.',
                { titulo: 'Descartar comparação?', ok: 'Descartar', perigo: true }))) return;
            limparManual();
        });
    }

    return { calcular, resumoTexto, abrir, iniciar, ativa, limparManual };
})();
