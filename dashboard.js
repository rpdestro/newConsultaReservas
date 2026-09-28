/* =========================================================================
   dashboard.js — Banner de total, cards por Secretaria/Fonte e gráfico
   ========================================================================= */

const Dashboard = (() => {
    const PALETA = [
        '#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0',
        '#2ec4b6', '#ff9f1c', '#e71d36', '#fb8500', '#06d6a0',
        '#118ab2', '#073b4c', '#8338ec', '#ff006e', '#8ac926',
        '#1982c4', '#6a4c93', '#ff595e', '#ffca3a', '#10002b'
    ];

    let grafico = null;
    let ultimosDados = [];

    function atualizar(dados) {
        ultimosDados = dados;

        const total = dados.reduce((soma, r) => soma + r.ValorReserva, 0);
        document.getElementById('bannerValorReserva').textContent = Utils.formatarMoeda(total);

        const temDados = dados.length > 0;
        document.getElementById('painelDashboard').classList.toggle('oculto', !temDados);
        document.getElementById('painelGrafico').classList.toggle('oculto', !temDados);

        if (!temDados) {
            document.getElementById('containerCardsDinamicos').innerHTML = '';
            destruirGrafico();
            return;
        }

        renderizarCards(dados);
        renderizarGrafico(dados);
    }

    /** Cores das fontes definidas no painel (mesma cor em toda a aplicação). */
    function coresFontes() {
        return (typeof Painel !== 'undefined' && Painel.cores) ? Painel.cores() : {};
    }

    const pct = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);

    /** Agrupa por secretaria + fonte (cards da tela e relatório da Consulta). */
    function agruparCards(dados) {
        const grupos = {};
        const totalSec = {};
        const fontes = new Set();
        let total = 0;
        dados.forEach(reg => {
            const sec = Utils.codigoSecretaria(reg.UO);
            const fonte = reg.Fonte;
            const chave = `${sec}|${fonte}`;
            if (!grupos[chave]) grupos[chave] = { sec, fonte, valor: 0, qtd: 0 };
            grupos[chave].valor += reg.ValorReserva;
            grupos[chave].qtd++;
            totalSec[sec] = (totalSec[sec] || 0) + reg.ValorReserva;
            fontes.add(fonte);
            total += reg.ValorReserva;
        });

        const opcoes = { numeric: true, sensitivity: 'base' };
        const lista = Object.values(grupos).sort((a, b) =>
            a.sec.localeCompare(b.sec, undefined, opcoes) || a.fonte.localeCompare(b.fonte, undefined, opcoes)
        );
        return { lista, total, totalSec, secretarias: Object.keys(totalSec).length, fontes: fontes.size };
    }

    function renderizarCards(dados) {
        const { lista, total, totalSec } = agruparCards(dados);
        const cores = coresFontes();

        document.getElementById('containerCardsDinamicos').innerHTML = lista.map(item => {
            const nome = Utils.esc(Utils.nomeSecretaria(item.sec));
            const nomeFonte = Utils.nomeFonte(item.fonte);
            const dica = Dica.atributo({
                titulo: Utils.nomeSecretaria(item.sec),
                sub: Utils.rotuloFonte(item.fonte) + (nomeFonte ? `, ${nomeFonte}` : ''),
                cor: cores[item.fonte],
                selo: Utils.formatarPercentual(pct(item.valor, total)),
                valor: Utils.formatarMoeda(item.valor),
                pct: pct(item.valor, total),
                linhas: [
                    ['Reservas', item.qtd.toLocaleString('pt-BR')],
                    ['Na secretaria', Utils.formatarPercentual(pct(item.valor, totalSec[item.sec]))],
                    ['No total filtrado', Utils.formatarPercentual(pct(item.valor, total))]
                ]
            });
            return `
                <div class="kpi-card" style="--cor:${cores[item.fonte] || '#8b5cf6'}" ${dica}>
                    <div class="kpi-header">
                        <span class="kpi-secretaria">${nome}</span>
                        <span class="kpi-fonte-tag">${Utils.esc(Utils.rotuloFonte(item.fonte))}</span>
                    </div>
                    <span class="kpi-title">${Utils.esc(Utils.nomeFonte(item.fonte) || 'Valor reservado')}</span>
                    <span class="kpi-value">${Utils.formatarMoeda(item.valor)}</span>
                </div>`;
        }).join('');
    }

    function coresDoTema() {
        const escuro = document.body.classList.contains('dark-theme');
        return {
            titulo: escuro ? '#f8fafc' : '#1e293b',
            eixoX: escuro ? '#cbd5e1' : '#64748b',
            eixoY: escuro ? '#f8fafc' : '#334155',
            rotulos: escuro ? '#cbd5e1' : '#475569',
            grade: escuro ? '#334155' : '#f1f5f9'
        };
    }

    function destruirGrafico() {
        if (grafico) { grafico.destroy(); grafico = null; Dica.esconder(); }
    }

    function renderizarGrafico(dados) {
        const canvas = document.getElementById('graficoReservas');
        if (!canvas || typeof Chart === 'undefined') return;
        destruirGrafico();

        const porUO = {};
        const qtdUO = {};
        const fontesUO = {};
        let totalFiltrado = 0;
        dados.forEach(reg => {
            const uo = Utils.codigoSecretaria(reg.UO);
            porUO[uo] = (porUO[uo] || 0) + reg.ValorReserva;
            qtdUO[uo] = (qtdUO[uo] || 0) + 1;
            if (!fontesUO[uo]) fontesUO[uo] = {};
            fontesUO[uo][reg.Fonte] = (fontesUO[uo][reg.Fonte] || 0) + reg.ValorReserva;
            totalFiltrado += reg.ValorReserva;
        });

        const ordenado = Object.entries(porUO).sort((a, b) => b[1] - a[1]);

        /** Conteúdo da dica de uma barra (mesmo visual das dicas do painel). */
        function conteudoDica(i) {
            const [uo, valor] = ordenado[i];
            const p = pct(valor, totalFiltrado);
            const fontes = Object.entries(fontesUO[uo]).sort((a, b) => b[1] - a[1]);
            return {
                titulo: Utils.nomeSecretaria(uo),
                sub: `${i + 1}º maior valor entre ${ordenado.length} secretarias`,
                cor: PALETA[i % PALETA.length],
                selo: Utils.formatarPercentual(p),
                valor: Utils.formatarMoeda(valor),
                pct: p,
                linhas: [
                    ['Reservas', qtdUO[uo].toLocaleString('pt-BR')],
                    ['Média por reserva', Utils.formatarMoeda(valor / qtdUO[uo])]
                ],
                listaTitulo: fontes.length > 1 ? 'Por fonte' : 'Fonte',
                lista: fontes.slice(0, 4).map(([f, v]) =>
                    [Utils.rotuloFonte(f), `${Utils.formatarMoedaCompacta(v)} (${Utils.formatarPercentual(pct(v, valor))})`])
                    .concat(fontes.length > 4 ? [[`+ ${fontes.length - 4} outras fontes`, '']] : [])
            };
        }

        function dicaExterna({ chart, tooltip }) {
            if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints || !tooltip.dataPoints.length) {
                Dica.esconder();
                return;
            }
            const caixa = chart.canvas.getBoundingClientRect();
            Dica.mostrar(conteudoDica(tooltip.dataPoints[0].dataIndex),
                caixa.left + tooltip.caretX, caixa.top + tooltip.caretY);
        }
        const cores = coresDoTema();

        grafico = new Chart(canvas, {
            type: 'bar',
            plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [],
            data: {
                labels: ordenado.map(([uo]) => Utils.nomeSecretaria(uo)),
                datasets: [{
                    label: 'Valor Reserva',
                    data: ordenado.map(([, valor]) => valor),
                    backgroundColor: ordenado.map((_, i) => PALETA[i % PALETA.length]),
                    hoverBackgroundColor: ordenado.map((_, i) => PALETA[i % PALETA.length] + 'cc'),
                    borderRadius: 6,
                    barThickness: 16
                }]
            },
            options: {
                indexAxis: 'y',
                // Basta estar na altura da barra (não precisa acertar em cima dela)
                interaction: { mode: 'nearest', axis: 'y', intersect: false },
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 10, right: 65, bottom: 10, left: 10 } },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: cores.rotulos,
                        font: { size: 10, weight: '700' },
                        formatter: valor => Utils.formatarMoedaCompacta(valor)
                    },
                    tooltip: { enabled: false, external: dicaExterna },
                    title: {
                        display: true,
                        text: 'Distribuição do Valor de Reserva por Secretaria',
                        color: cores.titulo,
                        font: { size: 13, weight: '600' },
                        padding: { bottom: 15 }
                    }
                },
                scales: {
                    x: {
                        grid: { color: cores.grade },
                        ticks: { color: cores.eixoX, font: { size: 10 }, callback: v => Utils.formatarMoedaCompacta(v) }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: cores.eixoY, font: { size: 11, weight: '600' } }
                    }
                }
            }
        });
    }

    /** Redesenha o gráfico com as cores do tema atual (claro/escuro). */
    function redesenhar() {
        if (ultimosDados.length > 0) renderizarGrafico(ultimosDados);
    }

    return { atualizar, redesenhar, agruparCards };
})();
