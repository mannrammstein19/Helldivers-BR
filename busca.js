// busca.js - Lógica de busca compartilhada da Wiki Helldivers-BR
// Este arquivo cuida de: ler os dados (dados.js / warbonds.js), filtrar
// pelo que foi digitado, e montar os links/ícones dos resultados.
//
// O "rootPath" é descoberto automaticamente olhando de onde o dados.js
// foi carregado NESTA página. Assim o mesmo busca.js funciona em
// qualquer página, offline ou já publicada no GitHub Pages, sem precisar
// editar nada por página.
//   <script src="dados.js">     (na home)      -> rootPath = ""
//   <script src="../dados.js">  (1 pasta funda) -> rootPath = "../"
//   <script src="../../dados.js"> (2 pastas)    -> rootPath = "../../"

document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("wiki-search");
    const dropdown = document.getElementById("search-results");

    if (!searchInput || !dropdown) return;

    const dadosScript = document.querySelector('script[src$="dados.js"]');
    const rootPath = dadosScript
        ? dadosScript.getAttribute("src").replace(/dados\.js$/, "")
        : "";

    searchInput.addEventListener("input", function () {
        const query = this.value.toLowerCase().trim();
        dropdown.innerHTML = "";

        if (!query) {
            dropdown.style.display = "none";
            return;
        }

        const dadosGerais = typeof searchData !== 'undefined' ? searchData : [];
        const dadosWarbonds = typeof warbondsData !== 'undefined' ? warbondsData : [];
        const bancoDeDadosCompleto = [...dadosGerais, ...dadosWarbonds];

        if (bancoDeDadosCompleto.length === 0) {
            dropdown.innerHTML = `
                <div style="padding:12px;color:#ff7b00;">
                    ⚠️ Erro de Conexão com a Super Terra: Nenhum banco de dados foi carregado.
                </div>`;
            dropdown.style.display = "block";
            return;
        }

        const results = bancoDeDadosCompleto.filter(item =>
            item.title.toLowerCase().includes(query)
        );

        if (results.length === 0) {
            dropdown.innerHTML = `
                <div style="padding:12px;color:#ff7b00;">
                    ⚠️ Nenhum resultado encontrado
                </div>`;
            dropdown.style.display = "block";
            return;
        }

        results.forEach(item => {
            const result = document.createElement("a");
            result.className = "search-item";
            result.href = rootPath + item.url;

            result.innerHTML = `
                <div class="search-item-icon">
                    <img src="${rootPath + item.icon}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='${rootPath}imagens/0-banners/logo.jpg'">
                </div>
                <div>
                    <strong style="color: var(--hd-yellow);">${item.title}</strong><br>
                    <small style="color: #aaa;">${item.category}</small>
                </div>
            `;
            dropdown.appendChild(result);
        });

        dropdown.style.display = "block";
    });

    document.addEventListener("click", function (e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = "none";
        }
    });
});