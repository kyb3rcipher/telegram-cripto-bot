require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

/********** MENUS **********/
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
                [ { text: '💵 Comprar', callback_data: 'comprar' }, { text: '📈 Vender', callback_data: 'vender' } ],
                [ { text: '⚙️ Configuracion', callback_data: 'configuracion'} ]
            ]
        }
    }
};

const settings = {
    'message': '⚙️ Configuraciones:',
    'keyboard': {
        reply_markup: {
            inline_keyboard: [
                [ { text: '✅ Notificaciones', callback_data: 'configuracion-notificaciones' } ],
                [ { text: '🧾 Configuracion Compras', callback_data: 'configuracion-compras' }, { text: '🪙 Configuracion Monedas', callback_data: 'configuracion-monedas' } ],
                [ { text: '← Volver', callback_data: 'menu' } ]
            ]
        }
    }
};

/********** COMMANDS **********/
/* Commands Launchers */
function launchMenu(ctx) {
    ctx.replyWithMarkdown(menu.message, menu.keyboard);
}

function launchSettings(ctx) {
    ctx.reply(settings.message, settings.keyboard);
}


/* Commands */
bot.start((ctx) => {
    const welcomeMessage = `🪐 Hola, esto es {nombre-del-bot}!

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
bot.settings((ctx) => launchSettings(ctx));

bot.command('menu', (ctx) => launchMenu(ctx));


/**********  **********/
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

        case 'configuracion': await ctx.editMessageText(settings.message, settings.keyboard); break;
        case 'configuracion-compras':
            await ctx.editMessageText('🛠️ Configuraciones de compra:', {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: '🤸‍♀️ Slippage', callback_data: 'configuracion-compras-slippage' }, { text: '⛽ Gas fee', callback_data: 'configuracion-compras-gasfee' } ],
                        [ { text: '← Volver', callback_data: 'configuracion' } ]
                    ]
                }
            });
        break;
            case 'configuracion-compras-slippage':
                await ctx.editMessageText('Selecciona la cantidad de compra:', {
                    reply_markup: {
                        inline_keyboard: [
                            [ { text: '0.1', callback_data: 'producto-1' }, { text: '0.5', callback_data: 'producto-2' }, { text: '1', callback_data: 'producto-3' } ],
                            [ { text: 'Otra cantidad', callback_data: 'configuracion-compras-slippage-otra-cantidad' } ],
                            [ { text: '← Volver', callback_data: 'menu' } ]
                        ]
                    }
                });
            break;
        
            case 'configuracion-compras-gasfee':
                ctx.replyWithMarkdown('Ingresa tu gas fee: \n(minimo 0.005 SOL)');
            break;
        
        case 'configuracion-monedas':
            await ctx.editMessageText('🛠️ Configuraciones de monedas:', {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: '🫷 Dev holding', callback_data: 'configuracion-monedas-devholding' }, { text: '🫲 Insider holding', callback_data: 'configuracion-monedas-insiderholding' } ],
                        [ { text: '💸 Smart Money', callback_data: 'configuracion-monedas-smartmoney' }, { text: '📦 Bundle', callback_data: 'configuracion-monedas-bundle' } ],
                        [ { text: '🔝 Top 10', callback_data: 'configuracion-monedas-top10' }, { text: '🎯 Snipers', callback_data: 'configuracion-monedas-snipers' } ],
                        [ { text: '← Volver', callback_data: 'configuracion' } ]
                    ]
                }
            });
        break;
            case 'configuracion-monedas-top10':
                await ctx.reply('Integresa tu porcentaje minimo para el top[10]:')
            break;
    }
});

bot.on('text', async (ctx) => {
    if (awaitingAccessCode) {
        const accessCode = ctx.message.text;
        const validCode = '1234';

        if (accessCode === validCode) {
            await ctx.reply('✅ Codigo de acceso correcto.');
            ctx.reply(`Bienvenido a {nombre-del-bot}!.
                Ahora puedes comenzar a hacer trading, pero antes si deseas puedes configurarme:
                
                💡 Recuerda que puedes ver una explicacion de todos los comandos con: /help.`.split('\n').map(line => line.trim()).join('\n').trim(), {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: '📋 Menu', callback_data: 'menu' } ],
                        [ { text: '⚙️ Configuracion', callback_data: 'configuracion'} ]
                    ]
                }
            });
        } else {
            await ctx.reply('❌ Codigo de acceso incorrecto. Intantalo de nuevo.');
        }

        awaitingAccessCode = false;
    }
});


bot.launch();