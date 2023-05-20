const path = require('path');
const fs = require('fs-extra');
const puppeteer = require('puppeteer');

const db = require('../src/database');

const groupItems = (size, items) => {
  return items.reduce((groups, item) => {
    const group = groups[groups.length - 1];

    if (group.length < size) {
      group.push(item);
    } else {
      groups.push([item]);
    }

    return groups;
  }, [[]]);
};

const reactPageState = (page, selector) => {
  return page.$eval(selector, (element) => {
    const { getState } = element._reactRootContainer._internalRoot.current.memoizedState.element.props.store;

    return getState();
  });
};

const addTimestampEntry = async () => {
  console.log('[SCRAPE] Add Timestamp Entry');

  const now = new Date().toISOString();

  await db.run(`INSERT INTO timestamp (timestamp) VALUES (?);`, [now]);
};

const scrape = async () => {
  console.log('[SCRAPE] Begin Browser Operations');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await getProfiles(page);

  await browser.close();
};

const getProfiles = async (page) => {
  console.log('[SCRAPE] Store Profiles');

  await page.goto('https://axescores.com/players/collins-rating');
  await page.waitForNetworkIdle({ idleTime: 2 * 1000 });
  await page.select('.sc-gwVKww.fJdgsF select', 'IATF Premier');
  await page.waitForNetworkIdle({ idleTime: 2 * 1000 });

  const allProfiles = (await reactPageState(page, '#root'))
    .globalStandings.standings.career
    .filter(({ active }) => active);

  console.log(`[SCRAPE] Found ${allProfiles.length} Profiles`);

  await Promise.all(allProfiles.map(async ({ id, name, rank, rating, average }) => {
    if (id === 1207260) {
      await writeProfileJson({ id, name, rank, rating, average });
    }

    return db.insert('profiles', { id, name, rank, rating, average });
  }));
};

const writeProfileJson = async ({ id, name, rank, rating, average }) => {
  const filePath = path.resolve(__dirname, `../src/database/profiles/${id}.json`);
  const exists = await fs.pathExists(filePath);
  const data = exists ? await fs.readJson(filePath) : {
    id,
    name,
    rank,
    rating,
    average,
    stats: {},
    matches: []
  };

  data.name = name;
  data.rank = rank;
  data.rating = rating;
  data.average = average;

  await fs.outputFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

(async () => {
  try {
    await db.ensureSchema();
    await addTimestampEntry();
    await scrape();

    console.log('[SCRAPE] All steps completed successfully.');
  } catch (error) {
    console.log(error);

    process.exit(1);
  }
})();