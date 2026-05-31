import { createServer, IncomingMessage, ServerResponse } from 'http';
import { handlePetEvent, sendTokenUpdate } from './pet-window';

const DEFAULT_PORT = 17322; // 使用 17322 避免与 petdex-cc 的 17321 冲突
const MAX_PORT_ATTEMPTS = 10;

let activePort = DEFAULT_PORT;

export function getActivePort(): number {
  return activePort;
}

export function startPetServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function tryPort(port: number): void {
      const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'POST' && req.url === '/event') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString());
              handlePetEvent(body);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end('{"ok":true}');
            } catch {
              res.writeHead(400);
              res.end('{"ok":false,"error":"invalid json"}');
            }
          });
        } else if (req.method === 'POST' && req.url === '/statusline') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString());
              sendTokenUpdate(body);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end('{"ok":true}');
            } catch {
              res.writeHead(400);
              res.end('{"ok":false,"error":"invalid json"}');
            }
          });
        } else {
          res.writeHead(404);
          res.end('{"ok":false}');
        }
      });

      server.on('error', () => {
        attempts++;
        if (attempts >= MAX_PORT_ATTEMPTS) {
          reject(new Error('No available port found'));
          return;
        }
        tryPort(port + 1);
      });

      server.listen(port, '127.0.0.1', () => {
        activePort = port;
        resolve(port);
      });
    }

    tryPort(DEFAULT_PORT);
  });
}
