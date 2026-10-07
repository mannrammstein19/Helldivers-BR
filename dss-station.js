/* DSS: apresentação local. Nenhuma consulta de rede ou contribuição é feita aqui. */
window.HDBRDssStation = (() => {
    'use strict';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const assets = 'imagens/guerra/dss/';
    const actions = {
        '4091660627': {name:'Tempestade da Águia', icon:'EAGLE STORM.png', description:'Ataques de gás Águia durante as missões. Retarda o avanço inimigo em campanhas de defesa.', emphasis:['Ataques de gás Águia','campanhas de defesa'], detail:'A DSS mantém uma frota rotativa de caças Águia em operação durante 24 horas, apoiando os Helldivers no planeta com suporte aéreo e retardando as ofensivas inimigas.'},
        '3248573007': {name:'Bloqueio Orbital', icon:'ORBITAL BLOCKADE.png', description:'Campanhas de defesa não podem ser originadas deste planeta. O impulsor de Otimização Espacial Hellpod fica ativo para todas as missões.', emphasis:['Campanhas de defesa','Otimização Espacial Hellpod'], detail:'A DSS intercepta grandes naves inimigas que tentam deixar a atmosfera e oferece suporte logístico aos Super Destroyers.'},
        '3578080409': {name:'Distribuição de Artilharia Pesada', icon:'HEAVY ORDNANCE DISTRIBUTION.png', description:'Concede acesso à Barragem Orbital de Alto Explosivo de 380 mm durante as missões. Acelera o progresso nas campanhas de libertação.', emphasis:['Barragem Orbital de Alto Explosivo de 380 mm','campanhas de libertação'], detail:'A frota logística da DSS fornece munição de 380 mm aos Super Destroyers e apoio de artilharia às operações da SEAF.'}
    };
    // IDs de itens do catálogo helldivers-2/json/items/item_names.json.
    const resources = {
        '3992382197': {name:'Amostra comum', icon:'common-sample.svg'},
        '3608481516': {name:'Nota de requisição', icon:'../../ui/icons/Requisition_Slip.svg'},
        '2985106497': {name:'Amostra rara', icon:'rare-sample.svg'}
    };
    const numeric = value => value === null || value === undefined || value === '' || typeof value === 'boolean' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
    function date(value) {
        if(value === null || value === undefined || value === '') return null;
        const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
        return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    function clock(meta, now = Date.now()) {
        const time = numeric(meta?.time);
        const live = !!time && time <= now + 60000 && now - time <= 300000 && meta?.stale === false;
        return {live, time:live ? now : time && time <= now + 60000 ? Math.min(time, now) : null};
    }
    function duration(seconds) {
        if(!Number.isFinite(seconds)) return 'Não informado';
        seconds = Math.max(0, Math.floor(seconds));
        const d=Math.floor(seconds/86400), h=Math.floor(seconds%86400/3600), m=Math.floor(seconds%3600/60), s=seconds%60;
        return `${d ? d+'d ' : ''}${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}min ${String(s).padStart(2,'0')}s`;
    }
    function actionState(action, at) {
        const status=numeric(action?.status), raw=String(action?.statusName || action?.state || action?.statusText || action?.status || '').toLowerCase();
        const rawEnd=action?.statusExpire ?? action?.statusExpiresAt ?? action?.statusExpiration;
        const end=date(rawEnd);
        const active=status===2 || /\b(active|ativa|activated|ativada)\b/.test(raw);
        if(active && (at === null || (rawEnd && end === null) || (end !== null && end <= at))) return {kind:'pending',label:'Aguardando atualização',end:null};
        if(active) return {kind:'active',label:'Ativa',end};
        if(status===3 || /cooldown|recharg|recarreg/.test(raw)) {
            if(at === null || end === null || end <= at) return {kind:'pending',label:'Aguardando atualização',end:null};
            return {kind:'cooldown',label:'Recarregando',end};
        }
        if(status===1 || /funding|preparando/.test(raw)) return {kind:'funding',label:'Preparando',end:null};
        if(status===0 || /inactive|unavailable|desativ|indispon/.test(raw)) return {kind:'offline',label:'Indisponível',end:null};
        return {kind:'pending',label:'Estado não informado',end:null};
    }
    // Somente trechos do catálogo local recebem marcação; o texto externo continua escapado.
    function descriptionHTML(info) {
        if(!info) return 'Detalhes não informados em português.';
        let html=escape(info.description);
        for(const term of info.emphasis || []) html=html.replace(escape(term), '<mark class="dss-keyword">'+escape(term)+'</mark>');
        return html;
    }
    function costMetrics(cost) {
        const current=numeric(cost?.currentValue), target=numeric(cost?.targetValue), delta=numeric(cost?.deltaPerSecond);
        const valid=current!==null && current>=0 && target!==null && target>0;
        const pct=valid ? Math.min(100,current/target*100) : null;
        return {pct, seconds:valid && delta!==null && delta>0 ? Math.max(0,target-current)/delta : null};
    }
    function countdown(end, reading, prefix) {
        if(end===null || reading.time===null) return '<span>Prazo não informado</span>';
        if(end<=reading.time) return '<span>Aguardando atualização</span>';
        return `<span data-dss-deadline="${end}" data-dss-prefix="${escape(prefix)}">${escape(prefix+duration((end-reading.time)/1000))}</span>`;
    }
    function costHTML(cost, reading) {
        const m=costMetrics(cost), id=String(cost?.itemMixId ?? '');
        const resource=resources[id];
        const icon=resource ? `<img src="${escape(assets+resource.icon)}" alt="${escape(resource.name)}" title="${escape(resource.name)}">` : '<span title="Recurso não identificado">?</span>';
        const percentage=m.pct===null ? '—' : new Intl.NumberFormat('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}).format(m.pct)+'%';
        return `<div class="dss-funding-panel"><div class="dss-funding-row"><div class="dss-funding-track" role="progressbar" aria-label="${escape(resource?.name || 'Contribuição')}" ${m.pct===null?'':'aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+m.pct+'"'}><i style="width:${m.pct ?? 0}%"></i></div><span class="dss-resource">${icon}<b>${percentage}</b></span></div><p class="dss-estimate">${m.seconds===null ? 'Estimativa indisponível' : (reading.live ? 'Disponibilidade estimada: ' : 'Estimativa na última leitura: ')+duration(m.seconds)}</p></div>`;
    }
    function render(station, planet, options = {}) {
        const reading=clock(options.meta,options.now ?? Date.now());
        const owner=String(planet?.currentOwner || '');
        const color=/automaton/i.test(owner)?'#ff535b':/terminid/i.test(owner)?'#ffad32':/illuminate/i.test(owner)?'#d575ff':'#51b7ef';
        const factionIcon=/automaton/i.test(owner)?'imagens/guerra/faccoes/logo automatons.png':/terminid/i.test(owner)?'imagens/guerra/faccoes/logo terminids.png':/illuminate/i.test(owner)?'imagens/guerra/faccoes/logo illuminats.png':'imagens/ui/icons/logo super terra.svg';
        const name=options.name || planet?.name || 'Localização não informada';
        const sector=planet?.sector || 'Setor não informado';
        const election=date(station?.electionEnd);
        const priority=['3578080409','3248573007','4091660627'];
        const list=Array.isArray(station?.tacticalActions)?[...station.tacticalActions].sort((a,b)=>(priority.indexOf(String(a.id32))<0?99:priority.indexOf(String(a.id32)))-(priority.indexOf(String(b.id32))<0?99:priority.indexOf(String(b.id32)))):[];
        const notices=reading.live?'':`<div class="dss-reading-note">Última leitura${reading.time ? ' · '+escape(new Date(reading.time).toLocaleString('pt-BR')) : ''} · situação atual sem confirmação</div>`;
        const landscape=options.image ? `<img class="dss-landscape" src="${escape(options.image)}" alt="Paisagem de ${escape(name)}" decoding="async" onerror="this.hidden=true">` : '';
        return `<div class="dss-station" style="--dss-owner:${color}"><header class="dss-location"><img class="dss-location-faction" src="${escape(factionIcon)}" alt="" onerror="this.hidden=true"><div><h3>${escape(name)}</h3><p>${escape(sector)}</p></div><img src="${assets}DSS_Summary_Model.png" alt="Estação Espacial da Democracia"></header><div class="dss-landscape-frame">${landscape}</div><div class="dss-jump"><strong title="Prazo de encerramento da votação; a transferência depende do jogo">Próximo salto <small>fim da votação</small></strong>${countdown(election,reading,'')}${!reading.live?' <small>na última leitura</small>':''}</div>${notices}<div class="dss-tactical-list">${list.map(action=>{
            const info=actions[String(action.id32)];
            const label=info?.name || String(action.name || 'Ação tática');
            const state=actionState(action,reading.time);
            const costs=Array.isArray(action.costs)?action.costs:[];
            return `<article class="dss-tactical dss-tactical-${state.kind}${reading.live && state.kind==='active' ? ' dss-confirmed-active' : ''}"><h4>${escape(label)}</h4><div class="dss-tactical-body"><p>${descriptionHTML(info)}</p>${info?`<img src="${escape(assets+info.icon)}" alt="" class="dss-tactical-icon">`:''}</div>${state.kind==='active'?`<p class="dss-active-description">${escape(info?.detail || 'Ação informada como ativa nesta leitura.')}</p><div class="dss-active-duration">${countdown(state.end,reading,reading.live?'Ativa por: ':'Ativa na última leitura · ' )}</div>`:`<div class="dss-tactical-state">${escape(state.label)}</div>${state.kind==='cooldown'?`<div class="dss-cooldown-duration">${countdown(state.end,reading,reading.live?'Disponível novamente em: ':'Recarga na última leitura · ')}</div>`:''}${state.kind==='funding'?costs.map(cost=>costHTML(cost,reading)).join(''):''}`}</article>`;
        }).join('') || '<p class="dss-reading-note">Nenhuma ação tática informada nesta leitura.</p>'}</div></div>`;
    }
    function tick(root, meta, now=Date.now()) {
        const reading=clock(meta,now);
        if(!reading.live) {
            root?.querySelectorAll('.dss-confirmed-active').forEach(card=>card.classList.remove('dss-confirmed-active'));
            const station=root?.querySelector('.dss-station');
            if(station && !station.querySelector('.dss-reading-note')) {
                const note=document.createElement('div');
                note.className='dss-reading-note';
                note.textContent='Última leitura · situação atual sem confirmação';
                station.querySelector('.dss-jump')?.after(note);
            }
        }
        root?.querySelectorAll('[data-dss-deadline]').forEach(node=>{
            const end=Number(node.dataset.dssDeadline);
            const at=reading.time;
            node.textContent=at===null?'Prazo não informado':end<=at?'Aguardando atualização':(reading.live?'':'Última leitura · ')+node.dataset.dssPrefix+duration((end-at)/1000);
            if(reading.live && end<=now) {
                const card=node.closest('.dss-tactical-active');
                card?.classList.remove('dss-confirmed-active');
                card?.classList.replace('dss-tactical-active','dss-tactical-pending');
                const cooldown=node.closest('.dss-tactical-cooldown');
                cooldown?.classList.replace('dss-tactical-cooldown','dss-tactical-pending');
                const label=cooldown?.querySelector('.dss-tactical-state');
                if(label) label.textContent='Aguardando atualização';
            }
        });
    }
    return {render,tick,clock,duration,actionState,costMetrics};
})();
