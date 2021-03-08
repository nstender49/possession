
exports.up = function(knex) {
    return knex.schema.createTable('rooms', t => {
        t.increments()
        t.string('code').unique().notNullable()
        t.jsonb('state')
    })
};

exports.down = function(knex) {
    return knex.schema.dropTable('rooms')
};
