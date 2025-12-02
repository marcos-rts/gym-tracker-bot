require('dotenv').config();
const { Telegraf } = require('telegraf');
const knexConfig = require('./knexfile');
const knex = require('knex')(knexConfig);

const bot = new Telegraf(process.env.BOT_TOKEN);

// -------------------------------------------
// Helpers
// -------------------------------------------
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

// -------------------------------------------
// /start
// -------------------------------------------
bot.start(async (ctx) => {
    await ensureUser(ctx);

    return ctx.reply(
        `Fala, ${ctx.from.first_name}! 👊\n` +
        `Seu bot de treinos está ON.\n\n` +
        `📌 *Comandos disponíveis:*\n` +
        `/newroutine <nome>\n` +
        `/listroutines\n` +
        `/deleteroutine <id>\n` +
        `/addroutineexercise <routine_id>|<nome>|<equipamento>|<reps_default>\n` +
        `/listexercises\n` +
        `/deleteexercise <exercise_id>\n` +
        `/startroutine <routine_id>\n` +
        `/logset <session_id>|<exercise_id>|<peso>|<reps>|[duracao]\n` +
        `/finishsession <session_id>\n` +
        `/session <session_id>\n` +
        `/myhistory [limite]\n`
    );
});

// -------------------------------------------
// /newroutine
// -------------------------------------------
bot.command('newroutine', async (ctx) => {
    await ensureUser(ctx);
    const text = ctx.message.text.replace('/newroutine', '').trim();
    if (!text) return ctx.reply('Use: /newroutine <nome da rotina>');

    const [id] = await knex('routines').insert({
        user_id: ctx.from.id,
        name: text
    });

    ctx.reply(`Rotina criada com sucesso! 🏋️‍♂️\nID ${id} — ${text}`);
});

// -------------------------------------------
// /listroutines
// -------------------------------------------
bot.command('listroutines', async (ctx) => {
    await ensureUser(ctx);

    const rows = await knex('routines')
        .where({ user_id: ctx.from.id })
        .orderBy('id', 'desc');

    if (!rows.length)
        return ctx.reply('Nenhuma rotina encontrada. Use /newroutine para criar.');

    let out = '*Suas rotinas:*\n\n';
    rows.forEach(r => out += `• ID ${r.id} — ${r.name}\n`);
    ctx.reply(out);
});

// -------------------------------------------
// /deleteroutine <id>
// -------------------------------------------
bot.command('deleteroutine', async (ctx) => {
    await ensureUser(ctx);
    const id = ctx.message.text.replace('/deleteroutine', '').trim();
    if (!id) return ctx.reply('Use: /deleteroutine <id>');

    const exists = await knex('routines').where({ id, user_id: ctx.from.id }).first();
    if (!exists) return ctx.reply('Rotina não encontrada.');

    await knex('routine_exercises').where({ routine_id: id }).delete();
    await knex('routines').where({ id }).delete();

    ctx.reply(`Rotina ${id} apagada.`);
});

// -------------------------------------------
// /addroutineexercise
// -------------------------------------------
bot.command('addroutineexercise', async (ctx) => {
    await ensureUser(ctx);

    const payload = ctx.message.text.replace('/addroutineexercise', '').trim();
    const parts = payload.split('|').map(s => s.trim());

    if (parts.length < 2)
        return ctx.reply('Use: /addroutineexercise <routine_id>|<nome>|<equipamento>|<reps_default>');

    const [routine_id, name, equipment = null, default_reps = null] = parts;

    const [exId] = await knex('exercises').insert({
        user_id: ctx.from.id,
        name,
        equipment,
        default_reps
    });

    await knex('routine_exercises').insert({
        routine_id: routine_id,
        exercise_id: exId
    });

    ctx.reply(`Exercício *${name}* adicionado à rotina ${routine_id} (ID: ${exId})`);
});

// -------------------------------------------
// /listexercises
// -------------------------------------------
bot.command('listexercises', async (ctx) => {
    await ensureUser(ctx);

    const rows = await knex('exercises')
        .where({ user_id: ctx.from.id })
        .orderBy('id', 'desc');

    if (!rows.length) return ctx.reply('Você não tem exercícios cadastrados.');

    let out = '*Seus exercícios:*\n\n';
    rows.forEach(e => {
        out += `• ID ${e.id} — ${e.name} (${e.equipment || 'livre'})\n`;
    });

    ctx.reply(out);
});

// -------------------------------------------
// /deleteexercise <id>
// -------------------------------------------
bot.command('deleteexercise', async (ctx) => {
    await ensureUser(ctx);
    const id = ctx.message.text.replace('/deleteexercise', '').trim();
    if (!id) return ctx.reply('Use: /deleteexercise <exercise_id>');

    const exists = await knex('exercises').where({ id, user_id: ctx.from.id }).first();
    if (!exists) return ctx.reply('Exercício não encontrado.');

    await knex('routine_exercises').where({ exercise_id: id }).delete();
    await knex('sets').where({ exercise_id: id }).delete();
    await knex('exercises').where({ id }).delete();

    ctx.reply(`Exercício ${id} apagado.`);
});

// -------------------------------------------
// /startroutine
// -------------------------------------------
bot.command('startroutine', async (ctx) => {
    await ensureUser(ctx);

    const arg = ctx.message.text.replace('/startroutine', '').trim();
    if (!arg) return ctx.reply('Use: /startroutine <routine_id>');

    const [sessionId] = await knex('sessions').insert({
        routine_id: arg,
        user_id: ctx.from.id
    });

    ctx.reply(`Sessão iniciada! 🚀\nSession ID: ${sessionId}`);
});

// -------------------------------------------
// /logset
// -------------------------------------------
bot.command('logset', async (ctx) => {
    await ensureUser(ctx);

    const payload = ctx.message.text.replace('/logset', '').trim();
    const parts = payload.split('|').map(s => s.trim());

    if (parts.length < 4)
        return ctx.reply('Use: /logset <session>|<exercise>|<peso>|<reps>|[duracao_s]');

    const [session_id, exercise_id, weight, reps, duration] = parts;

    const count = await knex('sets')
        .where({ session_id })
        .count('id as c')
        .first();

    const set_index = (count.c || 0) + 1;

    await knex('sets').insert({
        session_id,
        exercise_id,
        set_index,
        weight: weight || null,
        reps: reps || null,
        duration_seconds: duration || null
    });

    ctx.reply(`Set registrado: ${weight}kg × ${reps} rep(s).`);
});

// -------------------------------------------
// /finishsession
// -------------------------------------------
bot.command('finishsession', async (ctx) => {
    await ensureUser(ctx);

    const arg = ctx.message.text.replace('/finishsession', '').trim();
    if (!arg) return ctx.reply('Use: /finishsession <session_id>');

    await knex('sessions')
        .where({ id: arg, user_id: ctx.from.id })
        .update({ finished_at: knex.fn.now() });

    ctx.reply(`Sessão ${arg} finalizada. 🏁`);
});

// -------------------------------------------
// /session <id>
// -------------------------------------------
bot.command('session', async (ctx) => {
    await ensureUser(ctx);

    const id = ctx.message.text.replace('/session', '').trim();
    if (!id) return ctx.reply('Use: /session <session_id>');

    const session = await knex('sessions').where({ id, user_id: ctx.from.id }).first();
    if (!session) return ctx.reply('Sessão não encontrada.');

    const sets = await knex('sets')
        .join('exercises', 'sets.exercise_id', 'exercises.id')
        .select('sets.*', 'exercises.name as exercise_name')
        .where({ session_id: id })
        .orderBy(['exercise_id', 'set_index']);

    let out = `*Resumo da sessão ${id}:*\nInício: ${session.started_at}\nFim: ${session.finished_at || '-'}\n\n`;

    const byEx = {};
    sets.forEach(s => {
        byEx[s.exercise_name] = byEx[s.exercise_name] || [];
        byEx[s.exercise_name].push(
            `S${s.set_index}: ${s.weight || '-'}kg × ${s.reps || '-'} ${s.duration_seconds ? `(${s.duration_seconds}s)` : ''}`
        );
    });

    for (const ex in byEx) {
        out += `• *${ex}*\n  ${byEx[ex].join(' | ')}\n`;
    }

    ctx.reply(out);
});

// -------------------------------------------
// /myhistory
// -------------------------------------------
bot.command('myhistory', async (ctx) => {
    await ensureUser(ctx);

    const arg = ctx.message.text.replace('/myhistory', '').trim();
    const limit = parseInt(arg) || 10;

    const rows = await knex('sessions')
        .where({ user_id: ctx.from.id })
        .orderBy('started_at', 'desc')
        .limit(limit);

    if (!rows.length) return ctx.reply('Nenhuma sessão encontrada.');

    let out = '*Últimas sessões:*\n\n';
    rows.forEach(s => {
        out += `ID ${s.id} — Início: ${s.started_at} — Fim: ${s.finished_at || '-'}\n`;
    });

    ctx.reply(out);
});
// -------------------------------------------
// /routinedetails <routine_id>
// -------------------------------------------
bot.command("routinedetails", async (ctx) => {
    await ensureUser(ctx);

    const arg = ctx.message.text.replace('/routinedetails', '').trim();
    if (!arg) return ctx.reply("Use: /routinedetails <routine_id>");

    const routineId = Number(arg);

    // Buscar rotina
    const routine = await knex("routines")
        .where({ id: routineId, user_id: ctx.from.id })
        .first();

    if (!routine) {
        return ctx.reply("Rotina não encontrada.");
    }

    // Buscar exercícios da rotina
    const exercises = await knex("routine_exercises AS re")
        .join("exercises AS e", "e.id", "re.exercise_id")
        .select("e.id as exercise_id", "e.name as exercise_name", "e.equipment", "e.default_reps")
        .where("re.routine_id", routineId);

    // Buscar última sessão dessa rotina
    const lastSession = await knex("sessions")
        .where({ routine_id: routineId, user_id: ctx.from.id })
        .orderBy("started_at", "desc")
        .first();

    let lastSessionText = "Nenhuma execução registrada ainda.";

    if (lastSession) {
        // Buscar sets dessa sessão
        const sets = await knex("sets AS s")
            .join("exercises AS e", "e.id", "s.exercise_id")
            .select(
                "s.*",
                "e.name as exercise_name"
            )
            .where("s.session_id", lastSession.id)
            .orderBy(["exercise_id", "set_index"]);

        let formatted = "";
        let currentEx = "";

        sets.forEach(set => {
            if (currentEx !== set.exercise_name) {
                currentEx = set.exercise_name;
                formatted += `\n  ${set.exercise_name}\n`;
            }

            formatted += `   S${set.set_index}: ${set.weight || '-'}kg × ${set.reps || '-'}`
            if (set.duration_seconds) {
                formatted += ` (${set.duration_seconds}s)`;
            }
            formatted += `\n`;
        });

        lastSessionText = `
Sessão: ${lastSession.id}
Data: ${lastSession.started_at}

${formatted}
        `;
    }

    // Montar NOTINHA
    let out = `
=============================
       ROTINA #${routineId}
   ${routine.name}
=============================

Criada em: ${routine.created_at}

Exercícios:
`;

    exercises.forEach(ex => {
        out += `
- ${ex.exercise_name} (${ex.equipment || "livre"})
  • Repetições padrão: ${ex.default_reps || "-"}
`;
    });

    out += `
=============================
 Última execução
=============================
${lastSessionText}
=============================
`;

    return ctx.reply("```\n" + out + "\n```", { parse_mode: "Markdown" });
});


// -------------------------------------------
// Fallback
// -------------------------------------------
bot.on('text', (ctx) => {
    ctx.reply('Comando não reconhecido. Use /start para ver os disponíveis.');
});

// -------------------------------------------
// Start
// -------------------------------------------
bot.launch().then(() => console.log('Bot rodando 🚀'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
