import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const files=['src','tests','tools'].flatMap(dir=>fs.readdirSync(dir).filter(x=>/\.(m?js)$/.test(x)).map(x=>`${dir}/${x}`));
for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
console.log(`Syntax checked ${files.length} JavaScript files; no browser or server started.`);
