/* =========================================================================
   avisos.js — Avisos e confirmações na própria página (V4.2.6)
   Substitui as janelas alert()/confirm() do navegador, que travam a tela
   e não seguem o tema claro/escuro.
     Avisos.notificar(mensagem, tipo)  -> faixa no canto da tela (some sozinha)
     Avisos.confirmar(mensagem, opcoes) -> Promise<boolean> (true = confirmou)
   ========================================================================= */

const Avisos = (() => {
    const DURACAO = { sucesso: 4000, info: 5000, alerta: 7000, erro: 10000 };
    const ICONE = { sucesso: '✔', info: 'ℹ', alerta: '⚠', erro: '✖' };

    let pilha = null;          // container das notificações
    let confirmacao = null;    // confirmação aberta: { overlay, responder }

    // --------------------------- NOTIFICAÇÕES ---------------------------

    function obterPilha() {
        if (!pilha) {
            pilha = document.createElement('div');
            pilha.className = 'av-pilha';
            pilha.setAttribute('aria-live', 'polite');
            document.body.appendChild(pilha);
        }
        return pilha;
    }

    /** Mostra uma mensagem. tipo: 'info' | 'sucesso' | 'alerta' | 'erro'. */
    function notificar(mensagem, tipo = 'info') {
        if (!DURACAO[tipo]) tipo = 'info';
        const item = document.createElement('div');
        item.className = `av-item av-${tipo}`;
        item.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');

        const icone = document.createElement('span');
        icone.className = 'av-icone';
        icone.setAttribute('aria-hidden', 'true');
        icone.textContent = ICONE[tipo];

        const texto = document.createElement('div');
        texto.className = 'av-texto';
        texto.textContent = String(mensagem);          // \n vira quebra de linha (CSS pre-line)

        const fechar = document.createElement('button');
        fechar.type = 'button';
        fechar.className = 'av-fechar';
        fechar.setAttribute('aria-label', 'Fechar aviso');
        fechar.textContent = '×';

        item.append(icone, texto, fechar);
        obterPilha().appendChild(item);

        let temporizador = null;
        const remover = () => {
            clearTimeout(temporizador);
            item.classList.add('av-saindo');
            setTimeout(() => item.remove(), 200);
        };
        const agendar = () => { temporizador = setTimeout(remover, DURACAO[tipo]); };
        fechar.addEventListener('click', remover);
        item.addEventListener('mouseenter', () => clearTimeout(temporizador));   // pausa enquanto o mouse está em cima
        item.addEventListener('mouseleave', agendar);
        agendar();
    }

    // --------------------------- CONFIRMAÇÕES ---------------------------

    /**
     * Pergunta na própria página. Resolve true (confirmou) ou false (cancelou, Esc ou clique fora).
     * opcoes: { titulo, ok, cancelar, perigo } — perigo = botão de confirmar em vermelho.
     */
    function confirmar(mensagem, opcoes = {}) {
        const { titulo = 'Confirmar', ok = 'Confirmar', cancelar = 'Cancelar', perigo = false } = opcoes;
        if (confirmacao) confirmacao.responder(false);   // só uma pergunta por vez

        return new Promise(resolve => {
            const foco = document.activeElement;
            const overlay = document.createElement('div');
            overlay.className = 'av-overlay';
            overlay.innerHTML = `
                <div class="av-caixa" role="alertdialog" aria-modal="true" aria-labelledby="avTitulo" aria-describedby="avMensagem">
                    <h3 id="avTitulo"></h3>
                    <p id="avMensagem"></p>
                    <div class="av-botoes">
                        <button type="button" class="btn btn-secondary" data-resposta="nao"></button>
                        <button type="button" class="btn ${perigo ? 'btn-danger' : ''}" data-resposta="sim"></button>
                    </div>
                </div>`;
            overlay.querySelector('#avTitulo').textContent = titulo;
            overlay.querySelector('#avMensagem').textContent = String(mensagem);
            overlay.querySelector('[data-resposta="nao"]').textContent = cancelar;
            overlay.querySelector('[data-resposta="sim"]').textContent = ok;

            function responder(valor) {
                if (!confirmacao || confirmacao.overlay !== overlay) return;
                confirmacao = null;
                window.removeEventListener('keydown', teclas, true);
                overlay.remove();
                if (foco && typeof foco.focus === 'function') foco.focus();
                resolve(valor);
            }

            function teclas(evento) {
                if (evento.key === 'Escape') { evento.preventDefault(); evento.stopImmediatePropagation(); responder(false); return; }
                // Tab fica preso entre os dois botões
                if (evento.key === 'Tab') {
                    const botoes = overlay.querySelectorAll('button');
                    const i = [...botoes].indexOf(document.activeElement);
                    evento.preventDefault();
                    botoes[(i + (evento.shiftKey ? -1 : 1) + botoes.length) % botoes.length].focus();
                }
            }

            overlay.addEventListener('click', evento => {
                const botao = evento.target.closest('[data-resposta]');
                if (botao) responder(botao.dataset.resposta === 'sim');
                else if (evento.target === overlay) responder(false);
            });
            window.addEventListener('keydown', teclas, true);

            confirmacao = { overlay, responder };
            document.body.appendChild(overlay);
            overlay.querySelector('[data-resposta="sim"]').focus();
        });
    }

    return { notificar, confirmar };
})();
