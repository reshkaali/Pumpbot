require('dotenv').config();
const http = require('http');
const { Bot, InlineKeyboard, GrammyError, HttpError } = require('grammy');
const { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('PUMP UP Bot Active');
  res.end();
}).listen(process.env.PORT || 3000);

const token = process.env.BOT_TOKEN;

let rawRpc = (process.env.HELIUS_RPC_URL || '').trim();
if (rawRpc.startsWith('"') && rawRpc.endsWith('"')) {
  rawRpc = rawRpc.substring(1, rawRpc.length - 1);
}
const RPC_URL = (rawRpc.startsWith('http://') || rawRpc.startsWith('https://'))
  ? rawRpc
  : 'https://api.mainnet-beta.solana.com';

const connection = new Connection(RPC_URL, 'confirmed');
const bot = new Bot(token || 'DUMMY_TOKEN');

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Update xətası:`);
  const e = err.error;
  if (e instanceof GrammyError) console.error("Telegram API Xətası:", e.description);
  else if (e instanceof HttpError) console.error("Şəbəkə Xətası:", e);
  else console.error("Bilinməyən Xəta:", e);
});

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encodeBase58(buffer) {
  let digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; j++) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; buffer[i] === 0 && i < buffer.length - 1; i++) digits.push(0);
  return digits.reverse().map(d => ALPHABET[d]).join('');
}

const i18n = {
  AZ: {
    demoBal: "Demo Balansım",
    liveBal: "Live Balansım",
    openPos: "Açıq Pozisiyalarım",
    closedPos: "Qapalı Pozisiyalarım",
    addTarget: "➕ İzlənəcək Ünvan Əlavə Et",
    myTargets: "📋 Ünvanlarım",
    demoWalletBtn: "💵 Demo Cüzdan",
    liveWalletBtn: "💳 Live Cüzdan",
    settingsBtn: "⚙️ Tənzimləmələr",
    langBtn: "🌐 Dil / Language",
    withdrawBtn: "💸 Köçür",
    refreshBtn: "🔄 Refresh",
    enterTargetMsg: "🎯 İzləmək istədiyiniz Pump.fun / Solana cüzdan ünvanını daxil edin:",
    invalidAddr: "❌ Yanlış Solana Ünvanı! Yenidən cəhd edin.",
    noWallets: "Hələ ki real cüzdan yaradılmayıb.",
    activeLbl: "Aktiv",
    selectLbl: "Seç",
    minBuyErr: "⚠️ Minimum alış məbləği 0.005 SOL olmalıdır.",
    enterDemoSol: "💵 Əlavə etmək istədiyiniz Demo SOL məbləğini yazın:"
  }
};

let state = {
  lang: 'AZ',
  mode: 'DEMO',
  demoBalanceSol: 10.0,
  liveWallets: [],
  activeWalletIndex: 0,
  targetWallets: [],
  pendingTarget: null,
  openPositions: [],
  closedPositions: [],
  settings: {
    buyAmountSol: 0.05,
    tpPercent: 100,
    tpEnabled: true,
    slPercent: 30,
    slEnabled: true,
    kingTp: true,
    slippageBps: 200,
    priorityFee: 0.001
  },
  waitingInput: null,
  withdrawTemp: {}
};

function t(key) {
  return i18n['AZ'][key];
}

async function getRealSolBalance(pubkeyStr) {
  try {
    const pubkey = new PublicKey(pubkeyStr);
    const balanceLamports = await connection.getBalance(pubkey);
    return balanceLamports / LAMPORTS_PER_SOL;
  } catch (e) {
    return 0;
  }
}

async function buildMainMenu() {
  const isDemo = state.mode === 'DEMO';
  let activeWalletStr = 'DEMO_ACCOUNT';
  let activeBalSol = state.demoBalanceSol;

  if (!isDemo && state.liveWallets.length > 0) {
    const w = state.liveWallets[state.activeWalletIndex];
    if (w) {
      activeWalletStr = `Cüzdan ${w.id}: ${w.publicKey}`;
      activeBalSol = await getRealSolBalance(w.publicKey);
    }
  }

  let msg = `<b>Demo Balans:</b> ${state.demoBalanceSol.toFixed(2)} SOL\n`;
  msg += `<b>Live Balans:</b> ${activeBalSol.toFixed(4)} SOL\n\n`;
  msg += `<b>PUMP UP BOT TERMINAL</b>`;

  const kb = new InlineKeyboard()
    .text(t('addTarget'), 'action_add_target').row()
    .text(t('demoWalletBtn'), 'view_demo_wallet')
    .text(t('liveWalletBtn'), 'view_live_wallet').row()
    .text(t('refreshBtn'), 'action_refresh');

  return { msg, kb };
}

bot.command('start', async (ctx) => {
  const menu = await buildMainMenu();
  await ctx.reply(menu.msg, { parse_mode: 'HTML', reply_markup: menu.kb });
});

bot.callbackQuery('action_refresh', async (ctx) => {
  await ctx.answerCallbackQuery();
  const menu = await buildMainMenu();
  await ctx.editMessageText(menu.msg, { parse_mode: 'HTML', reply_markup: menu.kb }).catch(() => {});
});

bot.callbackQuery('view_demo_wallet', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(`💵 Demo Balansınız: ${state.demoBalanceSol.toFixed(4)} SOL`);
});

bot.callbackQuery('view_live_wallet', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(`💳 Live Cüzdan menyusu aktivdir.`);
});

bot.callbackQuery('action_add_target', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'target_address';
  await ctx.reply(t('enterTargetMsg'));
});

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (state.waitingInput === 'target_address') {
    try {
      new PublicKey(text);
      state.waitingInput = null;
      await ctx.reply(`✅ Ünvan qəbul edildi: ${text}`);
    } catch (e) {
      await ctx.reply(t('invalidAddr'));
    }
  }
});

async function main() {
  if (!token) {
    console.error('BOT_TOKEN tapılmadı.');
    return;
  }
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  bot.start();
  console.log('BOT UĞURLA İŞƏ DÜŞDÜ!');
}

main().catch(err => console.error(err));
