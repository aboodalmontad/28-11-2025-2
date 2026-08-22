const http = require('http');
const sirv = require('sirv');

const assets = sirv('public', {
  single: true,
  dev: true,
});

const server = http.createServer((req, res) => {
  assets(req, res);
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
