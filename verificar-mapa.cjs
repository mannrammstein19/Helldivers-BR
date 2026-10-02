const fs=require('fs'),crypto=require('crypto'),path=require('path');
const checks={"mapa-classico.html": ["6549a825055705eec6abdec3a23a25df8326e1f9f8bead096e8fb32488323006", "72f424577b6642afb563d84a65531468b912e657253c4996bb3a90fb8cf24340"], "mapa-classico.css": ["528548e040e00a73e41e4c3fbffed4efd24308b58e1156e951cfd07f973b4f4e", "c50d2b129b9627cb9126dc7aaf6cfa0ae090c66d0cae1418af8845a835b5edfd"], "mapa-classico.js": ["381514701ba3bdcfd2272a2258180a933367a7d28b4352d797b527dd2190d3d3", "678557fcc6cf5d3116a38c53f27ec406057382881c9a2d44554d6b1df41bc2fa"], "planet-regions.css": ["c18ee0427f79f70755558ae22ad8031f1d1253b12737b3e40649b5c06c56de97", "c10f4136e852d47c7478e11702702a62cf2a784940135e9754059dfbab6461f5"]};
let failed=false;
for(const [name,accepted] of Object.entries(checks)){
 const file=path.join(process.cwd(),name);
 if(!fs.existsSync(file)){console.error('Falta: '+name);failed=true;continue;}
 const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').replace(/^\uFEFF/,'');
 const hash=crypto.createHash('sha256').update(text).digest('hex');
 if(!accepted.includes(hash)){console.error('Arquivo diferente da base revisada: '+name);failed=true;}
}
if(failed){console.error('Envie sua versão atual para comparação antes de substituir.');process.exitCode=1;}
else console.log('Base compatível. Copie somente os 4 arquivos do patch para a raiz.');
