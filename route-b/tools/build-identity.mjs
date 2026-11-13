import fs from 'node:fs';import crypto from 'node:crypto';
const paths=['src/dated-events.mjs','src/dated-contract.js','src/dated-ui.js','src/dated-ui.en.js','src/dated-errors.js','src/engine.js','src/fixture.js','src/np-interface.js','src/research.js','src/app.js','src/recovery.js','src/i18n.js','src/ui-static.en.js','src/ui-dynamic.en.js','src/research.en.js','styles.css','index.html'];
const hashes=Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const build={version:'0.1.6-dated-ui-r2',engineSha256:hashes['src/engine.js'],sourceHashes:hashes,generatedAt:new Date().toISOString(),verification:'Content identity only; not an execution attestation or scientific validation'};
fs.writeFileSync('src/build.generated.js',`export const BUILD=${JSON.stringify(build,null,2)};\n`);fs.writeFileSync('deliverables/build-identity.json',JSON.stringify(build,null,2)+'\n');console.log('Generated local source identity; no network action.');
