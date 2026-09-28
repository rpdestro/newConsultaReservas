/* =========================================================================
   app.js — Inicialização e ligação dos eventos da tela
   Ordem de carregamento dos scripts (index.html):
   config → utils → dica → estado → execucao → importacao → filtros → comparacao
   → dashboard → tabela → modais → exportacao → relatorio → painel → app
   ========================================================================= */

const App = (() => {
    const $ = id => document.getElementById(id);

    /** Redesenha painel e tabela com os filtros atuais. */
    function renderizar() {
        Execucao.recalcular(Estado.registros);   // reduções por ficha (critério de reserva parada)
        const dados = Filtros.aplicar(Estado.registros);
        Dashboard.atualizar(dados);
        Tabela.renderizar(dados);
        Painel.atualizar(dados);
        atualizarStatus();

        $('indicadorFiltro').classList.toggle('oculto', !Filtros.temFiltros());
    }

    // ------------------------------ ABAS ------------------------------

    let abaAtual = 'consulta';

    function trocarAba(nome, focar) {
        abaAtual = nome === 'painel' ? 'painel' : 'consulta';
        const painel = abaAtual === 'painel';

        document.body.classList.toggle('aba-painel', painel);
        document.querySelectorAll('.abas [role="tab"]').forEach(aba => {
            const ativa = aba.dataset.aba === abaAtual;
            aba.setAttribute('aria-selected', String(ativa));
            aba.tabIndex = ativa ? 0 : -1;
            if (ativa && focar) aba.focus();
        });

        Filtros.fecharTodos();
        Painel.definirVisivel(painel);
        if (!painel) Dashboard.redesenhar();   // o gráfico precisa ser medido visível
        try { localStorage.setItem(Config.CHAVE_ABA, abaAtual); } catch (e) { /* ignorado */ }
    }

    function mostrarTabela() {
        Estado.limiteLinhas = Config.LINHAS_POR_PAGINA;
        Filtros.gerar();
        trocarAba('consulta');
        renderizar();
        document.querySelector('.print-tabela-wrapper').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /** Vindo do painel: filtra a Consulta pela secretaria e/ou fonte e mostra a tabela. */
    function verReservas(sec, fonte) {
        if (sec !== null) {
            const daSecretaria = Filtros.aplicar(Estado.registros).filter(r => Utils.codigoSecretaria(r.UO) === sec);
            if (daSecretaria.length === 0) return;
            Estado.filtros.UO = new Set(daSecretaria.map(r => r.UO));
        }
        if (fonte !== null) Estado.filtros.Fonte = new Set([fonte]);
        mostrarTabela();
    }

    /** Mostra na Consulta só as reservas da lista (paradas, novas, alteradas...). */
    function filtrarReservas(registros, limparAntes) {
        if (!registros.length) return;
        if (limparAntes) {
            clearTimeout(temporizadorBusca);
            Filtros.limpar();
            sincronizarCampoBusca();
            sincronizarPeriodo();
        }
        Estado.filtros.Reserva = new Set(registros.map(r => r.Reserva));
        mostrarTabela();
    }

    function limparFiltros() {
        clearTimeout(temporizadorBusca);
        Filtros.limpar();
        sincronizarCampoBusca();
        sincronizarPeriodo();
        renderizar();
    }

    /** Chamado sempre que os dados mudam (importação, inclusão, edição, exclusão). */
    function aposAlterarDados() {
        Filtros.gerar();
        sincronizarCampoBusca();
        sincronizarPeriodo();
        atualizarAvisoComparacao();
        renderizar();
    }

    // ----------------------------- PERÍODO -----------------------------

    function sincronizarPeriodo() {
        $('periodoDe').value = Estado.periodo.de;
        $('periodoAte').value = Estado.periodo.ate;
        const ativo = !!(Estado.periodo.de || Estado.periodo.ate);
        $('caixaPeriodo').classList.toggle('ativo', ativo);
        $('btnLimparPeriodo').classList.toggle('oculto', !ativo);
    }

    function aplicarPeriodo() {
        let de = $('periodoDe').value;
        let ate = $('periodoAte').value;
        if (de && ate && de > ate) [de, ate] = [ate, de];   // datas invertidas: corrige sozinho
        if (de === Estado.periodo.de && ate === Estado.periodo.ate) { sincronizarPeriodo(); return; }
        Estado.periodo = { de, ate };
        Estado.limiteLinhas = Config.LINHAS_POR_PAGINA;
        sincronizarPeriodo();
        renderizar();
    }

    /** Atalhos do período: mês atual, ano atual, últimos 30 dias. */
    function periodoRapido(tipo) {
        const h = new Date();
        const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        let de;
        if (tipo === 'mes') de = new Date(h.getFullYear(), h.getMonth(), 1);
        else if (tipo === 'ano') de = new Date(h.getFullYear(), 0, 1);
        else de = new Date(h.getFullYear(), h.getMonth(), h.getDate() - 29);
        $('periodoDe').value = iso(de);
        $('periodoAte').value = iso(h);
        aplicarPeriodo();
    }

    // ---------------------------- COMPARAÇÃO ----------------------------

    function atualizarAvisoComparacao() {
        const c = Estado.comparacao;
        // Sempre disponível: sem importação anterior, abre direto em "Comparar dois arquivos"
        $('btnComparar').title = c ? 'Compare com a importação anterior ou escolha dois arquivos'
            : 'Escolha dois arquivos para comparar';
        $('avisoComparacao').classList.toggle('oculto', !c);
        if (c) $('textoComparacao').textContent =
            `Em relação a "${c.anterior.arquivo}": ${Comparacao.resumoTexto(c)}.`;
    }

    // -------------------------- ÁREA DE UPLOAD --------------------------

    let carregandoArquivo = false;

    /** Mostra na área de upload o arquivo atual (ou o convite para carregar um). */
    function atualizarAreaUpload() {
        if (carregandoArquivo) return;
        const area = $('areaUpload');
        const total = Estado.registros.length;
        area.classList.remove('carregando');
        area.classList.toggle('carregado', total > 0);

        if (total > 0 && Estado.info) {
            $('uploadTitulo').textContent = Estado.info.arquivo;
            $('uploadDetalhe').textContent = `${total.toLocaleString('pt-BR')} reservas. Clique ou arraste outro arquivo para substituir.`;
            $('uploadBotao').textContent = 'Trocar';
        } else if (total > 0) {
            $('uploadTitulo').textContent = 'Registros incluídos manualmente';
            $('uploadDetalhe').textContent = 'Clique ou arraste o relatório para substituí-los.';
            $('uploadBotao').textContent = 'Procurar';
        } else {
            $('uploadTitulo').textContent = 'Selecione o relatório de reservas';
            $('uploadDetalhe').textContent = 'Clique aqui ou arraste o arquivo (.xls, .xlsx ou .csv)';
            $('uploadBotao').textContent = 'Procurar';
        }
    }

    function mostrarCarregando(nomeArquivo) {
        carregandoArquivo = true;
        const area = $('areaUpload');
        area.classList.add('carregando');
        area.classList.remove('carregado');
        $('uploadTitulo').textContent = nomeArquivo;
        $('uploadDetalhe').textContent = 'Lendo o arquivo, aguarde...';
        $('uploadBotao').textContent = 'Lendo...';
    }

    /** Dá tempo ao navegador de desenhar o aviso "Lendo..." antes da leitura pesada. */
    function aguardarPintura() {
        return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    }

    function extensaoValida(nome) {
        return /\.(xlsx?|csv)$/i.test(nome || '');
    }

    // -------------------------- PESQUISA RÁPIDA --------------------------

    let temporizadorBusca = null;

    function sincronizarCampoBusca() {
        const input = $('pesquisaRapida');
        if (input.value !== Estado.busca) input.value = Estado.busca;
        atualizarVisualBusca();
    }

    function atualizarVisualBusca() {
        const temTexto = $('pesquisaRapida').value.trim() !== '';
        $('caixaBusca').classList.toggle('ativa', temTexto);
        $('btnLimparBusca').classList.toggle('oculto', !temTexto);
    }

    function aplicarBusca(texto) {
        clearTimeout(temporizadorBusca);
        if (texto === Estado.busca) return;
        Estado.busca = texto;
        Estado.limiteLinhas = Config.LINHAS_POR_PAGINA;
        renderizar();
    }

    function limparBusca() {
        $('pesquisaRapida').value = '';
        atualizarVisualBusca();
        aplicarBusca('');
        $('pesquisaRapida').focus();
    }

    function atualizarStatus() {
        const el = $('statusDados');
        const total = Estado.registros.length;
        atualizarAreaUpload();
        if (total === 0) { el.textContent = ''; el.classList.remove('status-alerta'); return; }

        const partes = [];
        if (Estado.info) {
            partes.push(`Layout ${Estado.info.layout}`);
            partes.push(`carregado em ${new Date(Estado.info.carregadoEm).toLocaleString('pt-BR')}`);
            if (Estado.info.ignoradas) partes.push(`${Estado.info.ignoradas} linhas de cabeçalho/total ignoradas`);
        } else {
            partes.push('Registros incluídos manualmente');
        }
        if (!Estado.info) partes.push(`${total} reservas`);   // com arquivo, o total já aparece na área de upload
        if (Estado.salvando) partes.push('salvando no navegador...');
        else if (Estado.persistenciaOk) partes.push('salvo neste navegador');
        else partes.push('⚠ não foi possível salvar no navegador (os dados serão perdidos ao fechar)');

        el.textContent = partes.join(' | ');
        el.classList.toggle('status-alerta', !Estado.persistenciaOk);
    }

    // ------------------------------ AÇÕES ------------------------------

    async function carregarArquivo(arquivo) {
        if (!arquivo || carregandoArquivo) return;

        if (!extensaoValida(arquivo.name)) {
            alert(`O arquivo "${arquivo.name}" não é uma planilha aceita.\nUse o relatório em .xls, .xlsx ou .csv.`);
            return;
        }

        if (Estado.registros.length > 0 &&
            !confirm('Substituir os dados atuais (incluindo inclusões e edições manuais) pelo novo arquivo?\n\n' +
                'O que entrou, saiu ou mudou ficará disponível em "Comparar arquivos".')) {
            return;
        }

        mostrarCarregando(arquivo.name);
        await aguardarPintura();

        try {
            const resultado = await Importacao.lerArquivo(arquivo);
            Estado.substituirTodos(resultado.registros, {
                arquivo: arquivo.name,
                layout: resultado.layout,
                carregadoEm: new Date().toISOString(),
                ignoradas: resultado.ignoradas
            });
        } catch (erro) {
            console.error(erro);
            alert(`Não foi possível ler o arquivo.\n\n${erro.message}`);
        } finally {
            carregandoArquivo = false;
            aposAlterarDados();   // também restaura a área de upload
        }
    }

    function aoSelecionarArquivo(evento) {
        const input = evento.target;
        const arquivo = input.files[0];
        input.value = '';   // permite recarregar o mesmo arquivo
        carregarArquivo(arquivo);
    }

    function ligarArrastarSoltar() {
        const area = $('areaUpload');
        const temArquivo = evento => evento.dataTransfer && [...evento.dataTransfer.types].includes('Files');

        ['dragenter', 'dragover'].forEach(tipo => area.addEventListener(tipo, evento => {
            if (!temArquivo(evento)) return;
            evento.preventDefault();
            evento.dataTransfer.dropEffect = 'copy';
            area.classList.add('arrastando');
        }));

        area.addEventListener('dragleave', evento => {
            if (!area.contains(evento.relatedTarget)) area.classList.remove('arrastando');
        });

        area.addEventListener('drop', evento => {
            if (!temArquivo(evento)) return;
            evento.preventDefault();
            area.classList.remove('arrastando');
            carregarArquivo(evento.dataTransfer.files[0]);
        });

        // Arquivo solto FORA da área: o navegador abriria o arquivo e a página seria perdida
        window.addEventListener('dragover', evento => {
            if (temArquivo(evento) && !area.contains(evento.target)) {
                evento.preventDefault();
                evento.dataTransfer.dropEffect = 'none';
            }
        });
        window.addEventListener('drop', evento => {
            if (temArquivo(evento) && !area.contains(evento.target)) evento.preventDefault();
        });
    }

    function salvarFormulario() {
        const { id, dados } = Modais.lerFormulario();

        if (!dados.Reserva) {
            alert('Informe o número da reserva.');
            $('form_Reserva').focus();
            return;
        }

        const duplicada = Estado.registros.some(r => r.Reserva === dados.Reserva && r._id !== id);
        if (duplicada && !confirm(`Já existe um registro com a reserva nº ${dados.Reserva}. Salvar mesmo assim?`)) return;

        if (id) Estado.atualizar(id, dados);
        else Estado.adicionar(dados);

        Modais.fechar('modalFormulario');
        aposAlterarDados();
    }

    function excluir(id) {
        const reg = Estado.buscar(id);
        if (!reg) return;
        if (!confirm(`Excluir a reserva nº ${reg.Reserva} da consulta?`)) return;
        Estado.remover(id);
        aposAlterarDados();
    }

    function limparDados() {
        if (Estado.registros.length === 0) return alert('Não há dados carregados para limpar.');
        if (!confirm('Apagar TODOS os dados carregados, inclusive os salvos neste navegador?')) return;
        Estado.limparTudo();
        aposAlterarDados();
    }

    function aplicarTema(escuro) {
        document.body.classList.toggle('dark-theme', escuro);
        $('btnDarkMode').textContent = escuro ? '☀️ Claro' : '🌙 Escuro';
        try { localStorage.setItem(Config.CHAVE_TEMA, escuro ? 'escuro' : 'claro'); } catch (e) { /* ignorado */ }
        Dashboard.redesenhar();
    }

    // ------------------------------ EVENTOS ------------------------------

    function ligarEventos() {
        $('uploadExcel').addEventListener('change', aoSelecionarArquivo);
        ligarArrastarSoltar();

        // Pesquisa rápida: filtra enquanto digita (com pequeno atraso para não travar)
        $('pesquisaRapida').addEventListener('input', evento => {
            atualizarVisualBusca();
            clearTimeout(temporizadorBusca);
            const texto = evento.target.value;
            temporizadorBusca = setTimeout(() => aplicarBusca(texto), Config.ATRASO_BUSCA_MS);
        });
        $('pesquisaRapida').addEventListener('keydown', evento => {
            if (evento.key === 'Enter') aplicarBusca(evento.target.value);   // filtra na hora
            if (evento.key === 'Escape' && evento.target.value) {
                evento.stopPropagation();
                limparBusca();
            }
        });
        $('btnLimparBusca').addEventListener('click', limparBusca);

        $('btnNovaReserva').addEventListener('click', Modais.abrirNovo);
        $('btnLimparFiltros').addEventListener('click', limparFiltros);

        // Abas (clique e setas do teclado, padrão de acessibilidade para abas)
        document.querySelectorAll('.abas [role="tab"]').forEach(aba => {
            aba.addEventListener('click', () => trocarAba(aba.dataset.aba));
            aba.addEventListener('keydown', evento => {
                if (evento.key === 'ArrowRight' || evento.key === 'ArrowLeft') {
                    evento.preventDefault();
                    trocarAba(abaAtual === 'consulta' ? 'painel' : 'consulta', true);
                }
            });
        });
        Painel.iniciar();
        $('btnLimparDados').addEventListener('click', limparDados);
        $('btnExportar').addEventListener('click', () => Exportacao.excel(Filtros.aplicar(Estado.registros)));
        $('btnRelatorio').addEventListener('click', Relatorio.consulta);
        $('btnRelatorioPainel').addEventListener('click', Relatorio.painel);

        // Período
        $('periodoDe').addEventListener('change', aplicarPeriodo);
        $('periodoAte').addEventListener('change', aplicarPeriodo);
        $('btnLimparPeriodo').addEventListener('click', () => {
            $('periodoDe').value = '';
            $('periodoAte').value = '';
            aplicarPeriodo();
        });
        document.querySelectorAll('[data-periodo]').forEach(botao =>
            botao.addEventListener('click', () => periodoRapido(botao.dataset.periodo)));

        // Comparação entre importações
        $('btnComparar').addEventListener('click', Comparacao.abrir);
        $('btnVerComparacao').addEventListener('click', Comparacao.abrir);
        $('btnExportarComparacao').addEventListener('click', () => Exportacao.comparacao(Comparacao.ativa()));
        $('btnFecharComparacao').addEventListener('click', () => Modais.fechar('modalComparacao'));

        $('btnCarregarMais').addEventListener('click', () => {
            Estado.limiteLinhas += Config.LINHAS_POR_PAGINA;
            Tabela.renderizar(Filtros.aplicar(Estado.registros));
        });

        // Botões das linhas (delegação: um único ouvinte para a tabela inteira)
        $('tabelaCorpo').addEventListener('click', evento => {
            const botao = evento.target.closest('[data-acao]');
            if (!botao) return;
            const id = Number(botao.closest('tr').dataset.id);
            const reg = Estado.buscar(id);
            if (!reg) return;

            if (botao.dataset.acao === 'ficha') Modais.abrirFicha(reg);
            else if (botao.dataset.acao === 'editar') Modais.abrirEdicao(reg);
            else if (botao.dataset.acao === 'excluir') excluir(id);
        });

        // Modais
        $('btnFecharModal').addEventListener('click', () => Modais.fechar('modalFormulario'));
        $('btnCancelarModal').addEventListener('click', () => Modais.fechar('modalFormulario'));
        $('btnSalvarReserva').addEventListener('click', salvarFormulario);
        $('formReserva').addEventListener('submit', evento => { evento.preventDefault(); salvarFormulario(); });
        $('btnFecharDetalhes').addEventListener('click', () => Modais.fechar('modalDetalhes'));
        $('btnFecharDetalhesBottom').addEventListener('click', () => Modais.fechar('modalDetalhes'));
        $('btnImprimirFicha').addEventListener('click', () => window.print());
        $('btnDataHoje').addEventListener('click', () => { $('form_Data').value = Utils.hojeISO(); });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', evento => {
                // Clique fora do quadro fecha o modal (exceto os marcados com data-sem-fechar-fora)
                if (evento.target === overlay && !overlay.hasAttribute('data-sem-fechar-fora')) Modais.fechar(overlay.id);
            });
        });

        document.querySelectorAll('.input-money').forEach(input => {
            input.addEventListener('input', () => Modais.aplicarMascaraMoeda(input));
        });

        // Fecha dropdowns de filtro ao clicar fora; ESC fecha modais e dropdowns
        document.addEventListener('click', evento => {
            if (!evento.target.closest('.multi-select')) Filtros.fecharTodos();
        });
        document.addEventListener('keydown', evento => {
            if (evento.key === 'Escape') { Filtros.fecharTodos(); Modais.fecharTodos(); }

            // Tecla "/" leva à pesquisa rápida (exceto quando já se está digitando em algum campo)
            const digitando = evento.target.closest && evento.target.closest('input, textarea, select, [contenteditable="true"]');
            const modalAberto = document.querySelector('.modal-overlay.aberto');
            if (evento.key === '/' && abaAtual === 'consulta' && !digitando && !modalAberto && !Relatorio.estaAberto() && !evento.ctrlKey && !evento.metaKey) {
                evento.preventDefault();
                $('pesquisaRapida').focus();
                $('pesquisaRapida').select();
            }
        });

        $('btnDarkMode').addEventListener('click', () => {
            aplicarTema(!document.body.classList.contains('dark-theme'));
        });

        // Só avisa ao sair se os dados ainda estão sendo salvos ou não puderam ser salvos
        window.addEventListener('beforeunload', evento => {
            if (Estado.registros.length > 0 && (Estado.salvando || !Estado.persistenciaOk)) {
                evento.preventDefault();
                evento.returnValue = '';
            }
        });
    }

    async function iniciar() {
        $('versaoApp').textContent = Config.VERSAO;
        Dica.iniciar();
        Relatorio.iniciar();
        Comparacao.iniciar();

        let temaSalvo = null;
        try { temaSalvo = localStorage.getItem(Config.CHAVE_TEMA); } catch (e) { /* ignorado */ }
        aplicarTema(temaSalvo === 'escuro');

        if (typeof XLSX === 'undefined') {
            window.mostrarAviso('A biblioteca de leitura de Excel (SheetJS) não carregou: não será possível abrir arquivos. ' +
                'Verifique a internet/bloqueio da rede ou use a cópia local das bibliotecas (veja LEIAME.md).');
        }

        ligarEventos();
        Estado.aoMudarPersistencia = atualizarStatus;
        await Estado.restaurar();
        aposAlterarDados();

        let abaSalva = null;
        try { abaSalva = localStorage.getItem(Config.CHAVE_ABA); } catch (e) { /* ignorado */ }
        trocarAba(abaSalva || 'consulta');
    }

    return { iniciar, renderizar, trocarAba, verReservas, filtrarReservas, limparFiltros };
})();

document.addEventListener('DOMContentLoaded', App.iniciar);
