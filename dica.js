/* =========================================================================
   dica.js — Dica flutuante (tooltip) usada no painel, nos cards e no gráfico
   Substitui o "title" nativo do navegador por um cartão com cor, valor,
   barra de participação e detalhes.

   Uso no HTML gerado:   <button ${Dica.atributo({ titulo: 'Fonte 1', ... })}>
   Uso direto (gráfico): Dica.mostrar(conteudo, x, y)  /  Dica.esconder()

   Conteúdo aceito (só "titulo" é obrigatório):
     titulo, sub, cor, selo, valor,
     pct         -> número de 0 a 100; desenha a barrinha de participação
     linhas      -> [[rótulo, valor], ...]
     listaTitulo, lista -> segundo bloco de [[rótulo, valor], ...]
     acao        -> o que acontece ao clicar
   ========================================================================= */

const Dica = (() => {
    const e = Utils.esc;
    const MARGEM = 12;           // distância mínima da borda da janela
    const DESLOC_X = 16;         // distância do cursor
    const DESLOC_Y = 18;
    const ATRASO_MS = 90;        // espera antes de abrir (evita piscar ao passar rápido)

    let el = null;
    let corpo = null;
    let visivel = false;
    let alvoAtual = null;        // elemento [data-dica] sob o ponteiro ou com foco
    let temporizador = null;
    let quadro = null;
    let ultimaPos = { x: 0, y: 0 };

    /** Atributo pronto para colocar no HTML gerado. */
    function atributo(conteudo) {
        return `data-dica="${e(JSON.stringify(conteudo))}"`;
    }

    function blocoLinhas(linhas) {
        if (!linhas || linhas.length === 0) return '';
        return `<dl class="dica-linhas">${linhas.map(([rotulo, valor]) =>
            `<div class="dica-linha"><dt>${e(rotulo)}</dt><dd>${e(valor)}</dd></div>`).join('')}</dl>`;
    }

    function html(c) {
        const pct = typeof c.pct === 'number' ? Math.min(Math.max(c.pct, 0), 100) : null;
        return `
            <div class="dica-topo">
                ${c.cor ? '<span class="dica-ponto" aria-hidden="true"></span>' : ''}
                <span class="dica-titulo">${e(c.titulo)}</span>
                ${c.selo ? `<span class="dica-selo">${e(c.selo)}</span>` : ''}
            </div>
            ${c.sub ? `<div class="dica-sub">${e(c.sub)}</div>` : ''}
            ${c.valor ? `<div class="dica-valor">${e(c.valor)}</div>` : ''}
            ${pct !== null ? `<div class="dica-barra" aria-hidden="true"><span style="width:${pct.toFixed(2)}%"></span></div>` : ''}
            ${blocoLinhas(c.linhas)}
            ${c.lista && c.lista.length ? `<div class="dica-lista-titulo">${e(c.listaTitulo || '')}</div>${blocoLinhas(c.lista)}` : ''}
            ${c.acao ? `<div class="dica-acao">${e(c.acao)}</div>` : ''}`;
    }

    function criar() {
        if (el) return;
        el = document.createElement('div');
        el.id = 'dica';
        el.className = 'dica';
        el.setAttribute('role', 'tooltip');
        corpo = document.createElement('div');
        corpo.className = 'dica-corpo';
        el.appendChild(corpo);
        document.body.appendChild(el);
    }

    const limitar = (v, min, max) => Math.max(min, Math.min(v, max));

    /** Ao lado do cursor (x, y) ou, pelo teclado, abaixo do elemento (ancora). */
    function posicionar(x, y, ancora) {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        let left, top;

        if (ancora) {
            left = ancora.left + ancora.width / 2 - w / 2;
            top = ancora.bottom + 10;
            if (top + h > vh - MARGEM) top = ancora.top - h - 10;
        } else {
            left = x + DESLOC_X;
            top = y + DESLOC_Y;
            if (left + w > vw - MARGEM) left = x - w - DESLOC_X;   // vira para a esquerda do cursor
            if (top + h > vh - MARGEM) top = y - h - 10;           // vira para cima do cursor
        }

        left = limitar(left, MARGEM, Math.max(MARGEM, vw - w - MARGEM));
        top = limitar(top, MARGEM, Math.max(MARGEM, vh - h - MARGEM));
        el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    }

    function mostrar(conteudo, x, y, ancora) {
        if (!conteudo || !conteudo.titulo) return;
        criar();
        const chave = JSON.stringify(conteudo);
        if (el.dataset.chave !== chave) {          // só redesenha se o conteúdo mudou
            corpo.innerHTML = html(conteudo);
            el.dataset.chave = chave;
            el.style.setProperty('--dica-cor', conteudo.cor || '#818cf8');
        }
        posicionar(x, y, ancora);
        if (!visivel) {
            visivel = true;
            el.classList.add('visivel');
        }
    }

    function esconder() {
        clearTimeout(temporizador);
        if (alvoAtual) alvoAtual.removeAttribute('aria-describedby');
        alvoAtual = null;
        if (!el || !visivel) return;
        visivel = false;
        el.classList.remove('visivel');
    }

    function lerConteudo(alvo) {
        try { return JSON.parse(alvo.dataset.dica); } catch (erro) { return null; }
    }

    function mostrarDoElemento(alvo, x, y, ancora) {
        const conteudo = lerConteudo(alvo);
        if (!conteudo) return;
        alvo.setAttribute('aria-describedby', 'dica');
        mostrar(conteudo, x, y, ancora);
    }

    const alvoDe = no => (no && no.closest ? no.closest('[data-dica]') : null);

    function iniciar() {
        criar();

        document.addEventListener('pointerover', ev => {
            if (ev.pointerType === 'touch') return;          // no toque, o clique já executa a ação
            const alvo = alvoDe(ev.target);
            if (!alvo || alvo === alvoAtual) return;

            if (alvoAtual) alvoAtual.removeAttribute('aria-describedby');
            alvoAtual = alvo;
            ultimaPos = { x: ev.clientX, y: ev.clientY };
            clearTimeout(temporizador);

            const abrir = () => { if (alvoAtual === alvo) mostrarDoElemento(alvo, ultimaPos.x, ultimaPos.y); };
            if (visivel) abrir();                             // já aberta: troca na hora
            else temporizador = setTimeout(abrir, ATRASO_MS);
        });

        document.addEventListener('pointermove', ev => {
            if (!alvoAtual || ev.pointerType === 'touch') return;
            ultimaPos = { x: ev.clientX, y: ev.clientY };
            if (!visivel || quadro) return;
            quadro = requestAnimationFrame(() => {
                quadro = null;
                if (visivel && alvoAtual) posicionar(ultimaPos.x, ultimaPos.y);
            });
        }, { passive: true });

        document.addEventListener('pointerout', ev => {
            if (!alvoAtual) return;
            const para = ev.relatedTarget;
            if (para && alvoAtual.contains(para)) return;    // continua dentro do mesmo elemento
            if (alvoDe(para)) return;                         // foi para outro elemento com dica
            esconder();
        });

        // Teclado: mostra a dica abaixo do elemento que recebeu o foco
        document.addEventListener('focusin', ev => {
            const alvo = alvoDe(ev.target);
            if (!alvo) return;
            let pelaTecla = true;
            try { pelaTecla = alvo.matches(':focus-visible'); } catch (erro) { /* navegador antigo */ }
            if (!pelaTecla) return;
            alvoAtual = alvo;
            mostrarDoElemento(alvo, 0, 0, alvo.getBoundingClientRect());
        });
        document.addEventListener('focusout', ev => {
            if (alvoDe(ev.target) === alvoAtual) esconder();
        });

        // Clique (o painel se redesenha), rolagem, Esc ou troca de janela fecham a dica
        document.addEventListener('pointerdown', esconder);
        document.addEventListener('keydown', ev => { if (ev.key === 'Escape') esconder(); });
        window.addEventListener('scroll', esconder, { passive: true, capture: true });
        window.addEventListener('blur', esconder);
    }

    return { iniciar, atributo, mostrar, esconder };
})();
