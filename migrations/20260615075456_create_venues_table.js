exports.up = function(knex) {
  return knex.schema.createTable('venues', table => {
    table.string('id').primary();
    table.json('name').notNullable();
    table.string('type');
    table.json('address');
    table.float('latitude');
    table.float('longitude');
    table.string('phoneNumber');
    table.string('websiteUrl');
    table.string('googlePlaceId');
    table.text('description');
    table.json('image_urls');
    table.json('opening_hours');
    table.string('area');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('venues');
};