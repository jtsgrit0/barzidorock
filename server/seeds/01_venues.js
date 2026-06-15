const fs = require('fs');
const path = require('path');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('venues').del();

  const venuesPath = path.join(__dirname, '../../client/src/venues.json');
  const venuesData = JSON.parse(fs.readFileSync(venuesPath, 'utf8'));

  const venuesToInsert = venuesData.map(venue => ({
    ...venue,
    name: JSON.stringify(venue.name),
    address: JSON.stringify(venue.address),
    opening_hours: JSON.stringify(venue.opening_hours),
    image_urls: JSON.stringify(venue.image_urls),
  }));

  // Inserts seed entries
  await knex('venues').insert(venuesToInsert);
};