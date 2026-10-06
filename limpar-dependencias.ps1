# Execute na raiz do projeto. Remove apenas do controle do Git; mantém os arquivos no PC.
$ErrorActionPreference = 'Stop'
if (-not (Test-Path '.git')) { throw 'Abra o PowerShell na pasta clonada do HELLDIVERS-BR.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Abra pelo Git Shell do GitHub Desktop para disponibilizar o comando git.' }
git rm -r --cached --ignore-unmatch -- central-api/node_modules
if ($LASTEXITCODE -ne 0) { throw 'A limpeza do índice falhou. Nenhum commit foi feito.' }
Write-Host 'Dependências preservadas no PC e removidas do índice. Faça o commit pelo GitHub Desktop junto com o patch.'
