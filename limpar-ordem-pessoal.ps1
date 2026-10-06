$ErrorActionPreference = 'Stop'
$repoPath = $PSScriptRoot
foreach ($page in @('index.html', 'guerra.html')) {
    $pagePath = Join-Path $repoPath $page
    if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
        throw 'Copie este script e os arquivos de Patch para a raiz do projeto antes de executar.'
    }
    if ([System.IO.File]::ReadAllText($pagePath).Contains('personal-order')) {
        throw 'Primeiro substitua index.html e guerra.html pelos arquivos de Patch.'
    }
}
$files = @('personal-order.css', 'personal-order.js', 'dados/personal-order.json', 'verificacao/personal-order.cjs', 'LEIA-ME-ORDEM-PESSOAL.md')
foreach ($name in $files) {
    $filePath = Join-Path $repoPath $name
    if (Test-Path -LiteralPath $filePath -PathType Leaf) {
        Remove-Item -LiteralPath $filePath
        Write-Host "Removido: $name"
    }
}
Write-Host 'Limpeza concluida. Pode apagar este script e publicar as alteracoes pelo GitHub.'
