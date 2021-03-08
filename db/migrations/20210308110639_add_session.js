
exports.up = function(knex) {
    return knex.schema.createTable('sessions', t => {
        t.string('sid').primary()
        t.jsonb('sess').notNullable()
        t.timestamp('expired').notNullable()
    })
};

exports.down = function(knex) {
    return knex.schema.dropTable('sessions')
};
