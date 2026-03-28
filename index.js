require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// ========== قائمة المستخدمين المصرح لهم ==========
const authorizedUsers = new Set([
  8569323647  // معرفك الشخصي
]);

// ========== دالة استخراج كل الإحصائيات من OddAlerts ==========
function extractOddAlertsStats(text) {
  const lines = text.split('\n');
  let statsSection = [];
  let inStats = false;

  for (let line of lines) {
    if (line.includes('Stats') && line.includes('Timings')) {
      inStats = true;
      continue;
    }
    if (inStats && line.includes('Form')) break;
    if (inStats) statsSection.push(line);
  }

  const statsText = statsSection.join('\n');

  // استخراج الأرقام بدقة عالية مهما كانت صياغتها
  const numbers = statsText.match(/-?\d+\.?\d*/g)?.map(n => parseFloat(n)) || [];

  // تعيين القيم الأساسية
  const avgHomeGoals = numbers[0] ?? 2.0;
  const avgAwayGoals = numbers[1] ?? 2.0;
  const scoredHome = numbers[2] ?? 0;
  const scoredAway = numbers[3] ?? 0;
  const bttsPercent = numbers[4] ?? 45;
  const over25Percent = numbers[5] ?? 45;
  const homeCleanSheet = numbers[6] ?? 0;
  const awayCleanSheet = numbers[7] ?? 0;
  const homeScoredPlus05 = numbers[8] ?? 0;
  const awayScoredPlus05 = numbers[9] ?? 0;

  return {
    avgHomeGoals,
    avgAwayGoals,
    scoredHome,
    scoredAway,
    bttsPercent,
    over25Percent,
    homeCleanSheet,
    awayCleanSheet,
    homeScoredPlus05,
    awayScoredPlus05
  };
}

// ========== دالة التحليل الذكي + اختيار أفضل سوق ==========
function analyzeMatch(statsText) {
  const stats = extractOddAlertsStats(statsText);
  const totalAvgGoals = stats.avgHomeGoals + stats.avgAwayGoals;

  let recommendation = "";
  let confidence = 0;

  // أفضل سوق تلقائي (Value Bet logic)
  if (totalAvgGoals >= 4.5 || stats.over25Percent > 70) {
    recommendation = "Over 2.5 Goals ✅ (Value Bet)";
    confidence = Math.min(95, Math.floor((totalAvgGoals / 6) * 100));
  } else if (stats.bttsPercent >= 60) {
    recommendation = "BTTS Yes ✅ (Value Bet)";
    confidence = Math.min(90, stats.bttsPercent);
  } else {
    recommendation = "BTTS or Over 1.5 Goals ✅";
    confidence = 70;
  }

  return {
    recommendation,
    confidence,
    totalAvgGoals,
    stats
  };
}

// ========== التحقق من الصلاحية ==========
function isAuthorized(userId) {
  return authorizedUsers.has(userId);
}

// ========== أوامر البوت ==========
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (isAuthorized(userId)) {
    bot.sendMessage(chatId, `
🤖 *BouhajBet AI - محلل المباريات الذكي* 🎯
✅ أنت مستخدم مصرح لك!
📊 أرسل إحصائيات المباراة من OddAlerts وسأحللها بدقة عالية.
`, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, `🚫 غير مصرح لك.`, { parse_mode: 'Markdown' });
  }
});

// ========== معالجة الرسائل للتحليل ==========
bot.on('message', async (msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!text || text.startsWith('/')) return;
  if (!isAuthorized(userId)) return bot.sendMessage(chatId, `🚫 غير مصرح.`, { parse_mode: 'Markdown' });

  bot.sendChatAction(chatId, 'typing');

  try {
    const analysis = analyzeMatch(text);
    const stats = analysis.stats;

    const response = `
🎯 *توصية الذكاء الاصطناعي:* 
${analysis.recommendation}

📊 *نسبة الثقة:* ${analysis.confidence}%

📈 *المؤشرات الرئيسية:*
• متوسط أهداف الفريق أ: ${stats.avgHomeGoals}
• متوسط أهداف الفريق ب: ${stats.avgAwayGoals}
• مجموع المتوسط: ${analysis.totalAvgGoals}
• احتمالية BTTS: ${stats.bttsPercent}%
• احتمالية Over 2.5: ${stats.over25Percent}%

📂 JSON جاهز للبوت:
\`\`\`
${JSON.stringify(stats, null, 2)}
\`\`\`

---
🤖 *BouhajBet AI* - تحليل دقيق من OddAlerts
    `;

    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '❌ حدث خطأ. الرجاء إرسال الإحصائيات مرة أخرى.');
  }
});

console.log('🚀 BouhajBet AI Bot running with full OddAlerts support and Value Bet logic!');
