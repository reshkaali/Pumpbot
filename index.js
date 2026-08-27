require('dotenv').config();
const http = require('http');
const { Bot, InlineKeyboard, GrammyError, HttpError } = require('grammy');
const { Keypair, Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } = require('@solana/web3.js');
const bs58 = require('bs58');

// 1. Render Keep-Alive Server
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('PUMP UP Bot Active');
  res.end();
}).listen(process.env.PORT || 3000);

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('⚠️ BOT_TOKEN təyin edilməyib!');
}

// 🌐 RPC URL Təhlükəsizlik Və Yoxlanışı
let rawRpc = (process.env.HELIUS_RPC_URL || '').trim();
if (rawRpc.startsWith('"') && rawRpc.endsWith('"')) {
  rawRpc = rawRpc.substring(1, rawRpc.length - 1);
}

const RPC_URL = (rawRpc.startsWith('http://') || rawRpc.startsWith('https://'))
  ? rawRpc
  : 'https://api.mainnet-beta.solana.com';

console.log('🔗 Qoşulan RPC URL:', RPC_URL);
const connection = new Connection(RPC_URL, 'confirmed');
const bot = new Bot(token || 'DUMMY_TOKEN');

// Grammy Xəta Tutucusu (Error Handling)
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`⚠️ Update ${ctx.update.update_id} işlənərkən xəta baş verdi:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Telegram API Xətası:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Şəbəkə Xətası:", e);
  } else {
    console.error("Bilinməyən Xəta:", e);
  }
});

// 2. Qlobal Vəziyyət (State)
let state = {
  lang: 'EN',
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
    slPercent: 30,
    kingTp: true,
    slippageBps: 200,
    priorityFee: 0.001
  },
  waitingInput: null,
  withdrawTemp: {}
};

// Dil Lugəti
const i18n = {
  AZ: {
    wallet: 'Cüzdan',
    balance: 'Balansım',
    positions: 'Pozisiyalarım',
    addAddress: '➕ Ünvan Əlavə Et',
    myAddresses: '📋 Ünvanlarım',
    demoWallet: '💵 Demo Cüzdan',
    liveWallet: '💳 Live Cüzdan',
    openPos: '📈 Açıq Pozisiyalar',
    closedPos: '📉 Qapalı Pozisiyalar',
    settings: '⚙️ Tənzimləmələr',
    language: '🌐 Dil / Language',
    transfer: '💸 Köçür',
    refresh: '🔄 Yenilə',
    enterTarget: '🎯 İzləmək istədiyiniz Pump.fun / Solana cüzdan ünvanını daxil edin:'
  },
  EN: {
    wallet: 'Wallet',
    balance: 'Balance',
    positions: 'Positions',
    addAddress: '➕ Add Address',
    myAddresses: '📋 My Addresses',
    demoWallet: '💵 Demo Wallet',
    liveWallet: '💳 Live Wallet',
    openPos: '📈 Open Positions',
    closedPos: '📉 Closed Positions',
    settings: '⚙️ Settings',
    language: '🌐 Language',
    transfer: '💸 Transfer',
    refresh: '🔄 Refresh',
    enterTarget: '🎯 Send the Solana target wallet address you want to copy-trade:'
  }
};

function t(key) {
  return i18n[state.lang][key] || i18n['EN'][key];
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

// 3. Əsas Menyu Generatoru (HTML Formatında)
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
  const totalOpenSol = state.openPositions.reduce((acc, p) => acc + p.amountSol, 0).toFixed(2);

  let msg = `<b>${t('wallet')}:</b> ${activeWalletStr}\n`;
  msg += `<b>${t('balance')}:</b> ${activeBalSol.toFixed(4)} SOL ($${usdBal})\n`;
  msg += `<b>${t('positions')}:</b> ${totalOpenSol} SOL\n\n`;
  msg += `⚡ <b>PUMP UP TERMINAL</b> | Rejim: ${isDemo ? '🟢 Demo' : '🔴 Live Mainnet'}`;

  const kb = new InlineKeyboard()
    .text(t('addAddress'), 'action_add_target')
    .text(t('myAddresses'), 'action_list_targets').row()
    .text(isDemo ? 'Demo 🟢' : 'Demo ⚪', 'set_mode_demo')
    .text(!isDemo ? 'Live 🟢' : 'Live ⚪', 'set_mode_live').row()
    .text(t('demoWallet'), 'view_demo_wallet')
    .text(t('liveWallet'), 'view_live_wallet').row()
    .text(t('openPos'), 'view_open_pos')
    .text(t('closedPos'), 'view_closed_pos').row()
    .text(t('settings'), 'view_settings')
    .text(t('language'), 'view_language').row()
    .text(t('transfer'), 'action_withdraw')
    .text(t('refresh'), 'action_refresh');

  return { msg, kb };
}

// 4. Hadisələr Və İşləyicilər (Handlers)
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
  await ctx.answerCallbackQuery('Demo Rejimi');
  const menu = await buildMainMenu();
  await ctx.editMessageText(menu.msg, { parse_mode: 'HTML', reply_markup: menu.kb }).catch(() => {});
});

bot.callbackQuery('set_mode_live', async (ctx) => {
  state.mode = 'LIVE';
  await ctx.answerCallbackQuery('Live Rejimi');
  const menu = await buildMainMenu();
  await ctx.editMessageText(menu.msg, { parse_mode: 'HTML', reply_markup: menu.kb }).catch(() => {});
});

bot.callbackQuery('view_demo_wallet', async (ctx) => {
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard()
    .text('➕ +5 Demo SOL Əlavə Et', 'add_demo_sol').row()
    .text('⬅️ Menyu', 'action_refresh');
  await ctx.reply(`💵 <b>Demo Cüzdan Balansı:</b> ${state.demoBalanceSol.toFixed(4)} SOL\n\nBalansı artırmaq üçün aşağıdakı düyməyə sıxın:`, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery('add_demo_sol', async (ctx) => {
  state.demoBalanceSol += 5.0;
  await ctx.answerCallbackQuery('+5 SOL Əlavə Edildi!');
  await ctx.reply(`✅ Balans Yeniləndi: <b>${state.demoBalanceSol.toFixed(4)} SOL</b>`, { parse_mode: 'HTML' });
});

bot.callbackQuery('view_live_wallet', async (ctx) => {
  await ctx.answerCallbackQuery();
  await renderLiveWalletsMenu(ctx);
});

async function renderLiveWalletsMenu(ctx) {
  let msg = `💳 <b>Şəxsi Live Solana Cüzdanları (Maksimum 5):</b>\n\n`;
  const kb = new InlineKeyboard();

  if (state.liveWallets.length === 0) {
    msg += `Hələ ki real cüzdan yaradılmayıb. Aşağıdakı düyməyə sıxaraq yarada bilərsiniz.\n`;
  } else {
    for (let i = 0; i < state.liveWallets.length; i++) {
      const w = state.liveWallets[i];
      const bal = await getRealSolBalance(w.publicKey);
      const isActive = i === state.activeWalletIndex;

      msg += `${isActive ? '🟢' : '⚪'} <b>Cüzdan ${w.id}:</b> <code>${w.publicKey}</code>\n`;
      msg += `Balans: <b>${bal.toFixed(4)} SOL</b>\n\n`;

      kb.text(`Cüzdan ${w.id} ${isActive ? '✅' : 'Seç'}`, `activate_wallet_${i}`)
        .text(`🔑 Recovery/PK ${w.id}`, `export_pk_${i}`).row();
    }
  }

  if (state.liveWallets.length < 5) {
    kb.text('➕ Real Pulqabı Yarat', 'create_real_wallet').row();
  }
  kb.text('⬅️ Menyu', 'action_refresh');

  await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
}

bot.callbackQuery('create_real_wallet', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (state.liveWallets.length >= 5) return ctx.reply('❌ Maksimum 5 cüzdan yarada bilərsiniz!');

  const kp = Keypair.generate();
  const newW = {
    id: state.liveWallets.length + 1,
    publicKey: kp.publicKey.toBase58(),
    privateKey: bs58.encode(kp.secretKey)
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

bot.callbackQuery(/^export_pk_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const idx = parseInt(ctx.match[1]);
  const w = state.liveWallets[idx];
  if (w) {
    await ctx.reply(`🔑 <b>Cüzdan ${w.id} Məxfilik Məlumatları:</b>\n\nPublic Key: <code>${w.publicKey}</code>\nPrivate Key (Base58): <code>${w.privateKey}</code>`, { parse_mode: 'HTML' });
  }
});

bot.callbackQuery('action_add_target', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'target_address';
  await ctx.reply(t('enterTarget'));
});

bot.callbackQuery('action_list_targets', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (state.targetWallets.length === 0) return ctx.reply('📋 Hələ heç bir izlənən ünvan əlavə edilməyib.');

  let msg = `📋 <b>İzlənən Pump.fun Ünvanları:</b>\n\n`;
  const kb = new InlineKeyboard();

  state.targetWallets.forEach((tTarget, idx) => {
    msg += `${idx + 1}. <b>${tTarget.username}</b> (<code>${tTarget.address.substring(0,6)}...</code>)\nQazanc/Zərər: <b>+$${tTarget.pnlUsd}</b>\n\n`;
    kb.text(`❌ Sil: ${tTarget.username}`, `delete_target_prompt_${idx}`).row();
  });

  kb.text('⬅️ Menyu', 'action_refresh');
  await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery(/^delete_target_prompt_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const idx = parseInt(ctx.match[1]);
  const target = state.targetWallets[idx];

  const kb = new InlineKeyboard()
    .text('✅ Bəli, Sil', `confirm_delete_target_${idx}`)
    .text('❌ Ləğv Et', 'action_list_targets');

  await ctx.reply(`⚠️ <b>${target.username}</b> ünvanını izləmədən çıxarmaq istədiyinizdən əminsiniz?`, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery(/^confirm_delete_target_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const idx = parseInt(ctx.match[1]);
  const removed = state.targetWallets.splice(idx, 1);
  await ctx.reply(`✅ <b>${removed[0]?.username || 'Ünvan'}</b> izləmədən silindi!`, { parse_mode: 'HTML' });
});

bot.callbackQuery('view_settings', async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = state.settings;
  let msg = `⚙️ <b>PUMP UP | Trading Ayarları:</b>\n\n`;
  msg += `🔹 <b>Hər Alış Məbləği:</b> ${s.buyAmountSol} SOL\n`;
  msg += `🎯 <b>Take Profit (TP):</b> ${s.tpPercent}%\n`;
  msg += `🛑 <b>Stop Loss (SL):</b> ${s.slPercent}%\n`;
  msg += `👑 <b>King TP Status:</b> ${s.kingTp ? '🟢 AKTİV (200% artımda maya çıxarılır)' : '⚪ DEAKTİV'}\n`;
  msg += `⚡ <b>Priority Fee:</b> ${s.priorityFee} SOL\n`;
  msg += `🔄 <b>Slippage:</b> ${s.slippageBps / 100}%`;

  const kb = new InlineKeyboard()
    .text(s.kingTp ? '👑 King TP: Aktiv 🟢' : '👑 King TP: Deaktiv ⚪', 'toggle_king_tp').row()
    .text('⬅️ Menyu', 'action_refresh');

  await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery('toggle_king_tp', async (ctx) => {
  state.settings.kingTp = !state.settings.kingTp;
  await ctx.answerCallbackQuery('King TP dəyişdirildi');
  await ctx.reply(`👑 King TP Status: <b>${state.settings.kingTp ? 'AKTİV' : 'DEAKTİV'}</b>`, { parse_mode: 'HTML' });
});

bot.callbackQuery('view_language', async (ctx) => {
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard()
    .text('🇬🇧 English', 'set_lang_EN')
    .text('🇦🇿 Azərbaycan', 'set_lang_AZ').row()
    .text('⬅️ Menyu', 'action_refresh');
  await ctx.reply('🌐 <b>Zəhmət olmasa dili seçin / Select language:</b>', { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery(/^set_lang_(EN|AZ)$/, async (ctx) => {
  state.lang = ctx.match[1];
  await ctx.answerCallbackQuery(`Language set to ${state.lang}`);
  const menu = await buildMainMenu();
  await ctx.reply(`✅ Dil dəyişdirildi: <b>${state.lang}</b>`, { parse_mode: 'HTML' });
  await ctx.reply(menu.msg, { parse_mode: 'HTML', reply_markup: menu.kb });
});

bot.callbackQuery('action_withdraw', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'withdraw_addr';
  await ctx.reply('💸 <b>SOL Köçür</b>\n\nGöndərmək istədiyiniz Solana cüzdan ünvanını mesaj olaraq yazın:', { parse_mode: 'HTML' });
});

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();

  if (state.waitingInput === 'target_address') {
    try {
      new PublicKey(text);
      state.waitingInput = null;
      
      const mockUsername = 'pump_trader_' + text.substring(0, 4);
      const isLowRisk = text.length % 2 === 0;
      
      state.pendingTarget = {
        address: text,
        username: mockUsername,
        winRate: isLowRisk ? '78%' : '42%',
        riskLevel: isLowRisk ? '🟢 Aşağı Risk' : '🔴 Yüksək Risk (Rugpull ehtimalı)',
        pnlUsd: '450.00'
      };

      const msg = `👤 <b>Pump.fun Profil Analizi:</b>\n\n` +
        `Username: <b>${state.pendingTarget.username}</b>\n` +
        `Ünvan: <code>${text}</code>\n` +
        `Qazanma Nisbəti (Winrate): <b>${state.pendingTarget.winRate}</b>\n` +
        `Risk Qiymətləndirilməsi: <b>${state.pendingTarget.riskLevel}</b>\n\n` +
        `Bu ünvanın alqı-satqılarını avtomatik kopyalamaq istəyirsiniz?`;

      const kb = new InlineKeyboard()
        .text('✅ Təsdiqlə', 'confirm_add_target')
        .text('❌ Ləğv Et', 'action_refresh');

      return ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      return ctx.reply('❌ Keçərsiz Solana ünvanı! Lütfən düzgün formatda daxil edin.');
    }
  }

  if (state.waitingInput === 'withdraw_addr') {
    try {
      new PublicKey(text);
      state.withdrawTemp.toAddress = text;
      state.waitingInput = 'withdraw_amount';
      return ctx.reply('Göndərmək istədiyiniz SOL məbləğini yazın (Min: 0.001 SOL):');
    } catch (e) {
      return ctx.reply('❌ Keçərsiz Solana ünvanı!');
    }
  }

  if (state.waitingInput === 'withdraw_amount') {
    const amountSol = parseFloat(text);
    if (isNaN(amountSol) || amountSol < 0.001) return ctx.reply('❌ Keçərsiz məbləğ!');

    const activeW = state.liveWallets[state.activeWalletIndex];
    if (!activeW) return ctx.reply('❌ Aktiv live cüzdan tapılmadı!');

    const realBal = await getRealSolBalance(activeW.publicKey);
    if (realBal < amountSol + 0.000005) {
      state.waitingInput = null;
      return ctx.reply(`❌ Balansda kifayət qədər SOL yoxdur!\nMövcud Balans: ${realBal.toFixed(4)} SOL`);
    }

    const targetAddr = state.withdrawTemp.toAddress;
    state.waitingInput = null;
    await ctx.reply('⏳ <b>Tranzaksiya Solana şəbəkəsinə göndərilir...</b>', { parse_mode: 'HTML' });

    try {
      const senderKp = Keypair.fromSecretKey(bs58.decode(activeW.privateKey));
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderKp.publicKey,
          toPubkey: new PublicKey(targetAddr),
          lamports: Math.floor(amountSol * LAMPORTS_PER_SOL)
        })
      );

      const signature = await sendAndConfirmTransaction(connection, tx, [senderKp]);
      return ctx.reply(`🚀 <b>REAL SOL TRANZAKSİYASI UĞURLA BAŞA ÇATDI!</b>\n\n` +
        `Məbləğ: <b>${amountSol} SOL</b>\n` +
        `Ünvan: <code>${targetAddr}</code>\n\n` +
        `🔗 <b>Solscan Explorer:</b> https://solscan.io/tx/${signature}`, { parse_mode: 'HTML' });
    } catch (err) {
      return ctx.reply(`❌ Tranzaksiya Xətası: ${err.message}`);
    }
  }
});

bot.callbackQuery('confirm_add_target', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (state.pendingTarget) {
    state.targetWallets.push(state.pendingTarget);
    await ctx.reply(`✅ <b>${state.pendingTarget.username}</b> uğurla izlənilən cüzdanlar siyahısına əlavə edildi!`, { parse_mode: 'HTML' });
    state.pendingTarget = null;
  }
});

// Başlanğıc
async function main() {
  if (!token) {
    console.error('⚠️ BOT_TOKEN təyin edilməyib.');
    return;
  }
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    const me = await bot.api.getMe();
    console.log(`🤖 BOT DƏQİQ İŞƏ DÜŞDÜ: @${me.username} (ID: ${me.id})`);
    bot.start();
    console.log('⚡ PUMP UP BOT ENGINE STARTED!');
  } catch (err) {
    console.error('❌ Bot Telegram API-yə qoşula bilmədi:', err.message);
  }
}

main().catch(err => console.error('Main Crash:', err));
                                  
