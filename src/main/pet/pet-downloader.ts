import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const MANIFEST_URL = 'https://petdex.crafter.run/api/manifest';

export interface PetManifestEntry {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  spritesheetUrl: string;
  petJsonUrl: string;
  zipUrl: string;
  kind: string;
  vibes: string[];
  tags: string[];
  dominantColor: string;
}

function getPetsDir(): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  return path.join(homeDir, '.petdex-cc', 'pets');
}

export function getLocalPets(): string[] {
  const petsDir = getPetsDir();
  try {
    return fs.readdirSync(petsDir).filter(name => {
      const dir = path.join(petsDir, name);
      return fs.existsSync(path.join(dir, 'spritesheet.webp'))
          || fs.existsSync(path.join(dir, 'spritesheet.png'));
    });
  } catch {
    return [];
  }
}

export async function fetchManifest(): Promise<PetManifestEntry[]> {
  const res = await fetch(MANIFEST_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
  const data = await res.json();
  return data.pets || data;
}

export async function downloadPet(
  entry: PetManifestEntry,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const petsDir = getPetsDir();
  const petDir = path.join(petsDir, entry.slug);
  fs.mkdirSync(petDir, { recursive: true });

  // Download spritesheet
  const ext = entry.spritesheetUrl.endsWith('.png') ? 'png' : 'webp';
  const spritePath = path.join(petDir, `spritesheet.${ext}`);
  await downloadFile(entry.spritesheetUrl, spritePath, onProgress);

  // Download pet.json
  const jsonPath = path.join(petDir, 'pet.json');
  await downloadFile(entry.petJsonUrl, jsonPath);
}

async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} for ${url}`);

  const total = Number(res.headers.get('content-length')) || 0;
  const body = res.body;
  if (!body) {
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    return;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }

  fs.writeFileSync(destPath, Buffer.concat(chunks));
}
