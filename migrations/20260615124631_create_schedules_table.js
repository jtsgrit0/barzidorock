/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('schedules', function(table) {
    table.increments('id').primary();
    table.string('venue_id').notNullable();
    table.foreign('venue_id').references('id').inTable('venues').onDelete('CASCADE');
    table.timestamp('event_date').notNullable();
    table.string('event_name').notNullable();
    table.text('description');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('schedules');
};