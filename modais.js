/* =========================================================================
   modais.js — Ficha de detalhes e formulário de inclusão/edição
   ========================================================================= */

const Modais = (() => {
    const e = Utils.esc;

    function abrir(id) {
        document.getElementById(id).classList.add('aberto');
    }

    function fechar(id) {
        document.getElementById(id).classList.remove('aberto');
        if (id === 'modalDetalhes') document.body.classList.remove('imprimindo-ficha');
    }

    function fecharTodos() {
        document.querySelectorAll('.modal-overlay.aberto').forEach(m => fechar(m.id));
    }

    // ------------------------------ FICHA ------------------------------

    function item(rotulo, valor, classes = '') {
        return `
            <div class="detalhe-item ${classes}">
                <span class="detalhe-label">${rotulo}</span>
                <span class="detalhe-valor">${valor}</span>
            </div>`;
    }

    function abrirFicha(reg) {
        const vazio = v => (v === '' || v === null || v === undefined) ? 'N/A' : e(v);

        // V4.2.6: informações adicionais (só aparecem quando a reserva veio do CSV do Fiorilli)
        const largos = ['Programa', 'CentroCusto'];
        const extras = (Config.CAMPOS_EXTRAS || []).filter(c => Utils.texto(reg[c]).trim() !== '');
        const blocoExtras = extras.length ? `
                <div class="ficha-extras-titulo">Informações adicionais (CSV do Fiorilli)</div>
                ${extras.map(c => item(e(Config.ROTULOS[c] || c), e(reg[c]), largos.includes(c) ? 'full-width' : '')).join('')}` : '';

        document.getElementById('conteudoDetalhes').innerHTML = `
            <div class="detalhes-grid">
                <div class="detalhe-item">
                    <span class="detalhe-label">Reserva N.º</span>
                    <span class="detalhe-valor numero-reserva">${vazio(reg.Reserva)}</span>
                </div>
                ${item('Data', vazio(reg.Data))}
                ${item('Secretaria / Unidade Orçamentária', e(Utils.nomeSecretaria(reg.UO)), 'full-width')}
                ${item('Histórico', vazio(reg.Historico), 'full-width')}
                ${item('Ficha', vazio(reg.Ficha))}
                ${item('Fonte', vazio(reg.Fonte))}
                ${item('Processo', vazio(reg.Processo), 'full-width')}
                ${item('Natureza de Despesa', vazio(reg.NaturezaDespesa), 'full-width')}
                ${item('Valor Reserva', Utils.formatarMoeda(reg.ValorReserva))}
                ${item('Saldo Reserva', Utils.formatarMoeda(reg.SaldoReserva))}
                ${item('Empenhado da ficha', Utils.formatarMoeda(reg.ValorEmpenhado))}
                <div class="detalhe-item">
                    <span class="detalhe-label">Saldo Atual da Ficha</span>
                    <span class="detalhe-valor destaque">${Utils.formatarMoeda(reg.SaldoAtual)}</span>
                </div>${blocoExtras}
            </div>`;

        document.body.classList.add('imprimindo-ficha');
        abrir('modalDetalhes');
    }

    // --------------------------- FORMULÁRIO ---------------------------

    const campoForm = campo => document.getElementById('form_' + campo);

    function aplicarMascaraMoeda(input) {
        const digitos = input.value.replace(/\D/g, '');
        if (digitos === '') { input.value = ''; return; }
        input.value = Utils.formatarDecimal(parseInt(digitos, 10) / 100);
    }

    function abrirNovo() {
        document.getElementById('modalTitulo').textContent = 'Nova reserva';
        document.getElementById('editId').value = '';
        document.getElementById('formReserva').reset();
        abrir('modalFormulario');
        campoForm('Data').focus();
    }

    function abrirEdicao(reg) {
        document.getElementById('modalTitulo').textContent = `Editar reserva ${reg.Reserva}`;
        document.getElementById('editId').value = reg._id;

        Config.CAMPOS.forEach(campo => {
            const input = campoForm(campo);
            if (!input) return;
            if (campo === 'Data') input.value = reg.DataISO || '';
            else if (Config.CAMPOS_MONETARIOS.includes(campo)) input.value = Utils.formatarDecimal(reg[campo]);
            else input.value = reg[campo];
        });

        abrir('modalFormulario');
    }

    /** Lê o formulário. Retorna { id, dados } — id = null para inclusão. */
    function lerFormulario() {
        const id = parseInt(document.getElementById('editId').value, 10);
        const dados = {};
        Config.CAMPOS.forEach(campo => {
            const input = campoForm(campo);
            dados[campo] = input ? input.value.trim() : '';
        });
        dados.Data = Utils.dataISOparaBR(dados.Data);
        return { id: Number.isNaN(id) ? null : id, dados };
    }

    return { abrir, fechar, fecharTodos, abrirFicha, abrirNovo, abrirEdicao, lerFormulario, aplicarMascaraMoeda };
})();
