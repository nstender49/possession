
exports.up = function(knex) {
    return knex.schema.createTable('users', t => {
        knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
        t.string('sessionId')
        t.string('roomCode')
        t.timestamps(true, true);
    })
};

exports.down = function(knex) {
    return knex.schema.dropTable('users')
};
