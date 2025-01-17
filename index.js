require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);


const menu = {
    message:`🪐 {nombre-del-bot}!

            • El bot para Jupiter swap. {nombre-del-bot} te permite comprar o vender tokens rapidamente y tambien ofrecemos muchas otras features como: {...} & mucho mas.        
            
            💳 Tus carteras de Jupiter:
            ‎ ‎ ‎ ‎ ‎  → W1 (Example) - 0 SOL ($0.00 USD)
            
            💡 Siempre puedes ver esta ayuda con: **/menu**
        `.split('\n').map(line => line.trim()).join('\n').trim(),
    keyboard: {
        reply_markup: {
            inline_keyboard: [
                [ { text: '💵 Comprar', callback_data: 'comprar' }, { text: '📈 Vender', callback_data: 'vender' } ]
            ]
        }
    }
};

function launchMenu(ctx) {
    ctx.replyWithMarkdown(menu.message, menu.keyboard);
}

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

bot.command('menu', (ctx) => launchMenu(ctx));

bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    switch(callbackData) {
        case 'ingresar-codigo-acceso':
            awaitingAccessCode = true;
            await ctx.reply('Por favor, envia tu codigo de acceso');
        break;

        case 'menu': await ctx.editMessageText(menu.message, { ...menu.keyboard, parse_mode: 'Markdown' }); break;

        case 'comprar':
            await ctx.editMessageText('Selecciona la cantidad que deseas comprar:', {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: '0.5', callback_data: 'producto-1' }, { text: '1', callback_data: 'producto-2' }, { text: '2', callback_data: 'producto-3' } ],
                        [ { text: 'Otra cantidad', callback_data: 'comprar-otra-cantidad' } ],
                        [ { text: '← Volver', callback_data: 'menu' } ]
                    ]
                }
            });
        break;
        case 'comprar-otra-cantidad':
            await ctx.reply('Por favor, envia la cantidad');
        break;

        case 'vender':
            await ctx.editMessageText('Selecciona la cantidad que deseas vender:', {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: '25%', callback_data: 'vender-25'}, { text: '50%', callback_data: 'vender-50' }, { text: '75%', callback_data: 'vender-75' } ],
                        [ { text: 'Vender Todo (100%)', callback_data: 'vender-100' }],
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
            await ctx.reply('✅ Codigo de acceso correcto. Bienvenido!');
            launchMenu(ctx);
        } else {
            await ctx.reply('❌ Codigo de acceso incorrecto. Intantalo de nuevo.');
        }

        awaitingAccessCode = false;
    }
});


bot.launch();