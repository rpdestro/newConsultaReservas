/* =========================================================================
   importacao.js — Leitura do arquivo (XLS, XLSX ou CSV)
   Detecta o layout UMA vez por arquivo (Fiorilli ou simplificado) e
   descarta linhas que não são reservas (cabeçalhos, totais, rodapés).
   ========================================================================= */

const Importacao = (() => {
    // Nº de reserva válido: começa com dígito; pode conter . / -  (ex.: 1234, 1234/2026)
    const REGEX_RESERVA = /^\d[\d./-]*$/;

    function lerArquivo(arquivo) {
        return new Promise((resolve, reject) => {
            if (typeof XLSX === 'undefined') {
                reject(new Error('A biblioteca de leitura de Excel (SheetJS) não foi carregada. Verifique a conexão com a internet.'));
                return;
            }
            const leitor = new FileReader();
            leitor.onload = e => {
                try {
                    resolve(interpretar(new Uint8Array(e.target.result)));
                } catch (erro) {
                    reject(erro);
                }
            };
            leitor.onerror = () => reject(leitor.error || new Error('Falha na leitura do arquivo.'));
            leitor.readAsArrayBuffer(arquivo);
        });
    }

    function interpretar(bytes) {
        // cellDates:false -> datas chegam como número serial (sem erro de fuso horário)
        // raw:true        -> em CSV, textos como "01/02/2026" não são reinterpretados no padrão americano
        const planilha = XLSX.read(bytes, { type: 'array', cellDates: false, raw: true });

        if (!planilha.SheetNames || planilha.SheetNames.length === 0) {
            throw new Error('O arquivo não contém planilhas.');
        }

        const linhas = XLSX.utils.sheet_to_json(
            planilha.Sheets[planilha.SheetNames[0]],
            { header: 1, defval: '', raw: true }
        );

        if (linhas.length === 0) throw new Error('A planilha está vazia.');

        // Converte letras (B, BT...) em índices numéricos
        const indicesFiorilli = {};
        Object.entries(Config.COLUNAS_FIORILLI).forEach(([campo, letra]) => {
            indicesFiorilli[campo] = XLSX.utils.decode_col(letra);
        });
        const maiorIndice = Math.max(...Object.values(indicesFiorilli));

        const layoutFiorilli = linhas.some(l => Array.isArray(l) && l.length > maiorIndice);
        const mapa = layoutFiorilli ? indicesFiorilli : Config.COLUNAS_SIMPLES;

        const registros = [];
        let ignoradas = 0;

        for (const linha of linhas) {
            if (!Array.isArray(linha) || linha.every(c => String(c).trim() === '')) continue;

            const reg = montarRegistro(linha, mapa);
            if (!REGEX_RESERVA.test(reg.Reserva)) {
                ignoradas++;
                continue;
            }
            registros.push(reg);
        }

        if (registros.length === 0) {
            throw new Error(
                'Nenhuma reserva válida foi encontrada. Confira se o arquivo é o relatório de ' +
                'reservas do Fiorilli ou uma planilha exportada por esta ferramenta.'
            );
        }

        return { registros, ignoradas, layout: layoutFiorilli ? 'Fiorilli' : 'Simplificado' };
    }

    function montarRegistro(linha, mapa) {
        // Células vazias ou com zero NÃO buscam valor em outra coluna (erro da versão anterior)
        const celula = campo => {
            const v = linha[mapa[campo]];
            return (v === null || v === undefined) ? '' : v;
        };
        const reg = {};
        Config.CAMPOS.forEach(campo => { reg[campo] = celula(campo); });
        reg.Reserva = String(reg.Reserva).trim();
        return reg;   // números e datas são normalizados em Estado.normalizarRegistro
    }

    return { lerArquivo, interpretar };
})();
