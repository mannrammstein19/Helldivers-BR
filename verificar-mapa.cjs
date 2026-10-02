const fs=require('fs'),crypto=require('crypto'),path=require('path');
const checks={"mapa-classico.html": ["6d6c44eb1e44ad6830d407f571b7587334beb847e23814be1ac9225778864e78", "fcec4b7495da35ac6cde312f9974d379b060c8588b2232d1db87b578b59c24d4"], "mapa-classico.css": ["df434c14b45f5bcbd1f3ea24fe9bd7e26805f835c2ab264356e9cc0cd0cd98b6", "a01250cc4e2feaeec8e66453712e1a8dda8fcf59663243259bbace284c4048e1"], "mapa-classico.js": ["6db814c2d2becc7d21a74bd89fa95bb80a68b9f47f912899d6086880f4e6dd9a", "9731288eecb30312c92e925317d96feaab9ab43c781b80e22ac616416285a3a7"]};
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
