const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => {
  return render(page, {
    updatedAt: await db.timestamp(),
    totalProfiles: (await db.get(`
      SELECT COUNT(*) AS total
      FROM profiles;
    `)).total,
    standard: {
      count: (await db.get(`
        SELECT COUNT(*) AS count
        FROM profiles
        WHERE standardRating > 0;
      `)).count,
      averageRating: (await db.get(`
        SELECT ROUND(AVG(standardRating)) AS average
        FROM profiles
        WHERE standardRating > 0;
      `)).average,
      averageScore: (await db.get(`
        SELECT ROUND(AVG(standardAverage), 3) AS average
        FROM profiles
        WHERE standardAverage > 0;
      `)).average
    },
    premier: {
      count: (await db.get(`
        SELECT COUNT(*) AS count
        FROM profiles
        WHERE premierRating > 0;
      `)).count,
      averageRating: (await db.get(`
        SELECT ROUND(AVG(premierRating)) AS average
        FROM profiles
        WHERE premierRating > 0;
      `)).average,
      averageScore: (await db.get(`
        SELECT ROUND(AVG(premierAverage), 3) AS average
        FROM profiles
        WHERE premierAverage > 0;
      `)).average
    }
  });
};
