import http from 'http';

const PORT = 7777;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  let raw = '';
  for await (const chunk of req) raw += chunk;

  try {
    const { url, method, headers, body } = JSON.parse(raw);
    const upstream = await fetch(url, { method, headers, body: body ?? undefined });
    const text = await upstream.text();
    const responseHeaders = {};
    upstream.headers.forEach((value, key) => { responseHeaders[key] = value; });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
      body: text,
    }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(e) }));
  }
});

server.listen(PORT, () => {
  console.log(`Local proxy running → http://localhost:${PORT}`);
  console.log('Keep this terminal open while using API Client.\n');
});
