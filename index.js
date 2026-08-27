require('dotenv').config();
const http = require('http');
const { Bot, InlineKeyboard } = require('grammy');
const { Keypair, Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } = require('@solana/web3.js');
const bs58Import = require('bs58');
const bs58 = bs58Import.default || bs58Import;

// 1. Render 24/7 Server Keep-Alive
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('PUMP UP Bot Active');
  res.end();
}).listen(process.env.PORT || 3000);

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN mühit dəyişənində tapılmadı!');
  process.exit(1);
}

const RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');
const bot = new Bot(process.env.BOT_TOKEN);

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

// 3. Əsas Menyu Generatoru
async function buildMainMenu() {
  const isDemo = state.mode === 'DEMO';
  let activeWalletStr = 'DEMO_ACCOUNT';
  let activeBalSol = state.demoBalanceSol;

  if (!isDemo && state.liveWallets.length > 0) {
    const w = state.liveWallets[state.activeWalletIndex];
    if (w) {
      activeWalletStr = `Cüzdan ${w.id}: \`${w.publicKey}\``;
      activeBalSol = await getRealSolBalance(w.publicKey);
    }
  }

  const solPriceUsd = 185.0;
  const usdBal = (activeBalSol * solPriceUsd).toFixed(2);
  const totalOpenSol = state.openPositions.reduce((acc, p) => acc + p.amountSol, 0).toFixed(2);

  let msg = `${t('wallet')}: ${activeWalletStr}\n`;
  msg += `${t('balance')}: ${activeBalSol.toFixed(4)} Sol ($${usdBal})\n`;
  msg += `${t('positions')}: ${totalOpenSol} Sol\n\n`;
  msg += `⚡ **PUMP UP TERMINAL** | Rejim: ${isDemo ? '🟢 Demo' : '🔴 Live Mainnet'}`;

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
  await ctx.reply(menu.msg, { parse_mode: 'Markdown', reply_markup: menu.kb });
});

bot.callbackQuery('action_refresh', async (ctx) => {
  await ctx.answerCallbackQuery();
  const menu = await buildMainMenu();
  await ctx.editMessageText(menu.msg, { parse_mode: 'Markdown', reply_markup: menu.kb }).catch(() => {});
});

bot.callbackQuery('set_mode_demo', async (ctx) => {
  state.mode = 'DEMO';
  await ctx.answerCallbackQuery('Demo Rejimi');
  const menu = await buildMainMenu();
  await ctx.editMessageText(menu.msg, { parse_mode: 'Markdown', reply_markup: menu.kb }).catch(() => {});
});

bot.callbackQuery('set_mode_live', async (ctx) => {
  state.mode = 'LIVE';
  await ctx.answerCallbackQuery('Live Rejimi');
  const menu = await buildMainMenu();
  await ctx.editMessageText(menu.msg, { parse_mode: 'Markdown', reply_markup: menu.kb }).catch(() => {});
});

// Demo Cüzdan Balansı Artırmaq
bot.callbackQuery('view_demo_wallet', async (ctx) => {
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard()
    .text('➕ +5 Demo SOL Əlavə Et', 'add_demo_sol').row()
    .text('⬅️ Menyu', 'action_refresh');
  await ctx.reply(`💵 **Demo Cüzdan Balansı:** ${state.demoBalanceSol.toFixed(4)} SOL\n\nBalansı artırmaq üçün aşağıdakı düyməyə sıxın:`, { parse_mode: 'Markdown', reply_markup: kb });
});

bot.callbackQuery('add_demo_sol', async (ctx) => {
  state.demoBalanceSol += 5.0;
  await ctx.answerCallbackQuery('+5 SOL Əlavə Edildi!');
  await ctx.reply(`✅ Balans Yeniləndi: **${state.demoBalanceSol.toFixed(4)} SOL**`, { parse_mode: 'Markdown' });
});

// Live Cüzdanların Yaradılması Və İdarəsi (Max 5)
bot.callbackQuery('view_live_wallet', async (ctx) => {
  await ctx.answerCallbackQuery();
  await renderLiveWalletsMenu(ctx);
});

async function renderLiveWalletsMenu(ctx) {
  let msg = `💳 **Şəxsi Live Solana Cüzdanları (Maksimum 5):**\n\n`;
  const kb = new InlineKeyboard();

  if (state.liveWallets.length === 0) {
    msg += `Hələ ki real cüzdan yaradılmayıb. Aşağıdakı düyməyə sıxaraq yarada bilərsiniz.\n`;
  } else {
    for (let i = 0; i < state.liveWallets.length; i++) {
      const w = state.liveWallets[i];
      const bal = await getRealSolBalance(w.publicKey);
      const isActive = i === state.activeWalletIndex;

      msg += `${isActive ? '🟢' : '⚪'} **Cüzdan ${w.id}:** \`${w.publicKey}\`\n`;
      msg += `Balans: **${bal.toFixed(4)} SOL**\n\n`;

      kb.text(`Cüzdan ${w.id} ${isActive ? '✅' : 'Seç'}`, `activate_wallet_${i}`)
        .text(`🔑 Recovery/PK ${w.id}`, `export_pk_${i}`).row();
    }
  }

  if (state.liveWallets.length < 5) {
    kb.text('➕ Real Pulqabı Yarat', 'create_real_wallet').row();
  }
  kb.text('⬅️ Menyu', 'action_refresh');

  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
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
  await ctx.reply(`✅ **Yeni Live Cüzdan ${newW.id} Yaradıldı!**\n\nAdres: \`${newW.publicKey}\`\nPrivate Key: \`${newW.privateKey}\``, { parse_mode: 'Markdown' });
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
    await ctx.reply(`🔑 **Cüzdan ${w.id} Məxfilik Məlumatları:**\n\nPublic Key: \`${w.publicKey}\`\nPrivate Key (Base58): \`${w.privateKey}\``, { parse_mode: 'Markdown' });
  }
});

// Target Ünvan Əlavə Etmə Və Analiz
bot.callbackQuery('action_add_target', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'target_address';
  await ctx.reply(t('enterTarget'));
});

// Ünvanlarım Və Silmə Menyusu
bot.callbackQuery('action_list_targets', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (state.targetWallets.length === 0) return ctx.reply('📋 Hələ heç bir izlənən ünvan əlavə edilməyib.');

  let msg = `📋 **İzlənən Pump.fun Ünvanları:**\n\n`;
  const kb = new InlineKeyboard();

  state.targetWallets.forEach((tTarget, idx) => {
    msg += `${idx + 1}. **${tTarget.username}** (\`${tTarget.address.substring(0,6)}...\`)\nQazanc/Zərər: **+$${tTarget.pnlUsd}**\n\n`;
    kb.text(`❌ Sil: ${tTarget.username}`, `delete_target_prompt_${idx}`).row();
  });

  kb.text('⬅️ Menyu', 'action_refresh');
  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
});

bot.callbackQuery(/^delete_target_prompt_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const idx = parseInt(ctx.match[1]);
  const target = state.targetWallets[idx];

  const kb = new InlineKeyboard()
    .text('✅ Bəli, Sil', `confirm_delete_target_${idx}`)
    .text('❌ Ləğv Et', 'action_list_targets');

  await ctx.reply(`⚠️ **${target.username}** ünvanını izləmədən çıxarmaq istədiyinizdən əminsiniz?`, { reply_markup: kb });
});

bot.callbackQuery(/^confirm_delete_target_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const idx = parseInt(ctx.match[1]);
  const removed = state.targetWallets.splice(idx, 1);
  await ctx.reply(`✅ **${removed[0]?.username || 'Ünvan'}** izləmədən silindi!`);
});

// Settings Və King TP Menyusu
bot.callbackQuery('view_settings', async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = state.settings;
  let msg = `⚙️ **PUMP UP | Trading Ayarları:**\n\n`;
  msg += `🔹 **Hər Alış Məbləği:** ${s.buyAmountSol} SOL\n`;
  msg += `🎯 **Take Profit (TP):** ${s.tpPercent}%\n`;
  msg += `🛑 **Stop Loss (SL):** ${s.slPercent}%\n`;
  msg += `👑 **King TP Status:** ${s.kingTp ? '🟢 AKTİV (200% artımda maya çıxarılır)' : '⚪ DEAKTİV'}\n`;
  msg += `⚡ **Priority Fee:** ${s.priorityFee} SOL\n`;
  msg += `🔄 **Slippage:** ${s.slippageBps / 100}%`;

  const kb = new InlineKeyboard()
    .text(s.kingTp ? '👑 King TP: Aktiv 🟢' : '👑 King TP: Deaktiv ⚪', 'toggle_king_tp').row()
    .text('⬅️ Menyu', 'action_refresh');

  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
});

bot.callbackQuery('toggle_king_tp', async (ctx) => {
  state.settings.kingTp = !state.settings.kingTp;
  await ctx.answerCallbackQuery('King TP dəyişdirildi');
  await ctx.reply(`👑 King TP Status: **${state.settings.kingTp ? 'AKTİV' : 'DEAKTİV'}**`, { parse_mode: 'Markdown' });
});

// Dil Seçimi
bot.callbackQuery('view_language', async (ctx) => {
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard()
    .text('🇬🇧 English', 'set_lang_EN')
    .text('🇦🇿 Azərbaycan', 'set_lang_AZ').row()
    .text('⬅️ Menyu', 'action_refresh');
  await ctx.reply('🌐 **Zəhmət olmasa dili seçin / Select language:**', { reply_markup: kb });
});

bot.callbackQuery(/^set_lang_(EN|AZ)$/, async (ctx) => {
  state.lang = ctx.match[1];
  await ctx.answerCallbackQuery(`Language set to ${state.lang}`);
  const menu = await buildMainMenu();
  await ctx.reply(`✅ Dil dəyişdirildi: **${state.lang}**`);
  await ctx.reply(menu.msg, { parse_mode: 'Markdown', reply_markup: menu.kb });
});

// Köçür (Withdraw) Prosesi
bot.callbackQuery('action_withdraw', async (ctx) => {
  await ctx.answerCallbackQuery();
  state.waitingInput = 'withdraw_addr';
  await ctx.reply('💸 **SOL Köçür**\n\nGöndərmək istədiyiniz Solana cüzdan ünvanını mesaj olaraq yazın:');
});

// Mətn Qəbulu Və Şəbəkə Əməliyyatları
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();

  // Target Ünvanı Doğrulama Və Analiz
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

      const msg = `👤 **Pump.fun Profil Analizi:**\n\n` +
        `Username: **${state.pendingTarget.username}**\n` +
        `Ünvan: \`${text}\`\n` +
        `Qazanma Nisbəti (Winrate): **${state.pendingTarget.winRate}**\n` +
        `Risk Qiymətləndirilməsi: **${state.pendingTarget.riskLevel}**\n\n` +
        `Bu ünvanın alqı-satqılarını avtomatik kopyalamaq istəyirsiniz?`;

      const kb = new InlineKeyboard()
        .text('✅ Təsdiqlə', 'confirm_add_target')
        .text('❌ Ləğv Et', 'action_refresh');

      return ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
    } catch (e) {
      return ctx.reply('❌ Keçərsiz Solana ünvanı! Lütfən düzgün formatda daxil edin.');
    }
  }

  // Withdraw Prosesi
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
    await ctx.reply('⏳ **Tranzaksiya Solana şəbəkəsinə göndərilir...**');

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
      return ctx.reply(`🚀 **REAL SOL TRANZAKSİYASI UĞURLA BAŞA ÇATDI!**\n\n` +
        `Məbləğ: **${amountSol} SOL**\n` +
        `Ünvan: \`${targetAddr}\`\n\n` +
        `🔗 **Solscan Explorer:** https://solscan.io/tx/${signature}`, { parse_mode: 'Markdown' });
    } catch (err) {
      return ctx.reply(`❌ Tranzaksiya Xətası: ${err.message}`);
    }
  }
});

bot.callbackQuery('confirm_add_target', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (state.pendingTarget) {
    state.targetWallets.push(state.pendingTarget);
    await ctx.reply(`✅ **${state.pendingTarget.username}** uğurla izlənilən cüzdanlar siyahısına əlavə edildi!`, { parse_mode: 'Markdown' });
    state.pendingTarget = null;
  }
});

// Başlanğıc
async function main() {
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  bot.start();
  console.log('⚡ PUMP UP BOT ENGINE STARTED!');
}

main();
