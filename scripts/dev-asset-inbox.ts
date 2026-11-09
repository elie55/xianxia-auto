import type { Plugin } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Dev-only asset inbox: lets a browser page (e.g. the AutoSprite app) POST generated sprite sheets straight
 * into `.autosprite-inbox/<character>/<animation>/spritesheet.png|atlas.json`, bypassing download prompts.
 * Only active under `vite` (serve), only on localhost, and only for whitelisted relative paths.
 *
 *   fetch('http://127.0.0.1:5173/__inbox', { method: 'POST', headers: { 'x-path': 'thunder_ape/idle/spritesheet.png' }, body: blob })
 */
export function devAssetInbox(root: string): Plugin {
  const inbox = resolve(root, '.autosprite-inbox');
  return {
    name: 'dev-asset-inbox',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__inbox', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'content-type, x-path');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        // Chrome Private Network Access: a public https page may only reach loopback if the preflight allows it.
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        const rel = String(req.headers['x-path'] ?? '');
        if (!/^[a-z0-9_]{1,40}\/[a-z0-9_]{1,40}\/(spritesheet\.png|atlas\.json)$/.test(rel)) {
          res.statusCode = 400;
          res.end('bad x-path');
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (c: Buffer) => {
          size += c.length;
          if (size > 40 * 1024 * 1024) req.destroy();
          else chunks.push(c);
        });
        req.on('end', () => {
          const target = join(inbox, rel);
          mkdirSync(join(target, '..'), { recursive: true });
          writeFileSync(target, Buffer.concat(chunks));
          res.statusCode = 200;
          res.end(`ok ${size}`);
        });
      });
    },
  };
}
