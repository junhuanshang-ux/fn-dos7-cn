// 把 src-tauri/app.config.json 里的应用名写入各移动端工程的资源文件。
//
// tauri 生成的应用名取自 productName（必须是 ASCII，且用于产物文件名），
// 这里用真实名称覆盖，因此支持中文名。Android 与 iOS 共用这一份逻辑。
//
// 用法: node scripts/apply-app-name.mjs

import { readFile, writeFile, access, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// XML 里的特殊字符需要转义；双引号会破坏字符串字面量，直接去掉
function escapeXml(value) {
  return String(value ?? '')
    .replace(/"/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 按文件名递归查找
async function findFiles(dir, name, out = []) {
  if (!(await exists(dir))) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await findFiles(full, name, out);
    else if (entry.name === name) out.push(full);
  }
  return out;
}

async function patchAndroid(name) {
  const file = resolve(
    ROOT,
    'src-tauri', 'gen', 'android',
    'app', 'src', 'main', 'res', 'values', 'strings.xml',
  );
  if (!(await exists(file))) return null;

  const xml = await readFile(file, 'utf8');
  const patched = xml.replace(
    /(<string name="(?:app_name|main_activity_title)">)[\s\S]*?(<\/string>)/g,
    `$1"${escapeXml(name)}"$2`,
  );
  if (patched === xml) return 'unchanged';

  await writeFile(file, patched, 'utf8');
  return file;
}

async function patchIos(name) {
  const files = await findFiles(resolve(ROOT, 'src-tauri', 'gen', 'apple'), 'Info.plist');
  if (!files.length) return null;

  const changed = [];
  for (const file of files) {
    const xml = await readFile(file, 'utf8');
    const patched = xml.replace(
      /(<key>CFBundleDisplayName<\/key>\s*<string>)[\s\S]*?(<\/string>)/,
      `$1${escapeXml(name)}$2`,
    );
    if (patched === xml) continue;
    await writeFile(file, patched, 'utf8');
    changed.push(file);
  }
  return changed.length ? changed : 'unchanged';
}

const { name } = JSON.parse(await readFile(resolve(ROOT, 'src-tauri', 'app.config.json'), 'utf8'));

const android = await patchAndroid(name);
const ios = await patchIos(name);

if (android === null && ios === null) {
  console.log('未找到 Android / iOS 工程，跳过（请先执行 tauri android init 或 tauri ios init）');
  process.exit(0);
}

if (android === 'unchanged' && (ios === 'unchanged' || ios === null)) {
  console.log(`应用名已是 "${name}"，无需修改`);
  process.exit(0);
}

console.log(`应用名已设置为 "${name}"`);
