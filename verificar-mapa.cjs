const fs=require('fs'),crypto=require('crypto'),path=require('path');
const checks={"mapa-classico.html": ["ab73a22948d25aeb5522e6c853353b6d5db8b56d48a840a6a71c3d93cb40a04e", "4388c3169e40d3a226cf81e3186758420f1b4485c108aa34fb799de88618bfc5"], "mapa-classico.css": ["e9f4d014f26b05b93e3433fb7d4fed883c4b9cc0ce240eed584e199867fa3089", "f9008247957a9af1531aef6b0a7c7e73a1d9fb39c44702f0c5e8bdf73305b540"], "mapa-classico.js": ["4f63bd32f89ce8cdb170017f698cab4c9fbb1077fce6b85d5d9eb29c9cf1442e", "89f391aba7e54b32aaa3c172c9dece7578d132ca83fce3962c39bb285e337950"], "guerra.html": ["ff4a97d39ff796d5c4de2ccea6c5f58eec8d43ec4e6a1c08f0f1f18b3aebe393", "afc2960684082da06b7df183d3dbfaeed3cea0727cee7aa2a8141341f3c1c70c"], "guerra.js": ["10a37f83b048282f697e1a5eabd6e8e800c5dc22128b29f0e2b8da6587ca64d4", "bfa10f30740a669e91e834ce40ab88f1764c789bd7384c639548f5aa0984d94e"]};
let failed=false;
for(const [name,accepted] of Object.entries(checks)){
 const file=path.join(process.cwd(),name);
 if(!fs.existsSync(file)){console.error('Falta: '+name);failed=true;continue;}
 const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').replace(/^\uFEFF/,'');
 const hash=crypto.createHash('sha256').update(text).digest('hex');
 if(!accepted.includes(hash)){console.error('Arquivo diferente da base revisada: '+name);failed=true;}
}
if(failed){console.error('Envie os arquivos indicados para comparação antes de substituir.');process.exitCode=1;}
else console.log('Base compatível. Copie os seis arquivos do site indicados em LEIA-PRIMEIRO.txt.');
