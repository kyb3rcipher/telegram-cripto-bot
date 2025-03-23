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

// Create tables if it does not exist
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    username TEXT,
    default_wallet_id INTEGER,
    
    FOREIGN KEY (default_wallet_id) REFERENCES wallets(id) ON DELETE SET NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    wallet_name TEXT,
    public_key TEXT UNIQUE,
    private_key TEXT UNIQUE
)`);


const authenticatedUsers = new Set(); // Temporarily store authenticated users in memory
const pendingWalletImports = {}; // Store users in the process of importing wallets

/********** Start and authentication **********/
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

    db.get(`SELECT public_key FROM wallets WHERE user_id = ?`, [userId], async (err, row) => {
        if (err) {
            console.error(err);
            return ctx.reply('⚠️ Error al recuperar tu información.');
        }

        if (!row) {
            return ctx.reply('⚠️ No tienes al menos una wallet registrada. Usa /wallet para crear una.');
        }

        const publicKey = row.public_key;
        let balanceSOL = 0;

        try {
            const balanceLamports = await connection.getBalance(new PublicKey(publicKey));
            balanceSOL = balanceLamports / 1e9; // Convert lamports to SOL
        } catch (error) {
            console.error('Error al obtener balance:', error);
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
                    [{ text: '👛 Ver Wallets', callback_data: 'wallets' }],
                ]
            }
        });
    });
});

bot.command('wallet', (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Unknown';

    // Check if the user is already registered
    db.get(`SELECT id FROM users WHERE user_id = ?`, [userId], (err, row) => {
        if (err) {
            console.error(err);
            return ctx.reply('⚠️ An error occurred while verifying your account.');
        }

        // If the user does not exist, register them
        if (!row) {
            db.run(`INSERT INTO users (user_id, username) VALUES (?, ?)`, [userId, username], function (err) {
                if (err) {
                    console.error(err);
                    return ctx.reply('⚠️ An error occurred while registering your account.');
                }

                // Create the first wallet after registering the user
                createWalletForUser(ctx, userId);
            });
        } else {
            // If the user is already registered, create the wallet
            createWalletForUser(ctx, userId);
        }
    });
});

function createWalletForUser(ctx, userId) {
    // Check if the user already has at least one wallet
    db.get(`SELECT COUNT(*) as count FROM wallets WHERE user_id = ?`, [userId], (err, row) => {
        if (err) {
            console.error(err);
            return ctx.reply('⚠️ An error occurred while verifying your wallet.');
        }

        if (row.count > 0) {
            return ctx.reply('✅ You already have at least one wallet registered. Use /menu to view them.');
        }

        // Generate a new wallet for the user
        const keypair = Keypair.generate();
        const publicKey = keypair.publicKey.toBase58();
        const privateKey = bs58.encode(Buffer.from(keypair.secretKey));

        // Insert the new wallet into the database
        db.run(`INSERT INTO wallets (user_id, wallet_name, public_key, private_key) VALUES (?, ?, ?, ?)`, [userId, 'Start Wallet', publicKey, privateKey], function (err) {
            if (err) {
                console.error(err);
                return ctx.reply('⚠️ An error occurred while registering your first wallet.');
            }

            const walletId = this.lastID; // Get the ID of the newly inserted wallet

            // Now, update the default_wallet_id field in the users table
            db.run(`UPDATE users SET default_wallet_id = ? WHERE user_id = ?`, [walletId, userId], (err) => {
                if (err) {
                    console.error(err);
                    return ctx.reply('⚠️ An error occurred while assigning the default wallet.');
                }

                ctx.reply(`✅ Wallet successfully generated and set as your default wallet.

🪙 *Public key:* \`${publicKey}\`
🔑 *Private key:* \`${privateKey}\`

⚠️ *IMPORTANT:* Keep your private key in a safe place.`, { parse_mode: 'Markdown' });
            });
        });
    });
}

/********** CALLBACKS **********/
bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    const userId = ctx.from.id;

    switch(callbackData) {
        case 'menu':
            db.get(`SELECT public_key FROM wallets WHERE user_id = ?`, [userId], async (err, row) => {
                if (err) {
                    console.error(err);
                    return ctx.reply('⚠️ Error al recuperar tu informacion.');
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
                    console.error('Error al obtener el balance:', error);
                }

                const shortPublicKey = `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;

                // Get the bot's name dynamically
                const botInfo = await bot.telegram.getMe();
                const botName = botInfo.first_name + (botInfo.last_name ? ` ${botInfo.last_name}` : '');

                const menuMessage = `🪐 ${botName}!

• El bot para Solana. Compra o vende tokens rapidamente y otras features como: ... & mucho mas.

💳 Tus carteras de Solana:
→ W1 *${shortPublicKey}* - (${balanceSOL.toFixed(4)} SOL)

💡 Siempre puedes ver esta ayuda con: **/menu**
`;

                ctx.editMessageText(menuMessage, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👛 Ver Wallets', callback_data: 'wallets' }],
                        ]
                    },
                    parse_mode: 'Markdown'
                });
            });
            break;

        case 'wallets':
            const userIdForWallet = ctx.from.id;
        
            db.all(`SELECT wallet_name, public_key FROM wallets WHERE user_id = ?`, [userIdForWallet], async (err, rows) => {
                if (err) {
                    console.error(err);
                    ctx.reply('⚠️ Ocurrio un error al verificar tus wallets.');
                }
        
                if (rows.length === 0) {
                    return ctx.reply('⚠️ No tienes al menos una wallet registrada. Usa /wallet para crear una.');
                }
        
                let message = '👛 *Tus wallets registradas:*\n\n';
                let keyboard = [];
        
                for (const row of rows) {
                    let balanceSOL = 0;
        
                    try {
                        const balanceLamports = await connection.getBalance(new PublicKey(row.public_key));
                        balanceSOL = balanceLamports / 1e9; // Convert lamports to SOL
                    } catch (error) {
                        console.error(`❌ Error al obtener el balance para la wallet ${row.public_key}:`, error);
                    }
        
                    message += `• *${row.wallet_name}*\n   → \`${row.public_key}\`\n   💰 *Balance:* ${balanceSOL.toFixed(4)} SOL\n\n`;
                }
        
                keyboard.push([{ text: '✅ Default Wallet', callback_data: 'set_default_wallet' }, { text: '📥 Import Wallet', callback_data: 'import_wallet' }]);
                keyboard.push([{ text: '← Back', callback_data: 'menu' }]);
        
                ctx.editMessageText(message, { 
                    reply_markup: { inline_keyboard: keyboard },
                    parse_mode: 'Markdown' 
                });
            });
            break;

    case 'import_wallet':
        // Check if the user is already in the process of importing
        if (pendingWalletImports[userId]) {
            return ctx.reply('⚠️ Ya estas en proecso de importar una wallet.');
        }

        // Ask for the private key
        ctx.reply('📝 Ingresa la private key de la wallet a importar:');
        pendingWalletImports[userId] = 'waiting_for_private_key'; // Waiting for private key
        break;
    }
});


/********** Listeners **********/
// import_wallet Private key
// Keep the keys separated in a different object
const userKeys = {}; // To store users' private and public keys

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;

    if (pendingWalletImports[userId] === 'waiting_for_private_key') {
        const privateKey = ctx.message.text;

        try {
            // Decode the private key from Base58
            const secretKey = bs58.decode(privateKey);
            const keypair = Keypair.fromSecretKey(secretKey);
            const publicKey = keypair.publicKey.toBase58();

            // Store the keys in a separate object
            userKeys[userId] = { privateKey, publicKey };

            // Change the import state
            pendingWalletImports[userId] = 'waiting_for_wallet_name';

            // Ask for the wallet name
            ctx.reply('📝 Enter a name for this wallet:');
        } catch (error) {
            console.error('Error importing wallet:', error);
            return ctx.reply('⚠️ The entered private key is not valid. Try again.');
        }
    } else if (pendingWalletImports[userId] === 'waiting_for_wallet_name') {
        const walletName = ctx.message.text;

        // Get the keys from the userKeys object
        const { privateKey, publicKey } = userKeys[userId];

        // Insert the new wallet into the database
        db.run(`INSERT INTO wallets (user_id, wallet_name, public_key, private_key) VALUES (?, ?, ?, ?)`,  [userId, walletName, publicKey, privateKey], (err) => {
            if (err) {
                console.error(err);
                return ctx.reply('⚠️ An error occurred while registering the wallet.');
            }

            // Clear the import state after registering
            delete pendingWalletImports[userId];
            delete userKeys[userId]; // Clear the keys from the userKeys object

            // Confirm the import with the user
            ctx.reply(`✅ Tu wallet fue importada con exito como: *${walletName}*.

🪙 *Public key:* \`${publicKey}\`
🔑 *Private key:* \`${privateKey}\`

⚠️ *IMPORTANT:* Manten tu private key en un lugar seguro.`, { parse_mode: 'Markdown' });
        });
    }
});





bot.launch();
console.log('🚀 Bot working...');