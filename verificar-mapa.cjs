const fs=require('fs'),crypto=require('crypto'),path=require('path');
const checks={"mapa-classico.html": ["3fe023667db2e62df9b7ea6b45809b3e054a171026343d64844c28dea35c3f58", "ab73a22948d25aeb5522e6c853353b6d5db8b56d48a840a6a71c3d93cb40a04e"], "mapa-classico.css": ["cdc0a92e509e893b41fe10bc0800b4e3fd801e9b4e8890757f3f5d4501d17869", "e9f4d014f26b05b93e3433fb7d4fed883c4b9cc0ce240eed584e199867fa3089"], "mapa-classico.js": ["5baebef278600be2b56dd896f85613407e29011ea79aca6c1d35d2c1b48c975b", "4f63bd32f89ce8cdb170017f698cab4c9fbb1077fce6b85d5d9eb29c9cf1442e"], "central-api/normalize.mjs": ["6eb5b5f60a27f02b82b1bb28ca99b1fea29f0cd0cb7fc709d8ac09f5ec5ddff5", "a869b3bae7ea14028f180125b58c1c5af16f76ff243f5a995228a67b7c865761"]};
let failed=false;
for(const [name,accepted] of Object.entries(checks)){
 const file=path.join(process.cwd(),name);
 if(!fs.existsSync(file)){console.error('Falta: '+name);failed=true;continue;}
 const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').replace(/^\uFEFF/,'');
 const hash=crypto.createHash('sha256').update(text).digest('hex');
 if(!accepted.includes(hash)){console.error('Arquivo diferente da base revisada: '+name);failed=true;}
}
if(failed){console.error('Envie sua versão atual para comparação antes de substituir.');process.exitCode=1;}
else console.log('Base compatível. Copie os arquivos do patch respeitando a pasta central-api.');
