require('dotenv').config();
const { Telegraf } = require('telegraf');
const knexConfig = require('./knexfile');
const knex = require('knex')(knexConfig);

const bot = new Telegraf(process.env.BOT_TOKEN);

// Helpers
async function ensureUser(ctx) {
    const t = ctx.from;
    const exists = await knex('users').where({ id: t.id }).first();
    if (!exists) {
        await knex('users').insert({
            id: t.id,
            username: t.username || null,
            first_name: t.first_name || null,
            last_name: t.last_name || null
        });
    }
}

// /start
bot.start(async (ctx) => {
    await ensureUser(ctx);
    return ctx.reply(
        `Fala, ${ctx.from.first_name}! Bot de treino pronto.\nComandos:\n/newroutine <nome>\n/listroutines\n/addroutineexercise <routine_id>|<nome>|<equipment>|<default_reps>\n/startroutine <routine_id>\n/logset <session_id>|<exercise_id>|<weight>|<reps>\n/finishsession <session_id>\n/session <session_id>\n/myhistory [limit]`
    );
});

// /newroutine Nome da rotina
bot.command('newroutine', async (ctx) => {
    await ensureUser(ctx);
    const text = ctx.message.text.replace('/newroutine', '').trim();
    if (!text) return ctx.reply('Use: /newroutine <nome da rotina>');
    const [id] = await knex('routines').insert({
        user_id: ctx.from.id,
        name: text
    });
    ctx.reply(`Rotina criada: ${text} (id: ${id})`);
});

// /listroutines
bot.command('listroutines', async (ctx) => {
    await ensureUser(ctx);
    const rows = await knex('routines').where({ user_id: ctx.from.id }).orderBy('id', 'desc');
    if (!rows.length) return ctx.reply('Nenhuma rotina encontrada. Crie com /newroutine <nome>');
    let out = 'Suas rotinas:\n';
    rows.forEach(r => out += `ID ${r.id} — ${r.name}\n`);
    ctx.reply(out);
});

// /addroutineexercise <routine_id>|<nome>|<equipment>|<default_reps>
bot.command('addroutineexercise', async (ctx) => {
    await ensureUser(ctx);
    const payload = ctx.message.text.replace('/addroutineexercise', '').trim();
    const parts = payload.split('|').map(s => s.trim());
    if (parts.length < 2) return ctx.reply('Use: /addroutineexercise <routine_id>|<nome>|<equipment>|<default_reps>');
    const [routine_id, name, equipment = null, default_reps = null] = parts;
    const exId = await knex('exercises').insert({
        user_id: ctx.from.id,
        name,
        equipment,
        default_reps
    });
    await knex('routine_exercises').insert({
        routine_id: routine_id,
        exercise_id: exId[0]
    });
    ctx.reply(`Exercício "${name}" adicionado à rotina ${routine_id} (exercise_id: ${exId[0]})`);
});

// /startroutine <routine_id>
bot.command('startroutine', async (ctx) => {
    await ensureUser(ctx);
    const arg = ctx.message.text.replace('/startroutine', '').trim();
    if (!arg) return ctx.reply('Use: /startroutine <routine_id>');
    const [sessionId] = await knex('sessions').insert({
        routine_id: arg,
        user_id: ctx.from.id
    });
    ctx.reply(`Sessão iniciada. session_id: ${sessionId}`);
});

// /logset <session_id>|<exercise_id>|<weight>|<reps>|[duration_seconds]
bot.command('logset', async (ctx) => {
    await ensureUser(ctx);
    const payload = ctx.message.text.replace('/logset', '').trim();
    const parts = payload.split('|').map(s => s.trim());
    if (parts.length < 4) return ctx.reply('Use: /logset <session_id>|<exercise_id>|<weight>|<reps>|[duration_seconds]');
    const [session_id, exercise_id, weight, reps, duration] = parts;
    // compute set_index
    const setsCount = await knex('sets').where({ session_id }).count('id as cnt').first();
    const set_index = (setsCount.cnt || 0) + 1;
    await knex('sets').insert({
        session_id,
        exercise_id,
        set_index,
        weight: weight || null,
        reps: reps || null,
        duration_seconds: duration || null
    });
    ctx.reply(`Set registrado: session ${session_id}, exercise ${exercise_id}, ${weight} x ${reps}`);
});

// /finishsession <session_id>
bot.command('finishsession', async (ctx) => {
    await ensureUser(ctx);
    const arg = ctx.message.text.replace('/finishsession', '').trim();
    if (!arg) return ctx.reply('Use: /finishsession <session_id>');
    await knex('sessions').where({ id: arg, user_id: ctx.from.id }).update({ finished_at: knex.fn.now() });
    ctx.reply(`Sessão ${arg} finalizada.`);
});

// /session <session_id> -> mostra resumo
bot.command('session', async (ctx) => {
    await ensureUser(ctx);
    const arg = ctx.message.text.replace('/session', '').trim();
    if (!arg) return ctx.reply('Use: /session <session_id>');
    const session = await knex('sessions').where({ id: arg, user_id: ctx.from.id }).first();
    if (!session) return ctx.reply('Sessão não encontrada');
    const sets = await knex('sets')
        .join('exercises', 'sets.exercise_id', 'exercises.id')
        .select('sets.*', 'exercises.name as exercise_name')
        .where({ session_id: arg })
        .orderBy(['exercise_id', 'set_index']);
    let out = `Sessão ${arg} — início: ${session.started_at}\n\n`;
    const byExercise = {};
    sets.forEach(s => {
        byExercise[s.exercise_name] = byExercise[s.exercise_name] || [];
        byExercise[s.exercise_name].push(`S${s.set_index}: ${s.weight || '-'} × ${s.reps || '-'} ${s.duration_seconds ? '(' + s.duration_seconds + 's)' : ''}`);
    });
    for (const ex of Object.keys(byExercise)) {
        out += `* ${ex}\n  ${byExercise[ex].join(' | ')}\n`;
    }
    ctx.reply(out);
});

// /myhistory [limit]
bot.command('myhistory', async (ctx) => {
    await ensureUser(ctx);
    const arg = ctx.message.text.replace('/myhistory', '').trim();
    const limit = parseInt(arg) || 10;
    const rows = await knex('sessions').where({ user_id: ctx.from.id }).orderBy('started_at', 'desc').limit(limit);
    if (!rows.length) return ctx.reply('Nenhuma sessão encontrada.');
    let out = 'Últimas sessões:\n';
    for (const s of rows) {
        out += `ID ${s.id} — inicio: ${s.started_at} — final: ${s.finished_at || '-'}\n`;
    }
    ctx.reply(out);
});

// fallback
bot.on('text', (ctx) => {
    return ctx.reply('Comando não reconhecido. Use /start para ver a lista de comandos.');
});

bot.launch().then(() => console.log('Bot rodando'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
