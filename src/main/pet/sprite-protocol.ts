import { protocol } from 'electron';
import path from 'path';
import fs from 'fs';

const PROTOCOL_NAME = 'pet-sprite';

// Must be called before app.whenReady()
export function registerSpriteScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PROTOCOL_NAME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true },
    },
  ]);
}

// Must be called after app.whenReady()
export function registerSpriteProtocol(): void {
  protocol.handle(PROTOCOL_NAME, (request) => {
    // URL format: pet-sprite://sprites/{slug}/spritesheet.webp
    const url = new URL(request.url);
    const slug = url.hostname;  // e.g. "boba"
    const filename = url.pathname.replace(/^\//, ''); // e.g. "spritesheet.webp"

    const homeDir = process.env.USERPROFILE || process.env.HOME || '';
    const fullPath = path.join(homeDir, '.petdex-cc', 'pets', slug, filename);

    if (!fs.existsSync(fullPath)) {
      return new Response('Not Found', { status: 404 });
    }

    const data = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const mime = ext === '.webp' ? 'image/webp' : 'image/png';

    return new Response(data, {
      headers: { 'Content-Type': mime },
    });
  });
}
