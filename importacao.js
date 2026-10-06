/* =========================================================================
   importacao.js — Leitura do arquivo (XLS, XLSX ou CSV)
   Detecta o layout UMA vez por arquivo e descarta linhas que não são
   reservas (cabeçalhos, totais, rodapés, linhas vazias).
   Layouts aceitos:
     - Fiorilli        : relatório XLS/XLSX (colunas pela LETRA, Config.COLUNAS_FIORILLI)
     - Fiorilli (CSV)  : CSV exportado pelo Fiorilli (colunas pelo NOME, Config.COLUNAS_FIORILLI_CSV) — V4.2.5
     - Simplificado    : planilha exportada por esta ferramenta (Config.COLUNAS_SIMPLES)
   ========================================================================= */

const Importacao = (() => {
    // Nº de reserva válido: começa com dígito; pode conter . / -  (ex.: 1234, 1234/2026)
    const REGEX_RESERVA = /^\d[\d./-]*$/;

    function lerArquivo(arquivo) {
        return new Promise((resolve, reject) => {
            const leitor = new FileReader();
            leitor.onload = e => {
                try {
                    const bytes = new Uint8Array(e.target.result);

                    // V4.2.5: CSV do Fiorilli é lido pelo nome das colunas, sem depender do SheetJS
                    if (/\.csv$/i.test(arquivo.name || '')) {
                        const csv = interpretarCSVFiorilli(decodificarTexto(bytes));
                        if (csv) { resolve(csv); return; }
                        // Não é o CSV do Fiorilli: segue a leitura normal (ex.: layout simplificado)
                    }

                    if (typeof XLSX === 'undefined') {
                        throw new Error('A biblioteca de leitura de Excel (SheetJS) não foi carregada. Verifique a conexão com a internet.');
                    }
                    resolve(interpretar(bytes));
                } catch (erro) {
                    reject(erro);
                }
            };
            leitor.onerror = () => reject(leitor.error || new Error('Falha na leitura do arquivo.'));
            leitor.readAsArrayBuffer(arquivo);
        });
    }

    // ------------------------------------------------------------------
    // XLS / XLSX (e CSV que não seja do Fiorilli) — leitura via SheetJS
    // ------------------------------------------------------------------

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

        return extrairRegistros(linhas, mapa, layoutFiorilli ? 'Fiorilli' : 'Simplificado');
    }

    // ------------------------------------------------------------------
    // CSV do Fiorilli (V4.2.5)
    // ------------------------------------------------------------------

    /** UTF-8 (com ou sem BOM); se houver bytes inválidos, usa Windows-1252 (ANSI). */
    function decodificarTexto(bytes) {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
        } catch (e) {
            return new TextDecoder('windows-1252').decode(bytes);
        }
    }

    /**
     * Separa o texto em linhas e células. Aceita ";" ou "," e campos entre aspas.
     * V4.2.5: aspas soltas no meio de um texto (ex.: CEI - MÚLTIPLO USO "MARCIO ANTONIO)
     * são tratadas como caractere comum. Na 1ª versão, uma única aspa desse tipo "engolia"
     * mais de mil linhas seguintes do arquivo.
     */
    function lerCSV(texto) {
        // No CSV do Fiorilli cada reserva ocupa exatamente UMA linha do arquivo
        const fisicas = texto.split(/\r\n|\n|\r/);
        if (fisicas.length && fisicas[fisicas.length - 1] === '') fisicas.pop();
        const primeira = fisicas[0] || '';
        const sep = (primeira.split(';').length >= primeira.split(',').length) ? ';' : ',';
        return fisicas.map(l => separarCampos(l, sep));
    }

    /** Separa uma linha em campos. Aspas só delimitam o campo quando abrem E fecham corretamente. */
    function separarCampos(linha, sep) {
        const campos = [];
        let i = 0;
        while (i <= linha.length) {
            if (linha[i] === '"') {
                // Procura a aspa de fechamento seguida de separador ou fim da linha
                let j = i + 1, valor = '', fechou = false;
                while (j < linha.length) {
                    if (linha[j] === '"' && linha[j + 1] === '"') { valor += '"'; j += 2; continue; }
                    if (linha[j] === '"' && (j + 1 === linha.length || linha[j + 1] === sep)) { fechou = true; break; }
                    valor += linha[j]; j++;
                }
                if (fechou) { campos.push(valor); i = j + 2; continue; }
                // Aspa sem fechamento: o campo é lido como texto comum (abaixo)
            }
            let fim = linha.indexOf(sep, i);
            if (fim < 0) fim = linha.length;
            campos.push(linha.slice(i, fim));
            i = fim + 1;
        }
        return campos;
    }

    /**
     * Retorna o resultado da importação se o texto for o CSV do Fiorilli,
     * ou null se não for (o arquivo segue então para a leitura normal).
     */
    function interpretarCSVFiorilli(texto) {
        const linhas = lerCSV(texto);
        const nomeColuna = v => String(v).trim().toUpperCase();

        // Cabeçalho: linha (entre as primeiras) que contém as colunas RESERVA e FICHA
        const iCab = linhas.slice(0, 20).findIndex(l => {
            const nomes = l.map(nomeColuna);
            return nomes.includes('RESERVA') && nomes.includes('FICHA');
        });
        if (iCab < 0) return null;

        const cabecalho = linhas[iCab].map(nomeColuna);
        const mapa = {};
        const faltando = [];
        Object.entries(Config.COLUNAS_FIORILLI_CSV).forEach(([campo, nome]) => {
            const i = cabecalho.indexOf(nome.toUpperCase());
            if (i < 0) faltando.push(nome); else mapa[campo] = i;
        });
        if (faltando.length) {
            throw new Error('O CSV parece ser do Fiorilli, mas faltam as colunas: ' + faltando.join(', ') +
                '. Confira o arquivo ou ajuste Config.COLUNAS_FIORILLI_CSV.');
        }
        // V4.2.6: colunas adicionais são opcionais (só entram as que existirem no arquivo)
        Object.entries(Config.COLUNAS_EXTRAS_CSV || {}).forEach(([campo, nome]) => {
            const i = cabecalho.indexOf(nome.toUpperCase());
            if (i >= 0) mapa[campo] = i;
        });

        const resultado = extrairRegistros(linhas.slice(iCab + 1), mapa, 'Fiorilli (CSV)');
        resultado.registros.forEach(ajustarCodigosCSV);
        resultado.ignoradas += iCab + 1;   // cabeçalho (e linhas acima dele)
        return resultado;
    }

    /**
     * Iguala o CSV ao formato do XLS. O CSV original do Fiorilli já traz os zeros à esquerda;
     * os ajustes cobrem o CSV aberto e salvo de novo no Excel, que remove esses zeros.
     * Também converte valores em notação científica.
     */
    function ajustarCodigosCSV(reg) {
        const d = Config.DIGITOS_CSV;
        const completar = (v, n) => {
            const s = String(v).trim();
            return /^\d+$/.test(s) ? s.padStart(n, '0') : s;
        };
        reg.UO = completar(reg.UO, d.UO);                              // 20101 -> 020101
        reg.Fonte = completar(reg.Fonte, d.Fonte);                     // 1 -> 01
        // Só processos no formato com ponto (1.003.1 -> 001.003.1); números simples
        // como "7" ou "031988" ficam como estão, igual ao XLS
        const processo = String(reg.Processo).trim();
        if (/^\d+(\.\d+)+$/.test(processo)) {
            const partes = processo.split('.');
            partes[0] = completar(partes[0], d.Processo);
            reg.Processo = partes.join('.');
        } else {
            reg.Processo = processo;
        }

        // Saldos residuais vêm em notação científica ("4,78E-10" = praticamente zero).
        // Convertidos aqui para não serem lidos como 47.800.000.000.
        Config.CAMPOS_MONETARIOS.forEach(campo => {
            const s = String(reg[campo]).trim();
            if (/^-?\d+(,\d+)?E[+-]?\d+$/i.test(s)) reg[campo] = Number(s.replace(',', '.'));
        });
    }

    // ------------------------------------------------------------------
    // Comum a todos os layouts
    // ------------------------------------------------------------------

    function extrairRegistros(linhas, mapa, layout) {
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
                'reservas do Fiorilli (XLS ou CSV) ou uma planilha exportada por esta ferramenta.'
            );
        }

        return { registros, ignoradas, layout };
    }

    function montarRegistro(linha, mapa) {
        // Células vazias ou com zero NÃO buscam valor em outra coluna (erro da versão anterior)
        const celula = campo => {
            const v = linha[mapa[campo]];
            return (v === null || v === undefined) ? '' : v;
        };
        const reg = {};
        Config.CAMPOS.forEach(campo => { reg[campo] = celula(campo); });
        (Config.CAMPOS_EXTRAS || []).forEach(campo => {          // V4.2.6: informações adicionais
            if (mapa[campo] !== undefined) reg[campo] = String(celula(campo)).trim();
        });
        reg.Reserva = String(reg.Reserva).trim();
        return reg;   // números e datas são normalizados em Estado.normalizarRegistro
    }

    return { lerArquivo, interpretar, interpretarCSVFiorilli };
})();
