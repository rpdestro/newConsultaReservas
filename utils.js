/* =========================================================================
   utils.js — Funções utilitárias puras (sem acesso à tela)
   Pode ser reaproveitado nas outras ferramentas da Prefeitura.
   ========================================================================= */

const Utils = (() => {
    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const FORMATO_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const FORMATO_DECIMAL = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    /** Converte null/undefined em texto vazio (compatível com navegadores mais antigos). */
    function texto(valor) {
        return (valor === null || valor === undefined) ? '' : String(valor);
    }

    /** Protege textos antes de inseri-los no HTML (evita quebra da tabela com <, &, aspas). */
    function esc(valor) {
        return texto(valor).replace(/[&<>"']/g, c => ESCAPES[c]);
    }

    /** Texto em minúsculas e sem acentos, para comparações da pesquisa ("Saúde" -> "saude"). */
    function normalizarBusca(valor) {
        return texto(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    /**
     * Converte textos monetários em número.
     * Aceita: 1500 | "1.500" | "1.500,50" | "R$ 1.500,50" | "1500.50" | "(1.500,00)" | "-1.500,00" | "1.500,00-"
     */
    function converterParaNumero(valor) {
        if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
        if (valor === null || valor === undefined) return 0;

        let s = String(valor).replace(/R\$/g, '').replace(/\s/g, '');
        if (!s) return 0;

        const negativo = /^\(.*\)$/.test(s) || s.startsWith('-') || s.endsWith('-');
        s = s.replace(/[()\-]/g, '');

        if (s.includes(',')) {
            // Padrão brasileiro: ponto = milhar, vírgula = decimal
            s = s.replace(/\./g, '').replace(',', '.');
        } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
            // Somente separador de milhar, sem centavos: "1.500" -> 1500
            s = s.replace(/\./g, '');
        }

        const n = parseFloat(s);
        if (Number.isNaN(n)) return 0;
        return negativo ? -n : n;
    }

    function formatarMoeda(valor) {
        return FORMATO_BRL.format(converterParaNumero(valor));
    }

    /** "1.500,50" — usado para preencher os campos de valor do formulário. */
    function formatarDecimal(valor) {
        return FORMATO_DECIMAL.format(converterParaNumero(valor));
    }

    /** Formato curto para rótulos de gráfico: R$ 1,5M / R$ 250,0k */
    function formatarMoedaCompacta(valor) {
        const abs = Math.abs(valor);
        // 999.950 em diante já arredonda para "1.000,0k": mostra como milhão
        if (abs >= 999950) return 'R$ ' + (valor / 1e6).toFixed(1).replace('.', ',') + 'M';
        if (abs >= 999.95) return 'R$ ' + (valor / 1e3).toFixed(1).replace('.', ',') + 'k';
        return FORMATO_BRL.format(valor);
    }

    // ------------------------------ DATAS ------------------------------

    const dd = n => String(n).padStart(2, '0');

    /**
     * Normaliza qualquer representação de data para "dd/mm/aaaa".
     * Números são tratados como data serial do Excel (sem conversão de fuso horário,
     * o que evita o problema de a data aparecer com um dia a menos).
     */
    function normalizarData(valor) {
        if (valor === null || valor === undefined || valor === '') return '';

        if (typeof valor === 'number') {
            if (valor > 0 && typeof XLSX !== 'undefined') {
                const d = XLSX.SSF.parse_date_code(valor);
                if (d && d.y) return `${dd(d.d)}/${dd(d.m)}/${d.y}`;
            }
            return String(valor);
        }

        if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
            return `${dd(valor.getDate())}/${dd(valor.getMonth() + 1)}/${valor.getFullYear()}`;
        }

        const s = String(valor).trim();

        let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return `${dd(m[3])}/${dd(m[2])}/${m[1]}`;

        m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:\s.*)?$/);
        if (m) {
            const ano = m[3].length === 2 ? '20' + m[3] : m[3];
            return `${dd(m[1])}/${dd(m[2])}/${ano}`;
        }

        return s;
    }

    function dataBRparaISO(dataBR) {
        const m = String(dataBR || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
    }

    function dataISOparaBR(dataISO) {
        const m = String(dataISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
    }

    function hojeISO() {
        const h = new Date();
        return `${h.getFullYear()}-${dd(h.getMonth() + 1)}-${dd(h.getDate())}`;
    }

    /** Converte "aaaa-mm-dd" para número serial do Excel (independe de fuso). */
    function isoParaSerialExcel(dataISO) {
        const m = String(dataISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        return (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000;
    }

    // --------------------------- SECRETARIAS ---------------------------

    function codigoSecretaria(uo) {
        const cod = texto(uo).replace(/\D/g, '').substring(0, 4);
        return cod || 'N/A';
    }

    function nomeSecretaria(uo) {
        const cod = codigoSecretaria(uo);
        if (cod === 'N/A') return 'UO não informada';
        const nome = Config.SECRETARIAS[cod];
        return nome ? `${cod}-${nome}` : `UO ${cod}`;
    }

    // ----------------------------- FONTES -----------------------------

    /** "Fonte 1" (ou "Fonte não informada"). */
    function rotuloFonte(fonte) {
        const f = texto(fonte).trim();
        return f ? `Fonte ${f}` : 'Fonte não informada';
    }

    /** Nome da fonte pelo código inicial (ver Config.FONTES); '' se desconhecido. */
    function nomeFonte(fonte) {
        const m = texto(fonte).match(/^\s*0*(\d+)/);
        return (m && Config.FONTES && Config.FONTES[parseInt(m[1], 10)]) || '';
    }

    function formatarPercentual(valor) {
        return valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
    }

    return {
        rotuloFonte, nomeFonte, formatarPercentual,
        texto, esc, normalizarBusca, converterParaNumero, formatarMoeda, formatarDecimal, formatarMoedaCompacta,
        normalizarData, dataBRparaISO, dataISOparaBR, hojeISO, isoParaSerialExcel,
        codigoSecretaria, nomeSecretaria
    };
})();
