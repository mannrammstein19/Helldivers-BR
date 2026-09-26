/* Regiões planetárias: somente leitura. Não altera planeta, ordem ou bônus. */
(() => {
    'use strict';
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const number = value => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
    const name = value => {
        if (value && typeof value === 'object') value = value['pt-BR'] || value['en-US'] || Object.values(value).find(v => typeof v === 'string');
        return typeof value === 'string' && value.trim() && value.trim() !== 'null' ? value.trim() : '';
    };
    function normalize(planet) {
        return (Array.isArray(planet?.regions) ? planet.regions : []).filter(r => r && typeof r === 'object').map((r, i) => {
            const health = number(r.health), max = number(r.maxHealth), players = number(r.players);
            // A saúde pode ser reiniciada após a mudança de controle.
            // Considere somente o dono da REGIÃO, nunca o dono/progresso do planeta.
            const owner = String(r.owner ?? '').trim().toLowerCase();
            const human = ['1', 'human', 'humans'].includes(owner);
            const enemy = ['2', '3', '4', 'terminids', 'automatons', 'illuminate'].includes(owner);
            const validHealth = health !== null && max !== null && max > 0 && health >= 0 && health <= max;
            const completed = !human && validHealth && health === 0;
            const state = human ? 'controlled' : completed ? 'completed' : r.isAvailable === false ? 'unavailable' : 'active';
            // Indisponibilidade sem controle confirmado não prova conquista.
            const percent = human || completed ? 100 : state === 'unavailable' ? null : validHealth ? (1 - health / max) * 100 : null;
            return {name: name(r.name) || `Região ${i + 1}`, percent, state, available: r.isAvailable === true,
                players: state === 'active' && players !== null && players >= 0 ? Math.floor(players) : null,
                status: human ? '✓ Sob controle da Super Terra' : completed ? '✓ Objetivo regional concluído' : state === 'unavailable' ? 'Indisponível para operações' : r.isAvailable === true ? 'Em operação' : 'Disponibilidade não informada',
                note: human ? 'Região sob controle humano. Libertação regional: 100%.' : completed ? 'A vida da região chegou a zero nesta leitura.' : state === 'unavailable' ? (enemy ? 'A região não está aberta para operações. A indisponibilidade não confirma uma conquista.' : 'A leitura atual não permite confirmar a conquista desta região.') : ''};
        });
    }
    const activeRegions = planet => normalize(planet).filter(r => r.available && r.state === 'active');
    function details(planet, source = 'campaigns') {
        const rows = activeRegions(planet);
        if (!rows.length) return '';
        const reading = window.HDBRWarData?.meta(`https://api.helldivers2.dev/api/v1/${source}`);
        const stamp = reading?.time ? `${reading.stale ? 'Última leitura salva' : 'Leitura'}: ${new Date(reading.time).toLocaleString('pt-BR')}` : 'Dados da região informados pela API';
        return `<section class="hd-region-list" aria-label="Regiões do planeta">
            <div class="hd-region-heading">REGIÕES DO PLANETA <span>${rows.length}</span></div>
            ${rows.map(r => {
                const pct = r.percent === null ? null : Math.floor(r.percent * 100 + 1e-8) / 100;
                const label = pct === null ? 'Progresso indisponível' : pct.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%';
                return `<div class="hd-region-card hd-region-${r.state}"><div class="hd-region-title"><strong>${escape(r.name)}</strong><span>${escape(r.status)}</span></div>
                <div class="hd-region-value"><span>Progresso da região</span><strong>${label}</strong></div>
                ${pct === null ? (r.note ? '' : '<div class="hd-region-unknown">Aguardando uma leitura válida da região.</div>') : `<div class="hd-region-track" role="progressbar" aria-label="${escape(r.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`}
                ${r.note ? `<div class="hd-region-note">${escape(r.note)}</div>` : ''}
                ${r.players === null ? '' : `<div class="hd-region-players">${r.players.toLocaleString('pt-BR')} Helldivers na região</div>`}</div>`;
            }).join('')}
            <p class="hd-region-note">Progresso independente. A barra do planeta acompanha as atualizações do jogo pela API.</p>
            <small class="hd-region-reading">${escape(stamp)}</small>
        </section>`;
    }
    const records = new Map();
    let dialog, activeKey, opener;
    function paint() {
        const record = records.get(activeKey);
        if (!record || !dialog) return;
        if (!activeRegions(record.planet).length) { close(); return; }
        dialog.querySelector('[data-region-content]').innerHTML = details(record.planet, record.source) || '<p>Não há regiões nesta leitura.</p>';
        dialog.querySelector('h2').textContent = 'Regiões · ' + (name(record.planet.name) || 'Planeta');
    }
    function close() { if (dialog?.open) dialog.close(); }
    function open(key, button) {
        if (!records.has(key) || !activeRegions(records.get(key).planet).length) return;
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.className = 'hd-region-dialog';
            dialog.setAttribute('aria-labelledby', 'hd-region-dialog-title');
            dialog.innerHTML = '<header><h2 id="hd-region-dialog-title">Regiões</h2><button type="button" data-region-close aria-label="Fechar regiões">✕</button></header><div data-region-content></div>';
            document.body.append(dialog);
            dialog.querySelector('[data-region-close]').addEventListener('click', close);
            dialog.addEventListener('click', e => {
                if (e.target !== dialog) return;
                const r = dialog.getBoundingClientRect();
                if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
            });
            dialog.addEventListener('close', () => { activeKey = null; if (opener?.isConnected) opener.focus({preventScroll:true}); });
        }
        activeKey = key; opener = button; paint();
        if (!dialog.open) dialog.showModal();
        dialog.querySelector('[data-region-close]').focus({preventScroll:true});
    }
    function render(planet, source = 'campaigns') {
        const rows = activeRegions(planet);
        const key = source + ':' + String(planet?.index ?? name(planet?.name));
        records.set(key, {planet, source});
        if (activeKey === key) paint();
        if (!rows.length) return '';
        return `<button type="button" class="hd-region-trigger" data-region-key="${escape(key)}" aria-haspopup="dialog">Ver regiões <span>${rows.length}</span></button>`;
    }
    // Captura antes dos cartões clicáveis, inclusive das cópias nos objetivos da Ordem.
    document.addEventListener('click', e => {
        const button = e.target.closest?.('[data-region-key]');
        if (!button) return;
        e.preventDefault(); e.stopImmediatePropagation();
        open(button.dataset.regionKey, button);
    }, true);
    document.addEventListener('keydown', e => {
        if (dialog?.open && e.key === 'Escape') {
            e.preventDefault(); e.stopImmediatePropagation(); close(); return;
        }
        const button = e.target.closest?.('[data-region-key]');
        if (button && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault(); e.stopImmediatePropagation(); open(button.dataset.regionKey, button);
        }
    }, true);
    window.HDBRRegions = Object.freeze({normalize, render});
})();
