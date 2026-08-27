require('dotenv').config();
const http = require('http');
const { Bot, InlineKeyboard, GrammyError, HttpError } = require('grammy');
const { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// 1. Render Keep-Alive Server
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
  console.error(`⚠️ Update ${ctx.update.update_id} xətası:`);
  const e = err.error;
  if (e instanceof GrammyError) console.error("Telegram API Xətası:", e.description);
  else if (e instanceof HttpError) console.error("Şəbəkə Xətası:", e);
  else console.error("Bilinməyən Xəta:", e);
});

// Helper: Base58 encoder (bs58 asılılığını aradan qaldırmaq üçün)
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

// 2. Çoxdilli Sözlük (Dictionary)
const i18n = {
  EN: {
    demoBal: "Demo Balance",
    liveBal: "Live Balance",
    openPos: "Open Positions",
    closedPos: "Closed Positions",
    addTarget: "➕ Add Target Address",
    myTargets: "📋 My Addresses",
    demoWalletBtn: "💵 Demo Wallet",
    liveWalletBtn: "💳 Live Wallet",
    settingsBtn: "⚙️ Settings",
    langBtn: "🌐 Language",
    withdrawBtn: "💸 Transfer",
    refreshBtn: "🔄 Refresh",
    enterTargetMsg: "🎯 Please enter the Solana target wallet address to copy-trade:",
    invalidAddr: "❌ Invalid Solana Address! Try again.",
    noWallets: "No wallets created yet.",
    activeLbl: "Active",
    selectLbl: "Select",
    minBuyErr: "⚠️ Minimum buy amount must be 0.005 SOL (gas fees included).",
    enterDemoSol: "💵 Enter the amount of Demo SOL you want to add (e.g. 5.5):"
  },
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
    minBuyErr: "⚠️ Minimum alış məbləği 0.005 SOL olmalıdır (komissiya daxil).",
    enterDemoSol: "💵 Əlavə etmək istədiyiniz Demo SOL məbləğini yazın (məs: 5.5):"
  },
  TR: {
    demoBal: "Demo Bakiye",
    liveBal: "Canlı Bakiye",
    openPos: "Açık Pozisyonlar",
    closedPos: "Kapalı Pozisyonlar",
    addTarget: "➕ Takip Adresi Ekle",
    myTargets: "📋 Adreslerim",
    demoWalletBtn: "💵 Demo Cüzdan",
    liveWalletBtn: "💳 Canlı Cüzdan",
    settingsBtn: "⚙️ Ayarlar",
    langBtn: "🌐 Dil Seçimi",
    withdrawBtn: "💸 Transfer",
    refreshBtn: "🔄 Yenile",
    enterTargetMsg: "🎯 Takip etmek istediğiniz Solana cüzdan adresini girin:",
    invalidAddr: "❌ Geçersiz Solana Adresi! Tekrar deneyin.",
    noWallets: "Henüz canlı cüzdan oluşturulmadı.",
    activeLbl: "Aktif",
    selectLbl: "Seç",
    minBuyErr: "⚠️ Minimum alım miktarı 0.005 SOL olmalıdır (gas dahil).",
    enterDemoSol: "💵 Eklemek istediğiniz Demo SOL miktarını yazın:"
  },
  RU: {
    demoBal: "Демо Баланс",
    liveBal: "Live Баланс",
    openPos: "Открытые Позиции",
    closedPos: "Закрытые Позиции",
    addTarget: "➕ Добавить Адрес",
    myTargets: "📋 Мои Адреса",
    demoWalletBtn: "💵 Демо Кошелек",
    liveWalletBtn: "💳 Live Кошелек",
    settingsBtn: "⚙️ Настройки",
    langBtn: "🌐 Выбор Языка",
    withdrawBtn: "💸 Перевод",
    refreshBtn: "🔄 Обновить",
    enterTargetMsg: "🎯 Введите целевой Solana адрес для копи-трейдинга:",
    invalidAddr: "❌ Неверный адрес Solana! Попробуйте снова.",
    noWallets: "Живые кошельки еще не созданы.",
    activeLbl: "Активен",
    selectLbl: "Выбрать",
    minBuyErr: "⚠️ Мин. сумма покупки 0.005 SOL (включая комиссию).",
    enterDemoSol: "💵 Введите сумму Demo SOL для добавления:"
  }
};

// 3. Qlobal Vəziyyət (State)
let state = {
  lang: 'AZ',
  mode: 'DEMO',
  demoBalanceSol: 10.0,
  liveWallets: [],
  activeWalletIndex: 0,
  targetWallets: [],
  pendingTarget: null,
  openPositions: [
    {
      id: 'p1',
      tokenName: 'PumpCat (PCAT)',
      address: '7xKXtg2CW87d97TXJSDpbD5jBk49s22P1p5b',
      img: '🐱',
      boughtSol: 0.1,
      pnlUsd: 24.50,
      pnlPercent: 45.0,
      pumpFunLink: 'https://pump.fun/7xKXtg2CW87d97TXJSDpbD5jBk49s22P1p5b',
      marketCap: '$120K',
      kingTpTriggered: false
    }
  ],
  closedPositions: [
    { id: 'c1', tokenName: 'SOL Ape (SAPE)', pnlUsd: 15.20, pnlPercent: 30.0 },
    { id: 'c2', tokenName: 'MoonDog (MDOG)', pnlUsd: -5.40, pnlPercent: -12.0 }
  ],
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
  return i18n[state.lang][key] || i18n['AZ'][key];
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

// 4. Əsas Menyu Generatoru
async function buildMainMenu() {
  const isDemo = state.mode === 'DEMO';
  let activeWalletStr = 'DEMO_ACCOUNT';
  let activeBalSol = state.demoBalanceSol;

  if (!isDemo && state.liveWallets.length > 0) {
    const w = state.liveWallets[state.activeWalletIndex];
    if (w) {
      activeWalletStr = `Cüzdan ${w.id}: <code>${w.publicKey}</code>`;
      activeBalSol = await getRealSolBalance(w.publicKey);
    }
  }

  const solPriceUsd = 185.0;
  const usdBal = (activeBalSol * solPriceUsd).toFixed(2);
  const totalOpenSol = state.openPositions.reduce((acc, p) => acc + p.boughtSol, 0).toFixed(2);

  let msg = `<b>${t('demoBal')}:</b> ${state.demoBalanceSol.toFixed(2)} SOL\n`;
  msg += `<b>Live Cüzdan ${isDemo ? '' : (state.activeWalletIndex + 1)}:</b> ${activeWalletStr}\n`;
  msg += `<b>${t('liveBal')}:</b> ${activeBalSol.toFixed(4)} SOL ($${usdBal})\n`;
  msg += `<b>${t('openPos')}:</b> ${totalOpenSol} SOL\n\n`;
  msg += `⚡ <b>PUMP UP COPY-BOT TERMINAL</b>`;

  const kb = new InlineKeyboard()
    .text(t('addTarget'), 'action_add_target')
    .text(t('myTargets'), 'action_list_targets').row()
    .text(isDemo ? 'Demo 🟢' : 'Demo ⚪', 'set_mode_demo')
    .text(!isDemo ? 'Live 🟢' : 'Live ⚪', 'set_mode_live').row()
    .text(t('demoWalletBtn'), 'view_demo_wallet')
    .text(t('liveWalletBtn'), 'view_live_wallet').row()
    .text(t('openPos'), 'view_open_pos')
    .text(t('closedPos'), 'view_closed_pos').row()
    .text(t('settingsBtn'), 'view_settings')
    .text(t('langBtn'), 'view_language').row()
    .text(t('withdrawBtn'), 'action_withdraw')
    .text(t('refreshBtn'), 'action_refresh');

  return { msg, kb };
}

// 5. Bot Əmrləri Və Hadisələr
bot.command('start', async (ctx) => {
  const menu = await buildMainMenu();
  await ctx.reply(menu.msg, { parse_mode: 'HTML', reply_markup: menu.kb });
});

bot.callbackQuery('action_refresh', async (ctx) => {
  await ctx.answerCallbackQuery();
  const menu = await buildMainMenu();
  await ctx.editMessageText(menu.msg, { parse_mode: 'HTML', reply_markup: menu.kb }).catch(() => {});
});

bot.callbackQuery('set_mode_demo', async (ctx) => {
  state.mode = 'DEMO';
  await ctx.answerCallbackQuery('Demo Mode Activated');
  const menu = await buildMainMenu();
  await ctx.editMessageText(menu.msg, { parse_mode: 'HTML', reply_markup: menu.kb }).catch(() => {});
});

bot.callbackQuery('set_mode_live', async (ctx) => {
  state.mode = 'LIVE';
  await ctx.answerCallbackQuery('Live Mainnet Mode Activated');
  const menu = await buildMainMenu();
  await ctx.editMessageText(menu.msg, { parse_mode: 'HTML', reply_markup: menu.kb }).catch(() => {});
});

bot.callbackQuery('view_demo_wallet', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'add_demo_sol_amount';
  const kb = new InlineKeyboard().text('⬅️ Menu', 'action_refresh');
  await ctx.reply(`💵 <b>Demo SOL Balansınız:</b> ${state.demoBalanceSol.toFixed(4)} SOL\n\n${t('enterDemoSol')}`, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery('view_live_wallet', async (ctx) => {
  await ctx.answerCallbackQuery();
  await renderLiveWalletsMenu(ctx);
});

async function renderLiveWalletsMenu(ctx) {
  let msg = `💳 <b>Şəxsi Live Solana Cüzdanları (Maksimum 5):</b>\n\n`;
  const kb = new InlineKeyboard();

  if (state.liveWallets.length === 0) {
    msg += `<i>${t('noWallets')}</i>\n\n`;
  } else {
    for (let i = 0; i < state.liveWallets.length; i++) {
      const w = state.liveWallets[i];
      const bal = await getRealSolBalance(w.publicKey);
      const isActive = (i === state.activeWalletIndex);

      msg += `${isActive ? '🟢' : '⚪'} <b>Cüzdan ${w.id}:</b> <code>${w.publicKey}</code>\n`;
      msg += `Balans: <b>${bal.toFixed(4)} SOL</b>\n`;
      msg += `🔑 Private Key: <code>${w.privateKey}</code>\n\n`;

      kb.text(`Cüzdan ${w.id} ${isActive ? '✅ (' + t('activeLbl') + ')' : '🔘 ' + t('selectLbl')}`, `activate_wallet_${i}`).row();
    }
  }

  if (state.liveWallets.length < 5) {
    kb.text('➕ Real Pulqabı Yarat', 'create_real_wallet').row();
  }
  kb.text('⬅️ Menu', 'action_refresh');

  await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
}

bot.callbackQuery('create_real_wallet', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (state.liveWallets.length >= 5) return ctx.reply('❌ Maksimum 5 cüzdan yarada bilərsiniz!');

  const kp = Keypair.generate();
  const newW = {
    id: state.liveWallets.length + 1,
    publicKey: kp.publicKey.toBase58(),
    privateKey: encodeBase58(Buffer.from(kp.secretKey))
  };

  state.liveWallets.push(newW);
  await ctx.reply(`✅ <b>Yeni Live Cüzdan ${newW.id} Yaradıldı!</b>\n\nAdres: <code>${newW.publicKey}</code>\nPrivate Key: <code>${newW.privateKey}</code>`, { parse_mode: 'HTML' });
  await renderLiveWalletsMenu(ctx);
});

bot.callbackQuery(/^activate_wallet_(\d+)$/, async (ctx) => {
  const idx = parseInt(ctx.match[1]);
  state.activeWalletIndex = idx;
  await ctx.answerCallbackQuery(`Cüzdan ${idx + 1} aktiv edildi!`);
  await renderLiveWalletsMenu(ctx);
});

bot.callbackQuery('action_add_target', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'target_address';
  await ctx.reply(t('enterTargetMsg'));
});

bot.callbackQuery('action_list_targets', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (state.targetWallets.length === 0) return ctx.reply('📋 Hələ heç bir izlənən ünvan təsdiqlənməyib.');

  let msg = `📋 <b>İzlənən Pump.fun Ünvanları:</b>\n\n`;
  const kb = new InlineKeyboard();

  state.targetWallets.forEach((target, idx) => {
    msg += `${idx + 1}. <b>${target.username}</b>\nPNL: <b>+$${target.pnlUsd} USD</b>\n\n`;
    kb.text(`❌ (x) ${target.username}`, `delete_target_prompt_${idx}`).row();
  });

  kb.text('⬅️ Menu', 'action_refresh');
  await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery(/^delete_target_prompt_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const idx = parseInt(ctx.match[1]);
  const target = state.targetWallets[idx];

  const kb = new InlineKeyboard()
    .text('✅ Bəli, Sil', `confirm_delete_target_${idx}`)
    .text('❌ Ləğv Et', 'action_list_targets');

  await ctx.reply(`⚠️ <b>${target.username}</b> ünvanını silmək istədiyinizdən əminsiniz?`, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery(/^confirm_delete_target_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const idx = parseInt(ctx.match[1]);
  const removed = state.targetWallets.splice(idx, 1);
  await ctx.reply(`✅ <b>${removed[0]?.username || 'Ünvan'}</b> izləmədən silindi!`, { parse_mode: 'HTML' });
});

bot.callbackQuery('view_open_pos', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (state.openPositions.length === 0) return ctx.reply('📈 Açıq pozisiyanız yoxdur.');

  let msg = `📈 <b>Açıq Pozisiyaların Siyahısı:</b>\n\n`;
  const kb = new InlineKeyboard();

  state.openPositions.forEach((pos, idx) => {
    msg += `${idx + 1}. ${pos.img} <b>${pos.tokenName}</b> — PNL: <b>+$${pos.pnlUsd} (${pos.pnlPercent}%)</b>\n`;
    kb.text(`🔍 ${pos.tokenName} Ətraflı`, `open_pos_detail_${idx}`).row();
  });

  kb.text('⬅️ Menu', 'action_refresh');
  await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery(/^open_pos_detail_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const idx = parseInt(ctx.match[1]);
  const pos = state.openPositions[idx];
  if (!pos) return;

  let msg = `${pos.img} <b>${pos.tokenName}</b>\n\n`;
  msg += `<b>Meqalə Adresi:</b> <code>${pos.address}</code>\n`;
  msg += `<b>Alış Məbləği:</b> ${pos.boughtSol} SOL\n`;
  msg += `<b>Mövcud PnL:</b> +$${pos.pnlUsd} (${pos.pnlPercent}%)\n`;
  msg += `<b>Market Cap:</b> ${pos.marketCap}\n`;
  msg += `<b>Pump.fun Linki:</b> ${pos.pumpFunLink}\n\n`;
  msg += `King TP Status: ${pos.kingTpTriggered ? '🟢 Çıxarılıb' : '⚪ Gözləyir'}`;

  const kb = new InlineKeyboard()
    .text('🔴 Əllə Sat (Manual Sell)', `sell_pos_${idx}`).row()
    .text('⬅️ Pozisiyalar', 'view_open_pos');

  await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery(/^sell_pos_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const idx = parseInt(ctx.match[1]);
  const sold = state.openPositions.splice(idx, 1)[0];
  if (sold) {
    state.closedPositions.unshift({
      id: sold.id,
      tokenName: sold.tokenName,
      pnlUsd: sold.pnlUsd,
      pnlPercent: sold.pnlPercent
    });
    await ctx.reply(`✅ <b>${sold.tokenName}</b> pozisiyası əllə uğurla satıldı!`, { parse_mode: 'HTML' });
  }
});

bot.callbackQuery('view_closed_pos', async (ctx) => {
  await ctx.answerCallbackQuery();
  let msg = `📉 <b>Qapalı Pozisiyalar (Son 30 Alqı-Satqı):</b>\n\n`;
  
  const last30 = state.closedPositions.slice(0, 30);
  if (last30.length === 0) msg += `<i>Hələ ki qapalı pozisiya yoxdur.</i>`;

  last30.forEach((p, i) => {
    msg += `${i + 1}. <b>${p.tokenName}</b> — PNL: <b>${p.pnlUsd >= 0 ? '+' : ''}$${p.pnlUsd} USD (${p.pnlPercent}%)</b>\n`;
  });

  const kb = new InlineKeyboard().text('⬅️ Menu', 'action_refresh');
  await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
});

// TƏNZİMLƏMƏLƏR MENYUSU
async function renderSettingsMenu(ctx) {
  const s = state.settings;
  let msg = `⚙️ <b>PUMP UP | Copy-Trade Ayarları:</b>\n\n`;
  msg += `🔹 <b>Hər Alış Məbləği:</b> ${s.buyAmountSol} SOL\n`;
  msg += `🎯 <b>Take Profit (TP):</b> ${s.tpEnabled ? s.tpPercent + '%' : '🔴 DEAKTİV (OFF)'}\n`;
  msg += `🛑 <b>Stop Loss (SL):</b> ${s.slEnabled ? s.slPercent + '%' : '🔴 DEAKTİV (OFF)'}\n`;
  msg += `👑 <b>King TP:</b> ${s.kingTp ? '🟢 AKTİV' : '🔴 DEAKTİV'}\n`;
  msg += `⚡ <b>Priority Fee:</b> ${s.priorityFee} SOL\n`;
  msg += `🔄 <b>Slippage:</b> ${s.slippageBps / 100}%\n`;

  const kb = new InlineKeyboard()
    .text(`✏️ Alış Məbləği: ${s.buyAmountSol} SOL`, 'set_buy_amount').row()
    .text(s.tpEnabled ? `🎯 TP: ${s.tpPercent}% 🟢` : '🎯 TP: DEAKTİV 🔴', 'toggle_tp')
    .text('✏️ TP Faiz', 'set_tp_val').row()
    .text(s.slEnabled ? `🛑 SL: ${s.slPercent}% 🟢` : '🛑 SL: DEAKTİV 🔴', 'toggle_sl')
    .text('✏️ SL Faiz', 'set_sl_val').row()
    .text(s.kingTp ? '👑 King TP: Aktiv 🟢' : '👑 King TP: Deaktiv 🔴', 'toggle_king_tp').row()
    .text(`⚡ Priority Fee: ${s.priorityFee} SOL`, 'set_prio_fee')
    .text(`🔄 Slippage: ${s.slippageBps / 100}%`, 'set_slippage').row()
    .text('⬅️ Menu', 'action_refresh');

  if (ctx.callbackQuery) {
    await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: kb }).catch(() => ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb }));
  } else {
    await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
  }
}

bot.callbackQuery('view_settings', async (ctx) => {
  await ctx.answerCallbackQuery();
  await renderSettingsMenu(ctx);
});

bot.callbackQuery('toggle_tp', async (ctx) => {
  state.settings.tpEnabled = !state.settings.tpEnabled;
  await ctx.answerCallbackQuery();
  await renderSettingsMenu(ctx);
});

bot.callbackQuery('set_tp_val', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'set_tp_val';
  await ctx.reply('🎯 Yeni <b>Take Profit (TP)</b> faizini yazın (məs: 50 və ya 100):', { parse_mode: 'HTML' });
});

bot.callbackQuery('toggle_sl', async (ctx) => {
  state.settings.slEnabled = !state.settings.slEnabled;
  await ctx.answerCallbackQuery();
  await renderSettingsMenu(ctx);
});

bot.callbackQuery('set_sl_val', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'set_sl_val';
  await ctx.reply('🛑 Yeni <b>Stop Loss (SL)</b> faizini yazın (məs: 20 və ya 30):', { parse_mode: 'HTML' });
});

bot.callbackQuery('toggle_king_tp', async (ctx) => {
  state.settings.kingTp = !state.settings.kingTp;
  await ctx.answerCallbackQuery();
  await renderSettingsMenu(ctx);
});

bot.callbackQuery('set_buy_amount', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'change_buy_amount';
  await ctx.reply('✏️ Hər alqı-satqı üçün qoyulacaq SOL məbləğini yazın (məs: 0.05):');
});

bot.callbackQuery('set_prio_fee', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'set_prio_fee';
  await ctx.reply('⚡ İstədiyiniz <b>Priority Fee</b> məbləğini SOL ilə daxil edin (məs: 0.002):', { parse_mode: 'HTML' });
});

bot.callbackQuery('set_slippage', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'set_slippage';
  await ctx.reply('🔄 İstədiyiniz <b>Slippage</b> faizini daxil edin (məs: 2.5 və ya 5):', { parse_mode: 'HTML' });
});

bot.callbackQuery('view_language', async (ctx) => {
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard()
    .text('🇬🇧 English', 'set_lang_EN')
    .text('🇦🇿 Azərbaycan', 'set_lang_AZ').row()
    .text('🇹🇷 Türkçe', 'set_lang_TR')
    .text('🇷🇺 Русский', 'set_lang_RU').row()
    .text('⬅️ Menu', 'action_refresh');
  await ctx.reply('🌐 <b>Zəhmət olmasa dili seçin / Select language:</b>', { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery(/^set_lang_(EN|AZ|TR|RU)$/, async (ctx) => {
  state.lang = ctx.match[1];
  await ctx.answerCallbackQuery(`Language set to ${state.lang}`);
  const menu = await buildMainMenu();
  await ctx.reply(`✅ Dil dəyişdirildi / Language changed: <b>${state.lang}</b>`, { parse_mode: 'HTML' });
  await ctx.reply(menu.msg, { parse_mode: 'HTML', reply_markup: menu.kb });
});

bot.callbackQuery('action_withdraw', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'withdraw_addr';
  await ctx.reply('
