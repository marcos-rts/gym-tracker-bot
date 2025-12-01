require('dotenv').config();
const { Telegraf } = require('telegraf');
const knexConfig = require('./knexfile');
const knex = require('knex')(knexConfig);

const bot = new Telegraf(process.env.BOT_TOKEN);

// -----------------------
// Função para registrar usuário automaticamente
// -----------------------
async function ensureUser(ctx) {
    const t = ctx.from;
    const user = await knex('users').where({ id: t.id }).first();
    if (!user) {
        await knex('users').insert({
            id: t.id,
            username: t.username || null,
            first_name: t.first_name || null,
            last_name: t.last_name || null
        });
    }
}

// -----------------------
// /start — mensagem inicial
// -----------------------
bot.start(async (ctx) => {
    await ensureUser(ctx);

    return ctx.reply(
        `Fala, ${ctx.from.first_name}! Bora treinar.\n\n` +
        `Comandos disponíveis:\n` +
        `• /newroutine <nome> — Criar rotina\n` +
        `• /listroutines — Listar rotinas\n` +
        `• /addroutineexercise <routine_id>|<nome>|<equipamento>|<reps>\n` +
        `• /startroutine <routine_id> — Iniciar treino\n` +
        `• /logset <session_id>|<exercise_id>|<peso>|<reps>|[duração]\n` +
        `• /finishsession <session_id> — Finalizar treino\n` +
        `• /session <session_id> — Ver detalhes da sessão\n` +
        `• /myhistory [n] — Histórico\n`
    );
});

// -----------------------
// Criar rotina
// -----------------------
bot.command('newroutine', async (ctx) => {
    await ensureUser(ctx);

    const nome = ctx.message.text.replace('/newroutine', '').trim();
    if (!nome) return ctx.reply('Use: /newroutine <nome da rotina>');

    const [id] = await knex('routines').insert({
        user_id: ctx.from.id,
        name: nome
    });

    ctx.reply(`Rotina criada com sucesso!\n• Nome: ${nome}\n• ID: ${id}`);
});

// -----------------------
// Listar rotinas
// -----------------------
bot.command('listroutines', async (ctx) => {
    await ensureUser(ctx);

    const rotinas = await knex('routines')
        .where({ user_id: ctx.from.id })
        .orderBy('id', 'desc');

    if (!rotinas.length)
        return ctx.reply('Você ainda não criou rotinas. Use /newroutine.');

    let texto = 'Suas rotinas:\n';
    rotinas.forEach(r => {
        texto += `• ID ${r.id} — ${r.name}\n`;
    });

    ctx.reply(texto);
});

// -----------------------
// Adicionar exercício na rotina
// -----------------------
bot.command('addroutineexercise', async (ctx) => {
    await ensureUser(ctx);

    const args = ctx.message.text.replace('/addroutineexercise', '').trim();
    const parts = args.split('|').map(s => s.trim());

    if (parts.length < 2)
        return ctx.reply('Use: /addroutineexercise <routine_id>|<nome>|<equipamento>|<reps padrão>');

    const [routine_id, nome, equipamento = null, reps = null] = parts;

    const [exerciseId] = await knex('exercises').insert({
        user_id: ctx.from.id,
        name: nome,
        equipment: equipamento,
        default_reps: reps
    });

    await knex('routine_exercises').insert({
        routine_id,
        exercise_id: exerciseId
    });

    ctx.reply(
        `Exercício adicionado à rotina ${routine_id}:\n` +
        `• Nome: ${nome}\n` +
        `• Equipamento: ${equipamento || '-'}\n` +
        `• Reps padrão: ${reps || '-'}\n` +
        `• ID do exercício: ${exerciseId}`
    );
});

// -----------------------
// Iniciar sessão
// -----------------------
bot.command('startroutine', async (ctx) => {
    await ensureUser(ctx);

    const routineId = ctx.message.text.replace('/startroutine', '').trim();
    if (!routineId) return ctx.reply('Use: /startroutine <routine_id>');

    const [sessionId] = await knex('sessions').insert({
        routine_id: routineId,
        user_id: ctx.from.id
    });

    ctx.reply(`Sessão iniciada!\nID da sessão: ${sessionId}`);
});

// -----------------------
// Registrar série
// -----------------------
bot.command('logset', async (ctx) => {
    await ensureUser(ctx);

    const raw = ctx.message.text.replace('/logset', '').trim();
    const parts = raw.split('|').map(s => s.trim());

    if (parts.length < 4)
        return ctx.reply('Use: /logset <session_id>|<exercise_id>|<peso>|<reps>|[duração]');

    const [session_id, exercise_id, peso, reps, duracao] = parts;

    const count = await knex('sets')
        .where({ session_id })
        .count('id as c')
        .first();

    const set_index = Number(count.c || 0) + 1;

    await knex('sets').insert({
        session_id,
        exercise_id,
        set_index,
        weight: peso || null,
        reps: reps || null,
        duration_seconds: duracao || null
    });

    ctx.reply(
        `Série registrada!\n` +
        `• Sessão: ${session_id}\n` +
        `• Exercício: ${exercise_id}\n` +
        `• Peso: ${peso}\n` +
        `• Reps: ${reps}\n` +
        `${duracao ? `• Duração: ${duracao}s\n` : ''}`
    );
});

// -----------------------
// Finalizar sessão
// -----------------------
bot.command('finishsession', async (ctx) => {
    await ensureUser(ctx);

    const id = ctx.message.text.replace('/finishsession', '').trim();
    if (!id) return ctx.reply('Use: /finishsession <session_id>');

    await knex('sessions')
        .where({ id, user_id: ctx.from.id })
        .update({ finished_at: knex.fn.now() });

    ctx.reply(`Sessão ${id} finalizada!`);
});

// -----------------------
// Detalhes da sessão
// -----------------------
bot.command('session', async (ctx) => {
    await ensureUser(ctx);

    const id = ctx.message.text.replace('/session', '').trim();
    if (!id) return ctx.reply('Use: /session <session_id>');

    const session = await knex('sessions')
        .where({ id, user_id: ctx.from.id })
        .first();

    if (!session)
        return ctx.reply('Sessão não encontrada.');

    const sets = await knex('sets')
        .join('exercises', 'sets.exercise_id', 'exercises.id')
        .select('sets.*', 'exercises.name as ex_nome')
        .where({ session_id: id })
        .orderBy(['exercise_id', 'set_index']);

    let out = `Sessão ${id}\nInício: ${session.started_at}\n\n`;
    const agrupado = {};

    sets.forEach(s => {
        agrupado[s.ex_nome] = agrupado[s.ex_nome] || [];
        agrupado[s.ex_nome].push(
            `S${s.set_index}: ${s.weight || '-'}kg × ${s.reps || '-'} ${s.duration_seconds ? `(${s.duration_seconds}s)` : ''}`
        );
    });

    for (const key of Object.keys(agrupado)) {
        out += `• ${key}\n   ${agrupado[key].join(' | ')}\n`;
    }

    ctx.reply(out);
});

// -----------------------
// Histórico
// -----------------------
bot.command('myhistory', async (ctx) => {
    await ensureUser(ctx);

    const limit = parseInt(ctx.message.text.replace('/myhistory', '').trim()) || 10;

    const sessions = await knex('sessions')
        .where({ user_id: ctx.from.id })
        .orderBy('started_at', 'desc')
        .limit(limit);

    if (!sessions.length)
        return ctx.reply('Você ainda não registrou sessões.');

    let msg = `Últimas ${sessions.length} sessões:\n\n`;

    sessions.forEach(s => {
        msg += `• ID ${s.id} — início: ${s.started_at} — fim: ${s.finished_at || '-'}\n`;
    });

    ctx.reply(msg);
});

// -----------------------
// Fallback
// -----------------------
bot.on('text', (ctx) => {
    return ctx.reply('Comando não reconhecido. Use /start para ver os comandos.');
});

// -----------------------
// Inicialização
// -----------------------
bot.launch().then(() => console.log('Bot rodando 🚀'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
