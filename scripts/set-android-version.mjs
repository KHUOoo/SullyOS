import fs from 'node:fs';
import path from 'node:path';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const input = String(process.argv[2] || `v${packageJson.version}`).trim();
const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(input);
if (!match) {
  throw new Error(`Invalid Android version "${input}". Expected vMAJOR.MINOR.PATCH.`);
}
const [, majorText, minorText, patchText] = match;
const major = Number(majorText);
const minor = Number(minorText);
const patch = Number(patchText);
if (minor > 99 || patch > 99) throw new Error('MINOR and PATCH must be between 0 and 99.');
const versionName = `${major}.${minor}.${patch}`;
const versionCode = major * 10000 + minor * 100 + patch;
const gradlePath = path.resolve('android/app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
fs.writeFileSync(gradlePath, gradle);
console.log(`Android version set to ${versionName} (${versionCode})`);
