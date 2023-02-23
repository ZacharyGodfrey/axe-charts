const express = require('express');

const database = require('./database');
const client = require('./client');

const pageHandler = async (pageName, req, res, next) => {
  try {
    console.log(`Requested Page: ${pageName}`);
    console.log(`Available Pages: ${JSON.stringify(Object.keys(client), null, 2)}`);

    if (!client[pageName]) {
      return next();
    }

    const body = await client[pageName](db);

    return res.status(200).type('html').send(body);
  } catch (error) {
    return res.status(500).type('html').send(error.message);
  }
};

module.exports = async () => {
  const db = await database();
  const server = express();

  server.set('json spaces', 2);
  server.use(express.urlencoded({ extended: false }));
  server.use(express.json());

  server.use(({ method }, res, next) => {
    res.header('x-powered-by', '');

    return method === 'OPTIONS' ? res.status(200).end() : next();
  });

  server.get('/', (req, res, next) => pageHandler('home', req, res, next));

  server.get('/:page', (req, res, next) => pageHandler(req.params.page, req, res, next));

  server.use((req, res) => {
    const { method, originalUrl: url, body } = req;

    return res.status(404).send({ method, url, body });
  });

  return server;
};