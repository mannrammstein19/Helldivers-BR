#!/usr/bin/env python3
# Somente leitura. Aceita a base enviada ou os arquivos já corrigidos.
import hashlib,json,sys
from pathlib import Path
CHECKS = {'guerra.html': ['0c6092581f0da2d2bbe11d06e40a6edbb7f2b4c533f5f0757028044055bab18e', 'ff4a97d39ff796d5c4de2ccea6c5f58eec8d43ec4e6a1c08f0f1f18b3aebe393'], 'index.html': ['df7dfc26507d3203da9b1e0d4a0271e0c8336ad4207634c09ec23a36e24a3680', 'b006debd331b5360f62c0f397cb7eebb97d7faf73fa18ed848312a9dcd622718'], 'mapa-classico.html': ['aa20efa6cfe37b2f0f7748d534ff52673400706346b5924c2865ce0ad5ebfb9a', '33e4de0dd40fa4e7669829f5961bbd9a801511182023bcf9352a2bee0c840394'], 'mapa-classico.js': ['a3d2184798fd7f5fa6f1cb2d5c0155a3767c0c1b7b87a540514aac5399176524', '239f92e34bb4ac0b51ced621b7477e695919efd43de8fdeec834dd0e55b86a1c'], 'ordem.html': ['0ac92235d004df68ad95b8c09cf14d8da031d1314f5a4c5a5bb6d0123c06a496', '78e82339f89ef27c030f43e66c1858128b6582616746543eae54e29973d3caed'], 'planet-regions.js': ['e8fe0291aa463a6d1e2bc48b30bc69840c5ca54e8e90cd9a6a4b2e0f0131cdb2', '4dae67b8fc63e211b63d65c4cae47bbcf1e4728508e4b5ad6edcaa45761b8c49'], 'war-data.js': ['43ef8c2bfbcf5f13ed7bc15f40f89ff17d33fddc6ae980589e9e593a76c44d02', '3f8ca6cfd8b8cc45094ebc877f17b9ec9419a8731b5976f4aa989f859cf51b2c'], 'guerra.js': ['02f0387e8313640417a767cd448a2092467ae99baf23d221a3a7d286221f229c'], 'overview.js': ['df67798f76dd893302cecdacae5d3c92ca5d52b533892d62fd5db1fecc1ec5b1'], 'order-state.js': ['f7f3184914ef6c02cc36e6ca45466ae4202cc4b5782d179a61705183dad9f41b'], 'order-targets.js': ['4df15cd904006782ad8540afadf965372d79e2736408fce93f58c661168504f6'], 'sw.js': ['aa8d469095ff8fd6fd8a6f562c00754b0314471bd8c2a528f2d97970d20cd56a'], 'aplicativos-downloads.json': ['bca01c48d5f7871cb5f20fba86bfd4ca1d195a130bc912f478b37fbbc4de8901'], 'style.css': ['7c85012d012e0e9405626d7148d6240eacef022cf7558a064190b6f66f8177c3'], 'mapa-classico.css': ['b53e0d15dca6f8011c2634a03ab9bb178c7c27f34bfb33097f3e9c7e7b5d6bca']}
root=Path(sys.argv[1] if len(sys.argv)>1 else '.')
errors=[]
for name,allowed in CHECKS.items():
 p=root/name
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest() not in allowed: errors.append(name)
if errors:
 print('Base diferente do ZIP revisado. Confira antes de substituir:')
 print('\n'.join(errors));sys.exit(1)
print('Base compatível com este patch. Nenhum arquivo foi modificado.')
