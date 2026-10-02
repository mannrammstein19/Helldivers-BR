const fs=require('fs'),crypto=require('crypto'),path=require('path');
const checks={"mapa-classico.html": ["79435f69689eac646a4f13200fd5204c8e7d9b6dd659e2625383084d59d63660", "6d6c44eb1e44ad6830d407f571b7587334beb847e23814be1ac9225778864e78"], "mapa-classico.css": ["11c8ce36479e24239936a082d1752876b4c75e7cff432447a5a77ee3662a5f87", "df434c14b45f5bcbd1f3ea24fe9bd7e26805f835c2ab264356e9cc0cd0cd98b6"], "mapa-classico.js": ["25834cd6e8dda540c00817be601b454e2e511447816fd361347343405bb19b82", "6db814c2d2becc7d21a74bd89fa95bb80a68b9f47f912899d6086880f4e6dd9a"], "war-data.js": ["cfcc97a697438d0f3ad53b86ba86023af8da81214eaef9c1d74daf7893d218d7", "1caaede863028fc6cb7530a7c544e58f4ff80937d78088e3dab62255211ce4c7"]};
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
