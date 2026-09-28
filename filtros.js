/* =========================================================================
   filtros.js — Filtros de múltipla seleção por coluna (estilo Excel)
   ========================================================================= */

const Filtros = (() => {

    /** Valor usado para comparar/filtrar um campo de um registro. */
    function chave(reg, campo) {
        const v = reg[campo];
        return v === null || v === undefined ? '' : String(v).trim();
    }

    function rotulo(campo, valor) {
        return Config.CAMPOS_MONETARIOS.includes(campo) ? Utils.formatarMoeda(valor) : valor;
    }

    function ordenar(campo, valores) {
        if (Config.CAMPOS_MONETARIOS.includes(campo)) {
            return valores.sort((a, b) => Number(a) - Number(b));
        }
        if (campo === 'Data') {
            // Ordem cronológica (e não alfabética "01/12" antes de "15/03")
            const iso = v => Utils.dataBRparaISO(v) || v;
            return valores.sort((a, b) => iso(a).localeCompare(iso(b)));
        }
        return valores.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
    }

    // ------------------------- PESQUISA RÁPIDA -------------------------
    // O texto pesquisável de cada registro é montado uma única vez e guardado
    // num WeakMap: ao editar um registro, o objeto é trocado e o cache se renova sozinho.
    const cacheBusca = new WeakMap();

    function textoPesquisavel(reg) {
        let t = cacheBusca.get(reg);
        if (t === undefined) {
            const partes = [];
            Config.CAMPOS_BUSCA.forEach(campo => {
                if (Config.CAMPOS_MONETARIOS.includes(campo)) {
                    const valor = Utils.formatarDecimal(reg[campo]);   // "1.500,00"
                    partes.push(valor, valor.replace(/\./g, ''));       // também "1500,00"
                } else {
                    partes.push(reg[campo]);
                }
            });
            partes.push(Utils.nomeSecretaria(reg.UO));                  // "0206-SAÚDE"
            t = Utils.normalizarBusca(partes.join(' | '));
            cacheBusca.set(reg, t);
        }
        return t;
    }

    /** Palavras digitadas; todas precisam aparecer no registro (em qualquer campo). */
    function termosBusca() {
        return Utils.normalizarBusca(Estado.busca).split(/\s+/).filter(Boolean);
    }

    /** Período (datas aaaa-mm-dd; comparação de texto funciona). Sem data = fora do período. */
    function noPeriodo(reg, de, ate) {
        if (!de && !ate) return true;
        if (!reg.DataISO) return false;
        return (!de || reg.DataISO >= de) && (!ate || reg.DataISO <= ate);
    }

    function temFiltros() {
        return Object.keys(Estado.filtros).length > 0 || Estado.busca.trim() !== '' ||
            !!(Estado.periodo.de || Estado.periodo.ate);
    }

    /** Filtros ativos em texto simples (painel e relatórios). Ex.: ["Período: 01/01/2026 a 31/03/2026"] */
    function descrever() {
        const itens = [];
        const { de, ate } = Estado.periodo;
        const br = Utils.dataISOparaBR;
        if (de && ate) itens.push(`Período: ${br(de)} a ${br(ate)}`);
        else if (de) itens.push(`Período: a partir de ${br(de)}`);
        else if (ate) itens.push(`Período: até ${br(ate)}`);
        if (Estado.busca.trim()) itens.push(`Pesquisa: “${Estado.busca.trim()}”`);
        Object.entries(Estado.filtros).forEach(([campo, permitidos]) => {
            const valor = permitidos.size === 1 ? rotulo(campo, [...permitidos][0]) : `${permitidos.size} selecionados`;
            itens.push(`${Config.ROTULOS[campo] || campo}: ${valor}`);
        });
        return itens;
    }

    /** Retorna somente os registros que atendem aos filtros das colunas e à pesquisa rápida. */
    function aplicar(registros) {
        const ativos = Object.entries(Estado.filtros);
        const termos = termosBusca();
        const { de, ate } = Estado.periodo;
        if (ativos.length === 0 && termos.length === 0 && !de && !ate) return registros;

        return registros.filter(reg =>
            noPeriodo(reg, de, ate) &&
            ativos.every(([campo, permitidos]) => permitidos.has(chave(reg, campo))) &&
            (termos.length === 0 || termos.every(t => textoPesquisavel(reg).includes(t)))
        );
    }

    /** (Re)constrói todos os dropdowns a partir dos dados carregados. */
    function gerar() {
        Config.CAMPOS.forEach(campo => {
            const container = document.getElementById('filtro_' + campo);
            if (!container) return;

            if (Estado.registros.length === 0) {
                container.innerHTML = '';
                return;
            }

            const unicos = [...new Set(Estado.registros.map(r => chave(r, campo)))].filter(v => v !== '');
            const opcoes = ordenar(campo, unicos).map(v =>
                `<label class="ms-item-label"><input type="checkbox" class="ms-item" value="${Utils.esc(v)}"> ${Utils.esc(rotulo(campo, v))}</label>`
            ).join('');

            container.innerHTML = `
                <button type="button" class="ms-btn">
                    <span class="ms-texto">Todos</span> <span aria-hidden="true">▾</span>
                </button>
                <div class="ms-dropdown">
                    <div class="ms-search"><input type="text" placeholder="Pesquisar..." aria-label="Pesquisar valores"></div>
                    <div class="ms-options-container">
                        <label class="ms-select-all-label"><input type="checkbox" class="ms-select-all"> (Selecionar Tudo)</label>
                        ${opcoes}
                    </div>
                    <div class="ms-footer">
                        <button type="button" class="btn btn-success btn-ok">OK</button>
                        <button type="button" class="btn btn-danger btn-cancelar">Cancelar</button>
                    </div>
                </div>`;

            ligarEventos(container, campo);
            atualizarTexto(campo);
        });
    }

    function ligarEventos(container, campo) {
        const dropdown = container.querySelector('.ms-dropdown');
        const master = container.querySelector('.ms-select-all');
        const itens = () => container.querySelectorAll('.ms-item');

        container.querySelector('.ms-btn').addEventListener('click', e => {
            e.stopPropagation();
            const estavaAberto = dropdown.classList.contains('show');
            fecharTodos();
            if (!estavaAberto) {
                sincronizar(container, campo);
                dropdown.classList.add('show');
                container.querySelector('.ms-search input').focus();
            }
        });

        container.querySelector('.ms-search input').addEventListener('input', e => {
            const termo = e.target.value.toLowerCase();
            container.querySelectorAll('.ms-item-label').forEach(label => {
                label.style.display = label.textContent.toLowerCase().includes(termo) ? '' : 'none';
            });
        });

        master.addEventListener('change', () => {
            itens().forEach(cb => {
                if (cb.closest('label').style.display !== 'none') cb.checked = master.checked;
            });
        });

        container.querySelector('.ms-options-container').addEventListener('change', e => {
            if (e.target.classList.contains('ms-item')) {
                master.checked = [...itens()].every(cb => cb.checked);
            }
        });

        container.querySelector('.btn-ok').addEventListener('click', () => confirmar(container, campo));
        container.querySelector('.btn-cancelar').addEventListener('click', () => dropdown.classList.remove('show'));
    }

    /** Marca os checkboxes de acordo com o filtro já aplicado. */
    function sincronizar(container, campo) {
        const permitidos = Estado.filtros[campo];
        const itens = container.querySelectorAll('.ms-item');
        itens.forEach(cb => { cb.checked = permitidos ? permitidos.has(cb.value) : false; });
        container.querySelector('.ms-select-all').checked =
            !!permitidos && [...itens].every(cb => cb.checked);
    }

    function confirmar(container, campo) {
        const itens = [...container.querySelectorAll('.ms-item')];
        const marcados = itens.filter(cb => cb.checked).map(cb => cb.value);

        if (marcados.length === 0 || marcados.length === itens.length) delete Estado.filtros[campo];
        else Estado.filtros[campo] = new Set(marcados);

        Estado.limiteLinhas = Config.LINHAS_POR_PAGINA;
        atualizarTexto(campo);
        container.querySelector('.ms-dropdown').classList.remove('show');
        App.renderizar();
    }

    function atualizarTexto(campo) {
        const container = document.getElementById('filtro_' + campo);
        if (!container) return;
        const botao = container.querySelector('.ms-btn');
        const texto = container.querySelector('.ms-texto');
        const permitidos = Estado.filtros[campo];

        if (!permitidos || permitidos.size === 0) {
            texto.textContent = 'Todos';
            botao.classList.remove('active-filter');
        } else if (permitidos.size === 1) {
            texto.textContent = rotulo(campo, [...permitidos][0]);
            botao.classList.add('active-filter');
        } else {
            texto.textContent = `${permitidos.size} selecionados`;
            botao.classList.add('active-filter');
        }
    }

    function fecharTodos() {
        document.querySelectorAll('.ms-dropdown.show').forEach(d => d.classList.remove('show'));
    }

    function limpar() {
        Estado.filtros = {};
        Estado.busca = '';
        Estado.periodo = { de: '', ate: '' };
        Estado.limiteLinhas = Config.LINHAS_POR_PAGINA;
        gerar();   // reconstrói os dropdowns limpos (checkboxes e pesquisa zerados)
    }

    return { aplicar, gerar, limpar, fecharTodos, temFiltros, descrever };
})();
