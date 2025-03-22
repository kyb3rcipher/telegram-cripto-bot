require('dotenv').config();

const { Telegraf } = require('telegraf');
const { Keypair } = require('@solana/web3.js');
const { PublicKey } = require('@solana/web3.js');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Connection db
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connecting to database SQLite.');
});

// Create table
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    public_key TEXT
)`);

let awaitingAccessCode = {};  // To manage different users in the login process
let userSessions = {};

/********** MENU **********/
const menu = {
    message: `🪐 {nombre-del-bot}!

• El bot para Jupiter swap. Compra o vende tokens rápidamente y accede a más funciones.

💳 Tus carteras de Jupiter:
→ W1 (Example) - 0 SOL ($0.00 USD)

💡 Usa **/menu** para ver esta ayuda.`.trim(),
    keyboard: {
        reply_markup: {
            inline_keyboard: [
                [{ text: '💵 Comprar', callback_data: 'comprar' }, { text: '📈 Vender', callback_data: 'vender' }],
                [{ text: '⚙️ Configuración', callback_data: 'configuracion' }]
            ]
        }
    }
};

/********** COAMMNDS **********/
bot.start((ctx) => {
    ctx.reply(`🪐 Bienvenido a {nombre-del-bot}!

🔑 Regístrate con /register <usuario> <contraseña>
🔓 Inicia sesión con /login <usuario> <contraseña>

🚀 Comencemos!`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔑 Ingresar código de acceso', callback_data: 'ingresar-codigo-acceso' }]
            ]
        }
    });
});

bot.command('menu', (ctx) => {
    const userId = ctx.from.id;
    const username = userSessions[userId];

    if (!username) {
        return ctx.reply('❌ No se pudo obtener el nombre de usuario. Por favor, inicia sesión con /login <usuario> <contraseña>.');
    }

    db.get(`SELECT public_key FROM users WHERE username = ?`, [username], (err, row) => {
        if (err) {
            console.error('Error al obtener la clave pública:', err);
            return ctx.reply('❌ Error al obtener la clave pública.');
        }

        if (!row) {
            return ctx.reply('❌ Usuario no encontrado.');
        }

        const publicKey = row.public_key;
        const menuMessage = `🪐 {nombre-del-bot}!

• El bot para Jupiter swap. Compra o vende tokens rápidamente y accede a más funciones.

💳 Tus carteras de Jupiter:
→ ${publicKey} - 0 SOL ($0.00 USD)

💡 Usa **/menu** para ver esta ayuda.`.trim();

        ctx.replyWithMarkdown(menuMessage, menu.keyboard);
    });
});

/********** REGISTER **********/
// Función para convertir Uint8Array a una cadena base58
const bs58 = require('bs58');

bot.command('register', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 2) {
        return ctx.reply('Uso: /register <usuario> <contraseña>');
    }

    const [username, password] = args;

    // Generate a new solana wallet
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const privateKey = bs58.encode(keypair.secretKey);

    // Hash password
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return ctx.reply('Error al registrar. Inténtalo de nuevo.');
        }

        // Insert the new user to the database
        db.run(`INSERT INTO users (username, password, public_key) VALUES (?, ?, ?)`, [username, hash, publicKey], function(err) {
            if (err) {
                return ctx.reply('⚠️ Este usuario ya existe.');
            }

            // Send wallet private key to the user
            ctx.reply(`✅ Registro exitoso. Tu wallet de Solana ha sido creada.\n\n*Dirección de la wallet (clave pública):* \`${publicKey}\`\n\n*Clave privada:* \`${privateKey}\`\n\n⚠️ *IMPORTANTE:* Guarda tu clave privada en un lugar seguro. No la compartas con nadie, ya que quien la posea tendrá control total sobre tus fondos.`, { parse_mode: 'Markdown' });
        });
    });
});

/********** LOGIN **********/
bot.command('login', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 2) {
        return ctx.reply('Uso: /login <usuario> <contraseña>');
    }

    const [username, password] = args;

    db.get(`SELECT password FROM users WHERE username = ?`, [username], (err, row) => {
        if (err || !row) {
            return ctx.reply('❌ Usuario no encontrado.');
        }

        bcrypt.compare(password, row.password, (err, res) => {
            if (res) {
                userSessions[ctx.from.id] = username;   // Save session username
                ctx.reply(`✅ Bienvenido, ${username}! Ahora puedes acceder al menú con /menu.`);
            } else {
                ctx.reply('❌ Contraseña incorrecta.');
            }
        });
    });
});

/********** CALLBACKS **********/
bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    switch(callbackData) {
        case 'ingresar-codigo-acceso':
            ctx.reply('Por favor, inicia sesión con /login <usuario> <contraseña>.');
            break;
        case 'menu':
            ctx.editMessageText(menu.message, { ...menu.keyboard, parse_mode: 'Markdown' });
            break;
        case 'comprar':
            ctx.editMessageText('Selecciona la cantidad que deseas comprar:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '0.5', callback_data: 'producto-1' }, { text: '1', callback_data: 'producto-2' }, { text: '2', callback_data: 'producto-3' }],
                        [{ text: 'Otra cantidad', callback_data: 'comprar-otra-cantidad' }],
                        [{ text: '← Volver', callback_data: 'menu' }]
                    ]
                }
            });
            break;
        case 'vender':
            ctx.editMessageText('Selecciona la cantidad que deseas vender:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '25%', callback_data: 'vender-25' }, { text: '50%', callback_data: 'vender-50' }, { text: '75%', callback_data: 'vender-75' }],
                        [{ text: 'Vender Todo (100%)', callback_data: 'vender-100' }],
                        [{ text: '← Volver', callback_data: 'menu' }]
                    ]
                }
            });
            break;
        case 'configuracion':
            ctx.editMessageText('⚙️ Configuración:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ Notificaciones', callback_data: 'configuracion-notificaciones' }],
                        [{ text: '🛠 Configuración Compras', callback_data: 'configuracion-compras' }, { text: '🪙 Configuración Monedas', callback_data: 'configuracion-monedas' }],
                        [{ text: '← Volver', callback_data: 'menu' }]
                    ]
                }
            });
            break;
    }
});

/********** CIERRE DEL BOT **********/
process.once('SIGINT', () => {
    bot.stop('SIGINT');
    db.close();
});

process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    db.close();
});




bot.launch();