const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = (app) => {
  const socketProxy = createProxyMiddleware('/websocket', {
    target: 'http://localhost:3000',
    changeOrigin: true,
    ws: true,
    logLevel: 'debug',
  });

  app.use(socketProxy);
};