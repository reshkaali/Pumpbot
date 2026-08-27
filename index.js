import express from "express";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

dotenv.config();

const {
  BOT_TOKEN,
  BASE_URL,
  PORT = 10000,
  WEBHOOK_SECRET,
  HELIUS_API_KEY
} = process.env;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!BASE_URL) throw new Error("BASE_URL is required");

const app = express();
app.use(express.json());

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

const texts = {
  en: {
    start: "Welcome. Choose an option.",
    menu: "Main menu"
  },
  az: {
    start: "Xoş gəldin. Bir seçim et.",
    menu: "Əsas menyu"
  },
  ru: {
    start: "Добро пожаловать. Выберите опцию.",
    menu: "Главное меню"
  },
  tr: {
    start: "Hoş geldin. Bir seçenek seç.",
    menu: "Ana menü"
  }
};

function getLang(userId) {
  return "en";
}

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "İzlənəcək Ünvan Əlavə Et", callback_data: "add_address" }],
      [{ text: "Ünvanlarım", callback_data: "my_addresses" }],
      [{ text: "Demo 🟢 • Live 🟢", callback_data: "mode_toggle" }],
      [{ text: "Demo cüzdan • Live cüzdan", callback_data: "wallets" }],
      [{ text: "Açıq Pozisyonlar • Qapalı Pozisyonlar", callback_data: "positions" }],
      [{ text: "Settings • Language", callback_data: "settings_lang" }],
      [{ text: "Köçür • Refresh", callback_data: "transfer_refresh" }]
    ]
  };
}

bot.onText(//start/, async (msg) => {
  const chatId = msg.chat.id;
  const lang = getLang(msg.from.id);
  await bot.sendMessage(chatId, texts[lang].start, {
    reply_markup: mainMenuKeyboard()
  });
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data === "add_address") {
      await bot.sendMessage(chatId, "Ünvanı daxil et:");
    } else if (data === "my_addresses") {
      await bot.sendMessage(chatId, "Təsdiqlənmiş ünvanlar siyahısı gələcək.");
    } else if (data === "mode_toggle") {
      await bot.sendMessage(chatId, "Demo / Live seçim məntiqi əlavə olunacaq.");
    } else if (data === "wallets") {
      await bot.sendMessage(chatId, "Demo və Live cüzdan ekranı hazırlanacaq.");
    } else if (data === "positions") {
      await bot.sendMessage(chatId, "Açıq və qapalı pozisyonlar ekranı hazırlanacaq.");
    } else if (data === "settings_lang") {
      await bot.sendMessage(chatId, "Settings və dil seçimi ekranı hazırlanacaq.");
    } else if (data === "transfer_refresh") {
      await bot.sendMessage(chatId, "Köçürmə və refresh funksiyaları hazırlanacaq.");
    }

    await bot.answerCallbackQuery(query.id);
  } catch (err) {
    await bot.answerCallbackQuery(query.id, { text: "Xəta baş verdi" });
  }
});

app.post("/webhook/helius", async (req, res) => {
  const secret = req.headers["x-webhook-secret"];
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return res.status(401).send("Unauthorized");
  }

  const event = req.body;
  console.log("Helius event:", JSON.stringify(event));

  res.status(200).send("ok");
});

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/", (req, res) => {
  res.status(200).send("Bot is running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
