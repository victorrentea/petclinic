module.exports = {
  '/v1/traces': {
    target: 'http://localhost:4318',
    secure: false,
    changeOrigin: true,
    logLevel: 'silent',
    onError: (_err, _req, res) => {
      if (!res.headersSent) {
        res.writeHead(204);
      }
      res.end();
    },
  },
};
