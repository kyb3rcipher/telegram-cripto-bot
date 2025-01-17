require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    const welcomeMessage = `🪐 Bienvenido a {nombre-del-bot}!

    • El bot para jupiter swap. {nombre-del-bot} te permite comprar o vender tokens rapidamente y tambien ofrecemos muchas otras features como: {...} & mucho mas.

    🚀 Comencemos!`.split('\n').map(line => line.trim()).join('\n').trim();
    ctx.reply(welcomeMessage, {
        reply_markup: {
            inline_keyboard: [
                [ { text: '🔑 Ingresar codigo de acceso', callback_data: 'ingresar-codigo-acceso' } ]
            ]
        }
    });
});

bot.command('menu', (ctx) => {
    const message = `🪐 Bienvenido a {nombre-del-bot}!`;
    ctx.reply('Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industrys standard dummy text ever since the 1500s', {
        reply_markup: {
            inline_keyboard: [
                [ { text: '💵 Comprar', callback_data: 'comprar' }, { text: '📈 Vender', callback_data: 'btn-2' } ]
            ]
        }
    });
});

bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    switch(callbackData) {
        case 'ingresar-codigo-acceso':
            awaitingAccessCode = true;
            await ctx.reply('Por favor, envia tu codigo de acceso');
        break;

        case 'menu':
            await ctx.editMessageReplyMarkup({
                inline_keyboard: [
                    [ { text: '💵 Comprar', callback_data: 'comprar' }, { text: '📈 Vender', callback_data: 'btn-2' } ]
                ]
            });
        break;

        case 'comprar':
            await ctx.editMessageText('Selecciona la cantidad que deseas comprar:', {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: '0.5', callback_data: 'producto-1' }, { text: '1', callback_data: 'producto-2' }, { text: '2', callback_data: 'producto-3' } ],
                        [ { text: 'Otra cantidad', callback_data: 'producto-4' } ],
                        [ { text: '← Volver', callback_data: 'menu' } ]
                    ]
                }
            });
        break;
    }
});

bot.on('text', async (ctx) => {
    if (awaitingAccessCode) {
        const accessCode = ctx.message.text;
        const validCode = '1234';

        if (accessCode === validCode) {
            await ctx.reply('Codigo de acceso correcto. Bienvenido!');
        } else {
            await ctx.reply('Codigo de acceso incorrecto. Intantalo de nuevo.');
        }

        awaitingAccessCode = false;
    }
});


bot.launch();