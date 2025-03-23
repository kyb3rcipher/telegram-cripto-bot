require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Keypair, Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const sqlite3 = require('sqlite3').verbose();

const bot = new Telegraf(process.env.BOT_TOKEN);
const ACCESS_CODE = process.env.ACCESS_CODE;
const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error(err.message);
    console.log('✅ Connecting to database.');
});

// Create users table if it does not exist
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    username TEXT,
    public_key TEXT,
    private_key TEXT
)`);

const authenticatedUsers = new Set(); // Temporarily store authenticated users in memory

/********** Start and authetication **********/
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

// Middleware to block commands for non-authenticated users
bot.use((ctx, next) => {
    if (!authenticatedUsers.has(ctx.from.id)) {
        return ctx.reply('🚫 Debes ingresar el codigo de acceso para usar el bot.');
    }
    return next();
});


/********** Commands **********/
bot.command('menu', (ctx) => {
    const userId = ctx.from.id;

    db.get(`SELECT public_key FROM users WHERE user_id = ?`, [userId], async (err, row) => {
        if (err) {
            console.error(err);
            return ctx.reply('⚠️ Error al recuperar tu información.');
        }

        if (!row) {
            return ctx.reply('⚠️ No tienes una wallet registrada. Usa /wallet para crear una.');
        }

        const publicKey = row.public_key;
        let balanceSOL = 0;

        try {
            const balanceLamports = await connection.getBalance(new PublicKey(publicKey));
            balanceSOL = balanceLamports / 1e9; // Convert lamports to SOL
        } catch (error) {
            console.error('Error al obtener saldo:', error);
        }

        const shortPublicKey = `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;

        // Get the bot's name dynamically
        const botInfo = await bot.telegram.getMe();
        const botName = botInfo.first_name + (botInfo.last_name ? ` ${botInfo.last_name}` : '');

        const menuMessage = `🪐 ${botName}!

• El bot para Solana. Compra o vende tokens rapidamente y otras features como: ...} & mucho mas.

💳 Tus carteras de Solana:
→ W1 *${shortPublicKey}* - (${balanceSOL.toFixed(4)} SOL)

💡 Siempre puedes ver esta ayuda con: **/menu**
`;

        ctx.replyWithMarkdown(menuMessage, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👛 Ver Wallet', callback_data: 'wallet' }],
                ]
            }
        });
    });
});

bot.command('wallet', (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Desconocido';

    // Check if the user already has a wallet in the database
    db.get(`SELECT public_key, private_key FROM users WHERE user_id = ?`, [userId], (err, row) => {
        if (err) {
            console.error(err);
            return ctx.reply('⚠️ Ocurrio un error al verificar tu wallet.');
        }

        if (row) {
            return ctx.reply(`✅ Ya tienes una wallet registrada.

🪙 *Clave publica:* \`${row.public_key}\`
🔑 *Clave privada:* \`${row.private_key}\`

⚠️ *IMPORTANTE:* Guarda tu clave privada en un lugar seguro.`, { parse_mode: 'Markdown' });
        }

        // Else the user does not have a wallet, generate a new one
        const keypair = Keypair.generate();
        const publicKey = keypair.publicKey.toBase58();
        const privateKey = bs58.encode(Buffer.from(keypair.secretKey));

        db.run(`INSERT INTO users (user_id, username, public_key, private_key) VALUES (?, ?, ?, ?)`, 
        [userId, username, publicKey, privateKey], (err) => {
            if (err) {
                console.error(err);
                return ctx.reply('⚠️ Ocurrio un error al registrar tu wallet.');
            }

            ctx.reply(`✅ Wallet generada con exito.

🪙 *Clave publica:* \`${publicKey}\`
🔑 *Clave privada:* \`${privateKey}\`

⚠️ *IMPORTANTE:* Guarda tu clave privada en un lugar seguro.`, { parse_mode: 'Markdown' });
        });
    });
});


/********** CALLBACKS **********/
bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    switch(callbackData) {
        case 'menu':
            const userId = ctx.from.id;

            db.get(`SELECT public_key FROM users WHERE user_id = ?`, [userId], async (err, row) => {
                if (err) {
                    console.error(err);
                    return ctx.reply('⚠️ Error al recuperar tu información.');
                }

                if (!row) {
                    return ctx.reply('⚠️ No tienes una wallet registrada. Usa /wallet para crear una.');
                }

                const publicKey = row.public_key;
                let balanceSOL = 0;

                try {
                    const balanceLamports = await connection.getBalance(new PublicKey(publicKey));
                    balanceSOL = balanceLamports / 1e9; // Convert lamports to SOL
                } catch (error) {
                    console.error('Error al obtener saldo:', error);
                }

                const shortPublicKey = `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;

                // Get the bot's name dynamically
                const botInfo = await bot.telegram.getMe();
                const botName = botInfo.first_name + (botInfo.last_name ? ` ${botInfo.last_name}` : '');

                const menuMessage = `🪐 ${botName}!

• El bot para Solana. Compra o vende tokens rapidamente y otras features como: ...} & mucho mas.

💳 Tus carteras de Solana:
→ W1 *${shortPublicKey}* - (${balanceSOL.toFixed(4)} SOL)

💡 Siempre puedes ver esta ayuda con: **/menu**
`;

                ctx.editMessageText(menuMessage, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👛 Ver Wallet', callback_data: 'wallet' }],
                        ]
                    },
                    parse_mode: 'Markdown'
                });
            });
            break;

        case 'wallet':
            const userIdForWallet = ctx.from.id;

            db.get(`SELECT public_key, private_key FROM users WHERE user_id = ?`, [userIdForWallet], (err, row) => {
                if (err) {
                    console.error(err);
                    ctx.reply('⚠️ Ocurrio un error al verificar tu wallet.');
                }

                if (row) {
                    ctx.editMessageText(`✅ Ya tienes una wallet registrada.

🪙 *Clave publica:* \`${row.public_key}\`
🔑 *Clave privada:* \`${row.private_key}\`

⚠️ *IMPORTANTE:* Guarda tu clave privada en un lugar seguro.`, { 
                        reply_markup: { 
                            inline_keyboard: [
                                [{ text: '← Volver', callback_data: 'menu' }]
                            ]
                        },
                        parse_mode: 'Markdown' 
                    });
                } else {
                    ctx.reply('⚠️ No tienes una wallet registrada. Usa /wallet para crear una.');
                }
            });
            break;
    }
});





bot.launch();
console.log('🚀 Bot working...');