const path = require('path');
const fs = require('fs-extra');
const { render } = require('mustache');

const { db, readFile, writeFile, logError } = require('./helpers');

const CLIENT_DIR = path.resolve(__dirname, '../client');
const DIST_DIR = path.resolve(__dirname, '../dist');

const getShell = async () => {
  let [shell, robotoFont, chartJS] = await Promise.all([
    readFile(`${CLIENT_DIR}/shell.html`),
    readFile(`${CLIENT_DIR}/assets/roboto-mono.ttf`, 'base64'),
    readFile(`${CLIENT_DIR}/assets/chart.js`),
  ]);

  shell = shell.replace('//robotoFont//', robotoFont);
  shell = shell.replace('//chartJS//', chartJS);

  return shell;
};

const getGlobalStats = async () => {
  const row = await db.get(`
    SELECT
      min(stats -> '$.totalScore') AS minScore,
      max(stats -> '$.totalScore') AS maxScore
    FROM matches
    WHERE
      processed = 1
      AND valid = 1
      AND stats -> '$.totalScore' > 0
  `);

  return {
    minScore: parseInt(row.minScore),
    maxScore: parseInt(row.maxScore),
  }
};

const buildHomePage = async (shell, profiles) => {
  console.log('Building home page');

  const page = await readFile(`${CLIENT_DIR}/home.html`);
  const data = {
    title: undefined,
    profiles,
    profilesJson: JSON.stringify(profiles, null, 2)
  };

  return render(shell, data, { page });
};

const build404Page = async (shell) => {
  console.log('Building 404 page');

  const page = await readFile(`${CLIENT_DIR}/404.html`);
  const data = {
    title: 'Not Found'
  };

  return render(shell, data, { page });
};

const build500Page = async (shell) => {
  console.log('Building 500 page');

  const page = await readFile(`${CLIENT_DIR}/500.html`);
  const data = {
    title: 'Error',
  };

  return render(shell, data, { page });
};

const buildProfilePage = async (shell, { profile, matches, globalStats }) => {
  console.log(`Building profile page for profile ID ${profile.id}`);

  const page = await readFile(`${CLIENT_DIR}/profile.html`);
  const data = {
    title: profile.name,
    profile,
    profileJson: JSON.stringify(profile),
    matchesJson: JSON.stringify(matches),
    globalStatsJson: JSON.stringify(globalStats)
  };

  return render(shell, data, { page });
};

(async () => {
  try {
    console.log('# Build Pages');

    console.log(JSON.stringify({
      CLIENT_DIR,
      DIST_DIR
    }, null, 2));

    await fs.emptyDir(DIST_DIR);
    await fs.copy(`${CLIENT_DIR}/static`, DIST_DIR);

    const [shell, globalStats, profiles] = await Promise.all([
      getShell(),
      getGlobalStats(),
      db.query(`
        SELECT *
        FROM profiles
        ORDER BY rank ASC, rating DESC
      `)
    ]);

    profiles.forEach(x => x.stats = JSON.parse(x.stats));

    await Promise.all([
      buildHomePage(shell, profiles).then(page => writeFile(`${DIST_DIR}/index.html`, page)),
      build404Page(shell).then(page => writeFile(`${DIST_DIR}/404.html`, page)),
      build500Page(shell).then(page => writeFile(`${DIST_DIR}/500.html`, page)),
      ...profiles.map(async profile => {
        const matches = await db.query(`
          SELECT *
          FROM matches
          WHERE profileId = ?
          ORDER BY id ASC
        `, [profile.id]);

        matches.forEach(x => {
          x.processed = x.processed === 1;
          x.valid = x.valid === 1;
          x.stats = JSON.parse(x.stats);
        });

        const page = await buildProfilePage(shell, {
          profile,
          matches: matches.filter(x => x.processed && x.valid),
          globalStats
        });

        await writeFile(`${DIST_DIR}/${profile.id}.html`, page);
        await writeFile(`${DIST_DIR}/${profile.id}.json`, JSON.stringify({ profile, matches }, null, 2));
        await writeFile(`${DIST_DIR}/${profile.id}.txt`, matches.map(x => x.text).join('\n'));
      })
    ]);

    await db.disconnect();
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();