import 'server-only';
import path from 'node:path';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

export function uploadRoot() {
  const configured = process.env.UPLOAD_DIR;
  if (configured) return path.resolve(/* turbopackIgnore: true */ configured);
  return path.join(process.cwd(), 'data', 'uploads');
}

function resolveObjectKey(objectKey: string) {
  const root = uploadRoot();
  const target = path.resolve(root, ...objectKey.split('/'));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid storage key.');
  return target;
}

export async function writeStoredFile(objectKey: string, value: Uint8Array) {
  const target = resolveObjectKey(objectKey);
  await mkdir(path.dirname(target), {recursive: true});
  await writeFile(target, value, {flag:'wx'});
}

export async function readStoredFile(objectKey: string) {
  return readFile(resolveObjectKey(objectKey));
}

export async function deleteStoredFile(objectKey: string) {
  await rm(resolveObjectKey(objectKey), {force: true});
}
