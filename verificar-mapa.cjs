const fs=require('fs'),crypto=require('crypto'),path=require('path');
const checks={"mapa-classico.html": ["6bffca09a91855bb502adc39b44137326ec940cc03feb9e06d69f7bb7bd02cdb", "6549a825055705eec6abdec3a23a25df8326e1f9f8bead096e8fb32488323006"], "mapa-classico.css": ["7fe9089498f8536b91f052c44534d5527447f331c315838954efd8fd9e59c558", "528548e040e00a73e41e4c3fbffed4efd24308b58e1156e951cfd07f973b4f4e"], "mapa-classico.js": ["0f916d227b5ccffb3a4c5b3f5936d8ffa7b2e1cdfa93af8fd800470ad5632d78", "381514701ba3bdcfd2272a2258180a933367a7d28b4352d797b527dd2190d3d3"], "war-data.js": ["3f8ca6cfd8b8cc45094ebc877f17b9ec9419a8731b5976f4aa989f859cf51b2c", "cfcc97a697438d0f3ad53b86ba86023af8da81214eaef9c1d74daf7893d218d7"], "planet-regions.js": ["4dae67b8fc63e211b63d65c4cae47bbcf1e4728508e4b5ad6edcaa45761b8c49", "a59d5318e91c4c0ca61a1efca0f36a09842bbede05989312414d3995cfd1f05d"], "planet-regions.css": ["c11e4f7f46188984b4714d71aa58af5ba2b1b35857409b7db71683248dd28127", "c18ee0427f79f70755558ae22ad8031f1d1253b12737b3e40649b5c06c56de97"]};
let failed=false;
for(const [name,accepted] of Object.entries(checks)){
 const file=path.join(process.cwd(),name);
 if(!fs.existsSync(file)){console.error('Falta: '+name);failed=true;continue;}
 const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').replace(/^\uFEFF/,'');
 const hash=crypto.createHash('sha256').update(text).digest('hex');
 if(!accepted.includes(hash)){console.error('Arquivo diferente da base revisada: '+name);failed=true;}
}
if(failed){console.error('Envie sua versão atual para comparação antes de substituir.');process.exitCode=1;}
else console.log('Base compatível. Copie os 6 arquivos e a pasta imagens/regioes do patch.');
