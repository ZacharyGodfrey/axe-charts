const express = require('express');

const db = require('./database');
const client = require('./client');

db.connect();

const handler = (action) => {
  return async (req, res, next) => {
    try {
      const { status, html } = await action(req);

      return res.status(status).type('html').send(`<!-- Rendered by the server -->\n${html}`);
    } catch (error) {
      console.log(JSON.stringify({
        message: error.message,
        stack: error.stack.split('\n').slice(1)
      }, null, 2));
      return res.status(500).type('text').send('An internal server error has occurred.');
    }
  };
};

const server = express();

server.set('json spaces', 2);
server.use(express.urlencoded({ extended: false }));
server.use(express.json());

server.use(({ method }, res, next) => {
  res.header('x-powered-by', '');

  return method === 'OPTIONS' ? res.status(200).end() : next();
});

server.get('/s/comparison/:leftId/:rightId', handler(async (req) => {
  const { leftId, rightId } = req.params;
  const html = await client['comparison'](db, leftId, rightId);

  return { status: 200, html };
}));

server.use(({ method, path, query, body }, res, next) => {
  const message = 'Hard Stop: No routes matched the request.';

  return res.status(404).send({ message, method, path, query, body });
});

module.exports = server;