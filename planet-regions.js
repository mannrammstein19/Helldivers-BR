/* Regiões planetárias: somente leitura. Não altera planeta, ordem ou bônus. */
(() => {
    'use strict';
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const number = value => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
    const name = value => {
        if (value && typeof value === 'object') value = value['pt-BR'] || value['en-US'] || Object.values(value).find(v => typeof v === 'string');
        return typeof value === 'string' && value.trim() && value.trim() !== 'null' ? value.trim() : '';
    };
    // Catálogo comunitário helldivers-2/json, planets/planetRegion.json (28/09/2026).
    // O hash identifica o tipo; o dono do planeta nunca escolhe o ícone.
    const regionTypes = Object.freeze({"324613052":"city","855833074":"city","559843220":"city","1578230839":"city","2762012044":"city","2634421583":"city","1872830438":"city","1978368732":"city","1411801971":"city","2368444431":"city","3106360883":"city","2547946895":"city","983151377":"city","3607786620":"city","3161124521":"city","1068743995":"city","1338066975":"city","3896987202":"city","755864726":"city","2258293610":"city","3006088005":"city","476417027":"city","1023474728":"city","2696938432":"city","1344426011":"city","4127238767":"city","2876102528":"city","1143862620":"city","1097134956":"city","1702672301":"city","2919580452":"city","2541292675":"city","2500124294":"city","2033316867":"city","2903117961":"city","3039275068":"city","2650088088":"city","4014866766":"city","321980142":"city","2143424881":"city","2895050350":"city","4099883014":"city","4237135854":"city","3510978126":"city","647996051":"city","1874705974":"city","799267053":"city","3885625492":"city","2659108161":"city","2185475541":"city","1322103873":"city","4132827034":"city","2544875580":"city","1761215575":"city","4204734822":"city","1725242014":"city","1028801816":"city","3634134154":"city","1762725992":"city","457233553":"city","4121418923":"city","400630653":"city","1017291850":"city","3028191212":"city","3841350324":"city","3647907388":"city","4051063223":"city","2332413862":"city","3568007842":"city","1032709433":"city","1161134727":"city","1178227778":"city","3116199682":"city","3175334400":"city","718092071":"city","2340207578":"factory","2577020579":"factory","1512842277":"factory","2634960640":"factory","3404329179":"factory","2735744233":"factory","1475859103":"factory","3380242454":"factory","1050611219":"city","2345167795":"city","2146650468":"city","2180989349":"city","1063822606":"city","3385219022":"city","741084747":"city","521454425":"city","2193235528":"city","1447639542":"city","1013683905":"city","1523836342":"city","3775882537":"city","2185109890":"city","1946203146":"city","997505218":"city","1193052974":"city","16522331":"city","167295516":"city","4275209727":"city","905823730":"city","1676064266":"city","523284406":"city","4039645448":"city","130236915":"city","3291554432":"city","2300130357":"factory","1235784042":"factory","3756959393":"factory","3732722501":"factory","1230494439":"factory","3603744514":"factory","3600431647":"factory","3216000044":"factory","3212687176":"factory","1881788943":"factory","1878476075":"factory","3495232119":"factory","4248413283":"factory","3311068219":"factory","1122447002":"factory","1415969325":"city","832046850":"city","2006541056":"city","2057457464":"city","189783404":"city","3342476592":"city","1759245992":"city","1791361107":"city","27836851":"city","3309151713":"city","2004207949":"city","2557369266":"city","3540948886":"city","991650372":"city","1239520232":"city","4059243365":"city","786534585":"city","1838126407":"city","3900513024":"city","4038285524":"city","3964263469":"city","3067104866":"city","2507971325":"city","2591044773":"city","1897395642":"city","3626214155":"city","3851016682":"city","1623710024":"city","1603459330":"city","3455957267":"city","1514913854":"city","451637988":"city","1002278606":"city","1479079406":"city","860486103":"city","314025568":"city","2391484056":"city","3185820932":"city","2232171610":"city","3194418120":"city","472831334":"city","874781515":"city","3491570579":"city","2519594311":"city","3212629027":"city","3184875338":"city","1654362284":"city","1168572634":"city","2719536576":"city","2689075072":"city","2751322458":"city","2741839635":"city","3188612954":"city","1329166626":"city","1039071856":"city","967684667":"city","1161514581":"city","1915702028":"city","3021776166":"city","119875523":"city","586167831":"city","3054618608":"city","3034375188":"city","786867005":"city","12564835":"city","2939223654":"city","3585703392":"city","1688960258":"city","2509774688":"city","1136017261":"city","4221006651":"city","484247622":"city","3066706899":"city","2293980636":"city","3179108272":"city","581000702":"city","3612551140":"city","1854961214":"city","2712707536":"city","945140203":"city","1101206164":"city","2007842501":"city","2581434266":"city","2418052824":"city","3710473299":"city","2095568588":"city","660742724":"city","3373033616":"city","4028778105":"city","1000010048":"city","2231267715":"city","1954581243":"city","1501066740":"city","829716394":"city","4162876257":"city","2187047436":"city","3368734830":"city","3677320822":"city","3421372928":"city","4087006817":"city","4065420956":"city","1820689153":"city","1119186435":"city","1199071894":"city","2853318855":"city","480136851":"city","176090569":"city","3513777986":"city","3910908375":"city","137264955":"city","2300653457":"city","2409136536":"city","3849073717":"city","2098963156":"city","1428185423":"city","697345425":"city","3895412065":"city","3553590218":"city","248027603":"city","3263317504":"city","4269009782":"city","867139136":"city","3625692119":"city","1062239247":"city","2140217517":"city","1058460461":"city","2519745557":"city","2252336577":"city","2298034348":"city","1653634596":"city","3342871593":"city","511490869":"city","2491531357":"city","2541809256":"city","3858818769":"city","2253802431":"city","481340922":"city","1121037205":"city","3550784979":"city","974467043":"city","1599927394":"city","2788606019":"city","539875676":"city","2024755529":"city","2190098981":"city","3950276676":"city","3687523144":"city","2592017616":"city","3283689576":"city","3493472115":"city","873089075":"city","3272102382":"city","3109135198":"city","2069832250":"city","4101984974":"city","2832454199":"city","1690681912":"city","1668618298":"city","622301006":"city","1068853940":"city","297388908":"city","706797536":"city","2184145680":"city","2126832849":"city","452138560":"city","1842220312":"city","2285651547":"city","3862302711":"city","3164536732":"city","1273177678":"city","3320001654":"city","2617273113":"city","1108939907":"city","3205582835":"city","1201038992":"city","334066640":"city","491224618":"city","2472296828":"city","3911522018":"city","1613437962":"city","3644870667":"city","521646997":"city","2849889311":"city","2106184075":"city","1543050297":"city","2130828005":"city","1701644792":"city","2727770200":"city","3042839498":"city","1447385649":"city","1289084629":"city","540250241":"city","1633627715":"city","502504685":"city","550918906":"city","1750980320":"city","3958784315":"city","4196558004":"city","1199462527":"city","391918492":"city","316170794":"city","3921926208":"city","281317935":"city","1562611653":"city","3839797397":"city","579852265":"city","1999301409":"city","4187567384":"city","687069999":"city","1123715107":"city","3924472281":"city","3263074211":"city","3090254958":"city","2936987719":"city","1468847276":"city","770916674":"city","3147829923":"city","1713282699":"city","438247765":"city","3363260441":"city","3036848565":"city","4253491601":"city","1061744043":"city","3878380748":"city","3130397378":"city","4151302370":"city","649934138":"city","873382628":"city","1365889454":"city","763067932":"city","1312916665":"city","4192092503":"city","468034602":"city","807761309":"city","4179557814":"city","1954453569":"city","1451291824":"city","311758306":"city","4264188855":"city","2563609963":"city","3455315905":"city","518148662":"city","2775422932":"city"});
    const assetBase = new URL('.', document.currentScript?.src || document.baseURI);
    function identity(region) {
        const type = regionTypes[String(region.hash)];
        if (!type) return null;
        const citySizes = {Settlement: 'Assentamento', Town: 'Vila', City: 'Cidade', MegaCity: 'Megacidade'};
        return {type, label: type === 'factory' ? 'Megafábrica' : (citySizes[region.size] || 'Metrópole'),
            icon: new URL('imagens/ui/' + (type === 'factory' ? 'Automaton_Megafactory_Icon.webp' : 'Megacity_Icon.webp'), assetBase).href};
    }
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
            return {identity: identity(r), name: name(r.name) || `Região ${i + 1}`, percent, state, available: r.isAvailable === true,
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
                ${r.identity ? `<div class="hd-region-kind"><img src="${escape(r.identity.icon)}" width="30" height="30" alt="" loading="lazy"><span>${escape(r.identity.label)}</span></div>` : ''}
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
