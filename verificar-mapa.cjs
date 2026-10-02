const fs=require('fs'),crypto=require('crypto'),path=require('path');
const checks={"mapa-classico.html": ["fcec4b7495da35ac6cde312f9974d379b060c8588b2232d1db87b578b59c24d4", "3fe023667db2e62df9b7ea6b45809b3e054a171026343d64844c28dea35c3f58"], "mapa-classico.css": ["a01250cc4e2feaeec8e66453712e1a8dda8fcf59663243259bbace284c4048e1", "cdc0a92e509e893b41fe10bc0800b4e3fd801e9b4e8890757f3f5d4501d17869"], "mapa-classico.js": ["9731288eecb30312c92e925317d96feaab9ab43c781b80e22ac616416285a3a7", "5baebef278600be2b56dd896f85613407e29011ea79aca6c1d35d2c1b48c975b"]};
let failed=false;
for(const [name,accepted] of Object.entries(checks)){
 const file=path.join(process.cwd(),name);
 if(!fs.existsSync(file)){console.error('Falta: '+name);failed=true;continue;}
 const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').replace(/^\uFEFF/,'');
 const hash=crypto.createHash('sha256').update(text).digest('hex');
 if(!accepted.includes(hash)){console.error('Arquivo diferente da base revisada: '+name);failed=true;}
}
if(failed){console.error('Envie sua versão atual para comparação antes de substituir.');process.exitCode=1;}
else console.log('Base compatível. Copie somente os 3 arquivos do patch para a raiz.');
