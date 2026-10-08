import http from 'node:http';

const port = Number(process.env.PORT || 8092);

function intervalSeconds(raw) {
  const value = String(raw || '1m');
  const match = value.match(/^(\d+)([mhdwM])$/);
  if (!match) return 60;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3600;
  if (unit === 'd') return amount * 86400;
  if (unit === 'w') return amount * 604800;
  if (unit === 'M') return amount * 2592000;
  return 60;
}

function buildKlines(url) {
  const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') || 500)));
  const step = intervalSeconds(url.searchParams.get('interval'));
  const end = Math.floor(Date.now() / 1000 / step) * step;
  return Array.from({ length: limit }, (_, index) => {
    const time = end - (limit - 1 - index) * step;
    const base = 60000 + index * 3;
    const open = base;
    const close = base + Math.sin(index / 8) * 18;
    const high = Math.max(open, close) + 8;
    const low = Math.min(open, close) - 8;
    const volume = 10 + (index % 17);
    return [
      time * 1000,
      String(open),
      String(high),
      String(low),
      String(close),
      String(volume),
      time * 1000 + step * 1000 - 1,
      '0',
      10,
      '0',
      '0',
      '0',
    ];
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/api/v3/klines') {
    res.end(JSON.stringify(buildKlines(url)));
    return;
  }

  if (url.pathname === '/api/v3/ticker/24hr') {
    res.end(JSON.stringify({
      symbol: url.searchParams.get('symbol') || 'BTCUSDT',
      lastPrice: '65000',
      priceChangePercent: '1.25',
    }));
    return;
  }

  if (url.pathname === '/health') {
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Binance mock listening on 127.0.0.1:${port}\n`);
});
