import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  for (const file of fs.globSync(path.join(__dirname, '../dist/*'))) {
    fs.rmSync(file, { force: true, recursive: true });
  }
  for (const file of fs.globSync(path.join(__dirname, '../example/*.{mjs,css,map}'))) {
    fs.rmSync(file, { force: true });
  }
} catch (error) {
  console.log(error);
}
