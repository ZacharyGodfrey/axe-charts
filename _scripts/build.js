const path = require('path');
const fs = require('fs-extra');

const client = require('../src/client');

const clientDir = path.resolve(__dirname, '../src/client');
const distDir = path.resolve(__dirname, '../dist');

(async () => {
  await fs.emptyDir(distDir);

  await fs.copy(`${clientDir}/assets`, distDir);

  const db = require('../src/database');

  db.connect();

  const basicPages = {
    'index': client['home'],
    '404': client['404'],
    '500': client['500'],
  };

  await Promise.all(Object.entries(basicPages).map(async ([name, render]) => {
    const fileName = `${distDir}/${name}.html`;
    const content = await render(db);

    console.log(`Writing File: ${fileName}`);

    await fs.outputFile(fileName, `<!-- Rendered during build step -->\n${content}`, 'utf-8');
  }));

  // TODO: Query the database and render profile pages based on data

  db.disconnect();
})();