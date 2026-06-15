exports.up = function(knex) {
  return knex.schema.createTable('reviews', table => {
    table.increments('id').primary();
    table.string('venue_id').notNullable();
    table.foreign('venue_id').references('id').inTable('venues');
    table.integer('rating').notNullable();
    table.text('comment').notNullable();
    table.string('author').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('reviews');
};