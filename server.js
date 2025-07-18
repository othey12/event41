require('dotenv').config();
const express = require('express');
const next = require('next');

const port = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  // Serve uploads statically
  server.use('/uploads', express.static('public/uploads'));
  // Serve tickets statically
  server.use('/tickets', express.static('public/tickets'));
  // Serve certificates statically
  server.use('/certificates', express.static('public/certificates'));
  // Serve generated-tickets statically
  server.use('/generated-tickets', express.static('public/generated-tickets'));

  // Next.js pages
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}); 