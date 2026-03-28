require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 مرحبا بك في BouhajBet AI\n\nأرسل إحصائيات المباراة وسأحللها لك 🎯");
});

bot.on('message', async (msg) => {
  if (msg.text === '/start') return;

  const response = `
🎯 GOLDEN CHOICE:
Over 2.5 Goals

📊 Confidence:
78%

📈 Best Markets:
- BTTS Yes
- Over 1.5 Goals
- Home Draw No Bet
`;

  bot.sendMessage(msg.chat.id, response);
});
