/* =========================================================================
   estado.js — Dados carregados em memória + gravação no navegador
   Todo registro recebe um _id único, usado pelos botões da tabela.
   ========================================================================= */

const Estado = {
    registros: [],
    filtros: {},                       // { campo: Set(valores permitidos) }
    busca: '',                         // texto da Pesquisa rápida
    periodo: { de: '', ate: '' },      // filtro por período (datas aaaa-mm-dd)
    comparacao: null,                  // diferenças em relação à importação anterior (salva no navegador)
    comparacaoManual: null,            // comparação entre dois arquivos escolhidos (só na sessão, NÃO é salva)
    limiteLinhas: Config.LINHAS_POR_PAGINA,
    info: null,                        // { arquivo, layout, carregadoEm, ignoradas, conferencia: { qtd, total } }
    persistenciaOk: true,
    _proximoId: 1,

    /**
     * Garante o mesmo formato para registros vindos do arquivo, do formulário ou do navegador.
     * gerarId = false: não cria _id nem altera a numeração (usado na comparação manual,
     * cujos registros não fazem parte da Consulta).
     */
    normalizarRegistro(dados, gerarId = true) {
        const reg = gerarId ? { _id: dados._id || this._proximoId++ } : {};

        Config.CAMPOS.forEach(campo => {
            reg[campo] = Config.CAMPOS_MONETARIOS.includes(campo)
                ? Utils.converterParaNumero(dados[campo])
                : Utils.texto(dados[campo]).trim();
        });

        // V4.2.6: informações adicionais (só do CSV). Gravadas apenas quando preenchidas.
        (Config.CAMPOS_EXTRAS || []).forEach(campo => {
            const v = Utils.texto(dados[campo]).trim();
            if (v) reg[campo] = v;
        });

        reg.Data = Utils.normalizarData(dados.Data);
        reg.DataISO = Utils.dataBRparaISO(reg.Data);   // usado para ordenar por data
        return reg;
    },

    substituirTodos(lista, info) {
        const anteriores = this.registros;
        const infoAnterior = this.info;

        this._proximoId = 1;
        this.registros = lista.map(dados => this.normalizarRegistro({ ...dados, _id: undefined }));
        this.info = info;

        // Havia dados carregados: registra o que entrou, saiu ou mudou
        this.comparacao = anteriores.length > 0 && typeof Comparacao !== 'undefined'
            ? Comparacao.calcular(anteriores, this.registros, infoAnterior, info)
            : null;

        this.filtros = {};
        this.busca = '';
        this.periodo = { de: '', ate: '' };
        this.limiteLinhas = Config.LINHAS_POR_PAGINA;
        this.salvar();
    },

    buscar(id) {
        return this.registros.find(r => r._id === id) || null;
    },

    adicionar(dados) {
        const reg = this.normalizarRegistro({ ...dados, _id: undefined });
        this.registros.push(reg);
        this.salvar();
        return reg;
    },

    atualizar(id, dados) {
        const i = this.registros.findIndex(r => r._id === id);
        if (i < 0) return null;
        // Mantém as informações adicionais do CSV, que não aparecem no formulário de edição
        this.registros[i] = this.normalizarRegistro({ ...this.registros[i], ...dados, _id: id });
        this.salvar();
        return this.registros[i];
    },

    remover(id) {
        this.registros = this.registros.filter(r => r._id !== id);
        this.salvar();
    },

    limparTudo() {
        this.registros = [];
        this.filtros = {};
        this.busca = '';
        this.periodo = { de: '', ate: '' };
        this.comparacao = null;
        this.comparacaoManual = null;
        if (typeof Comparacao !== 'undefined') Comparacao.limparManual();
        this.info = null;
        this.limiteLinhas = Config.LINHAS_POR_PAGINA;
        this._proximoId = 1;
        this._versaoSalvamento++;            // cancela salvamentos pendentes
        this.salvando = false;
        this.persistenciaOk = true;
        BancoLocal.apagar('principal').catch(erro => console.warn('Falha ao apagar dados salvos:', erro));
    },

    // ----------------------- Persistência local -----------------------
    // Usa o IndexedDB (capacidade de centenas de MB), pois o localStorage
    // (~5 MB) não comporta o relatório completo do Fiorilli.

    salvando: false,
    aoMudarPersistencia: null,   // função chamada ao terminar cada salvamento (definida em app.js)
    _versaoSalvamento: 0,

    salvar() {
        const versao = ++this._versaoSalvamento;
        this.salvando = true;
        this._avisar();

        const dados = { versao: 3, info: this.info, registros: this.registros.slice(), comparacao: this.comparacao };

        return BancoLocal.gravar('principal', dados)
            .then(() => {
                if (versao === this._versaoSalvamento) this.persistenciaOk = true;
            })
            .catch(erro => {
                console.warn('Não foi possível salvar os dados no navegador:', erro);
                if (versao === this._versaoSalvamento) this.persistenciaOk = false;
            })
            .then(() => {
                if (versao === this._versaoSalvamento) {
                    this.salvando = false;
                    this._avisar();
                }
            });
    },

    async restaurar() {
        let salvo = null;

        try {
            salvo = await BancoLocal.ler('principal');
        } catch (erro) {
            console.warn('Não foi possível ler os dados salvos no navegador:', erro);
        }

        if (!salvo || !Array.isArray(salvo.registros) || salvo.registros.length === 0) return false;

        this._proximoId = 1;
        this.registros = salvo.registros.map(r => this.normalizarRegistro(r));
        this.info = salvo.info || null;
        this.comparacao = salvo.comparacao || null;
        this._proximoId = this.registros.reduce((max, r) => Math.max(max, r._id), 0) + 1;
        return true;
    },

    _avisar() {
        if (typeof this.aoMudarPersistencia === 'function') this.aoMudarPersistencia();
    }
};

/* -------------------------------------------------------------------------
   BancoLocal — acesso simplificado ao IndexedDB do navegador
   (guarda o objeto inteiro numa única chave, sem conversão para texto)
   ------------------------------------------------------------------------- */
const BancoLocal = (() => {
    const NOME_BANCO = 'reservasBotucatu';
    const TABELA = 'dados';
    let conexao = null;

    function abrir() {
        if (conexao) return Promise.resolve(conexao);
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('Este navegador não oferece IndexedDB.'));
                return;
            }
            const pedido = indexedDB.open(NOME_BANCO, 1);
            pedido.onupgradeneeded = () => pedido.result.createObjectStore(TABELA);
            pedido.onsuccess = () => {
                conexao = pedido.result;
                conexao.onclose = () => { conexao = null; };
                resolve(conexao);
            };
            pedido.onerror = () => reject(pedido.error);
            pedido.onblocked = () => reject(new Error('Banco local bloqueado por outra aba aberta.'));
        });
    }

    function executar(modo, operacao) {
        return abrir().then(db => new Promise((resolve, reject) => {
            const transacao = db.transaction(TABELA, modo);
            const pedido = operacao(transacao.objectStore(TABELA));
            transacao.oncomplete = () => resolve(pedido.result);
            transacao.onerror = () => reject(transacao.error);
            transacao.onabort = () => reject(transacao.error || new Error('Gravação cancelada pelo navegador.'));
        }));
    }

    return {
        ler: chave => executar('readonly', tabela => tabela.get(chave)),
        gravar: (chave, valor) => executar('readwrite', tabela => tabela.put(valor, chave)),
        apagar: chave => executar('readwrite', tabela => tabela.delete(chave))
    };
})();
