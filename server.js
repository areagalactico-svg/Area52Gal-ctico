const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function safeResolve(basePath, requestPath) {
  const normalized = path.normalize(requestPath)
    .replace(/^\/+/, '')
    .replace(/\.+(?=\/|$)/g, '.');

  return path.join(basePath, normalized);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch {
        resolve(raw);
      }
    });
  });
}

async function handleApi(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  const apiName = pathname.replace(/^\/api\//, '').replace(/\/$/, '');

  if (!apiName) {
    sendJson(res, 404, { error: 'API not found' });
    return;
  }

  const apiPath = path.join(__dirname, 'api', `${apiName}.js`);
  if (!fs.existsSync(apiPath)) {
    sendJson(res, 404, { error: `Endpoint /api/${apiName} not found` });
    return;
  }

  const handler = require(apiPath);
  const body = await readBody(req);
  const apiReq = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body,
    query: Object.fromEntries(new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams.entries()),
  };

  const apiRes = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      Object.assign(this.headers, headers);
    },
    end(payload) {
      const finalPayload = payload === undefined ? '' : payload;
      res.statusCode = this.statusCode;
      Object.entries(this.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      res.end(finalPayload);
    },
    json(payload) {
      this.statusCode = this.statusCode || 200;
      res.statusCode = this.statusCode;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload));
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };

  try {
    await handler(apiReq, apiRes);
  } catch (error) {
    console.error(`API error (${apiName}):`, error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const relativePath = pathname.replace(/^\//, '');
  const absolutePath = safeResolve(PUBLIC_DIR, relativePath);
  const resolvedPublicRoot = path.resolve(PUBLIC_DIR);

  if (!absolutePath.startsWith(resolvedPublicRoot)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  const candidatePaths = [absolutePath];
  if (path.extname(absolutePath) === '') {
    candidatePaths.push(path.join(absolutePath, 'index.html'));
  }

  let finalPath = null;
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      finalPath = candidate;
      break;
    }
  }

  if (!finalPath) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  const ext = path.extname(finalPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);

  const stream = fs.createReadStream(finalPath);
  stream.on('error', () => {
    res.statusCode = 500;
    res.end('Internal server error');
  });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (method === 'OPTIONS') {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    await handleApi(req, res);
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Servidor local listo en http://localhost:${PORT}`);
});
