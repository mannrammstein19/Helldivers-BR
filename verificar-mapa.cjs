const fs=require('fs'),crypto=require('crypto'),path=require('path');
const checks={"mapa-classico.html": ["72f424577b6642afb563d84a65531468b912e657253c4996bb3a90fb8cf24340", "79435f69689eac646a4f13200fd5204c8e7d9b6dd659e2625383084d59d63660"], "mapa-classico.css": ["c50d2b129b9627cb9126dc7aaf6cfa0ae090c66d0cae1418af8845a835b5edfd", "11c8ce36479e24239936a082d1752876b4c75e7cff432447a5a77ee3662a5f87"], "mapa-classico.js": ["678557fcc6cf5d3116a38c53f27ec406057382881c9a2d44554d6b1df41bc2fa", "25834cd6e8dda540c00817be601b454e2e511447816fd361347343405bb19b82"], "planet-regions.css": ["c10f4136e852d47c7478e11702702a62cf2a784940135e9754059dfbab6461f5", "cd2310f8d6b401e9fd2e08cd2db18a5a57f78c16fbf8853436b1f4109b518767"]};
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
