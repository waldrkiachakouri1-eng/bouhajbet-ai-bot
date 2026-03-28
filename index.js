require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// ========== المستخدمون المصرح لهم ==========
const authorizedUsers = new Set([
  8569323647, // معرفك الشخصي
]);

// ========== تنظيف النص ==========
function cleanText(text) {
  return text.replace(/[^\d.%+\sA-Za-z]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ========== استخراج الإحصائيات ==========
function extractStats(text) {
  const cleaned = cleanText(text);

  const avgHomeGoals = parseFloat((cleaned.match(/home\s+(\d+(\.\d+)?)/i)||[1,2])[1]) || 0;
  const avgAwayGoals = parseFloat((cleaned.match(/away\s+(\d+(\.\d+)?)/i)||[1,2])[1]) || 0;
  const bttsPercent = parseFloat((cleaned.match(/(\d+(\.\d+)?)\s*%\s*BTTS/i)||[1,0])[1])/100 || 0.45;
  const over25Percent = parseFloat((cleaned.match(/(\d+(\.\d+)?)\s*%\s*\+2\.5/i)||[1,0])[1])/100 || 0.45;

  return { avgHomeGoals, avgAwayGoals, bttsPercent, over25Percent };
}

// ========== تحليل الأسواق وتحديد أفضل سوق ==========
function analyzeMarkets(stats) {
  const markets = [];
  const totalAvgGoals = stats.avgHomeGoals + stats.avgAwayGoals;

  // Over 2.5
  const over25Conf = Math.min(95, Math.floor(totalAvgGoals/5*100));
  markets.push({ market: "Over 2.5 Goals", recommendation: totalAvgGoals>=3?"Yes ✅":"No ❌", confidence: over25Conf, value: over25Conf*totalAvgGoals });

  // BTTS
  const bttsConf = Math.min(95, Math.floor(stats.bttsPercent*100));
  markets.push({ market: "BTTS", recommendation: stats.bttsPercent>=0.5?"Yes ✅":"No ❌", confidence: bttsConf, value: bttsConf*stats.bttsPercent });

  // Correct Score تقريبي
  const homeG = Math.round(stats.avgHomeGoals);
  const awayG = Math.round(stats.avgAwayGoals);
  const correctScores = [
    { score: `${homeG}-${awayG}`, probability: 40 },
    { score: `${homeG}-${awayG+1}`, probability: 25 },
    { score: `${homeG+1}-${awayG}`, probability: 20 }
  ];
  markets.push({ market: "Correct Score", recommendation: correctScores, confidence: correctScores.map(c=>c.probability), value: Math.max(...correctScores.map(c=>c.probability)) });

  // اختيار أفضل سوق تلقائياً حسب القيمة
  markets.sort((a,b)=>b.value-a.value);
  const bestMarket = markets[0];

  return { markets, bestMarket };
}

// ========== إشعار التغيرات ==========
let lastBestValue = null;
async function notifyChanges(chatId, statsText) {
  const { bestMarket } = analyzeMarkets(extractStats(statsText));
  if (lastBestValue !== bestMarket.value) {
    lastBestValue = bestMarket.value;
    await bot.sendMessage(chatId, `🔔 *تحديث القيمة الأفضل:*\nأفضل سوق: ${bestMarket.market}\nتوصية: ${Array.isArray(bestMarket.recommendation)?bestMarket.recommendation.map(c=>c.score).join(', '):bestMarket.recommendation}\nثقة: ${Array.isArray(bestMarket.confidence)?bestMarket.confidence.join('% / ')+'%':bestMarket.confidence+'%'}\n`, { parse_mode: 'Markdown' });
  }
}

// ========== التعامل مع الرسائل ==========
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;
  if (!authorizedUsers.has(userId)) return bot.sendMessage(chatId, '🚫 غير مصرح. أنت غير مدرج كمستخدم.');

  bot.sendChatAction(chatId, 'typing');

  try {
    let statsText = text.includes('oddalert') ? (await axios.get(text)).data : text;
    await notifyChanges(chatId, statsText);
  } catch(err) {
    console.error(err);
    bot.sendMessage(chatId, '❌ حدث خطأ، الرجاء إرسال الرابط أو الإحصائيات مرة أخرى.');
  }
});

console.log('🚀 BouhajBet AI Hyper Running - معرفك مصرح والذكاء الخارق يعمل الآن!');
