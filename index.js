require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ACCESS_CODE = process.env.ACCESS_CODE;
const authenticatedUsers = new Set(); // Save autheticated users.

bot.start((ctx) => {
    if (authenticatedUsers.has(ctx.from.id)) {
        return ctx.reply('✅ Ya estas autenticado.');
    }
    ctx.reply('🔑 Bienvenido. Para acceder, envia el codigo de acceso.');
});

bot.hears(ACCESS_CODE, (ctx) => {
    if (authenticatedUsers.has(ctx.from.id)) {
        return ctx.reply('✅ Ya habias ingresado el codigo.');
    }
    authenticatedUsers.add(ctx.from.id);
    ctx.reply('✅ Codigo correcto. Ahora puedes usar el bot.');
});

// Middleware for block commands to non-autheticated users
bot.use((ctx, next) => {
    if (!authenticatedUsers.has(ctx.from.id)) {
        return ctx.reply('🚫 Debes ingresar el codigo de acceso para usar el bot.');
    }
    return next();
});

bot.command('hello', (ctx) => ctx.reply('Hello world'));




bot.launch();