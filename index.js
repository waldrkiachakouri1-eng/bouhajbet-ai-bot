require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// ========== المستخدمون المصرح لهم ==========
const authorizedUsers = new Set([
  8569323647,  // هذا هو معرفك
]);

// ========== تنظيف النص ==========
function cleanText(text) {
  return text.replace(/[^\d.%+\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ========== استخراج الإحصائيات ==========
function extractStats(text) {
  const cleaned = cleanText(text);
  const nums = cleaned.match(/\d+(\.\d+)?%?/g) || [];

  function parsePercent(s) { return s.includes('%') ? parseFloat(s)/100 : parseFloat(s); }

  return {
    avgHomeGoals: parseFloat(nums[0]) || null,
    avgAwayGoals: parseFloat(nums[1]) || null,
    scoredHome: parseInt(nums[2]) || null,
    scoredAway: parseInt(nums[3]) || null,
    bttsPercent: parsePercent(nums.find(n => n.includes('BTTS')) || nums[4]) || null,
    over25Percent: parsePercent(nums.find(n => n.includes('+2.5')) || nums[5]) || null,
    homeCleanSheet: parsePercent(nums.find(n => n.includes('Clean Sheet') && nums.indexOf(n) < 10) || nums[6]) || null,
    awayCleanSheet: parsePercent(nums.find(n => n.includes('Clean Sheet') && nums.indexOf(n) > 6) || nums[7]) || null,
    homeScoredPlus05: parsePercent(nums.find(n => n.includes('Scored +0.5') && nums.indexOf(n) < 10) || nums[8]) || null,
    awayScoredPlus05: parsePercent(nums.find(n => n.includes('Scored +0.5') && nums.indexOf(n) > 8) || nums[9]) || null
  };
}

// ========== التحليل الذكي ==========
function analyze(statsText) {
  const stats = extractStats(statsText);

  const avgHomeGoals = stats.avgHomeGoals || 2.0;
  const avgAwayGoals = stats.avgAwayGoals || 2.0;
  const totalAvgGoals = avgHomeGoals + avgAwayGoals;
  const btts = stats.bttsPercent || 0.45;
  const over25 = stats.over25Percent || 0.45;

  let recommendation = "";
  let confidence = 0;

  if (totalAvgGoals >= 5.0) {
    recommendation = "Over 2.5 Goals ✅ (احتمال قوي جداً)";
    confidence = Math.min(95, Math.floor((totalAvgGoals / 6) * 100));
  } else if (totalAvgGoals >= 4.0) {
    recommendation = "Over 2.5 Goals ✅";
    confidence = Math.min(90, Math.floor((totalAvgGoals / 5) * 100));
  } else if (totalAvgGoals >= 3.0 && btts >= 0.5) {
    recommendation = "BTTS Yes ✅";
    confidence = Math.min(85, btts*100);
  } else {
    recommendation = "BTTS or Over 1.5 Goals ✅";
    confidence = 70;
  }

  return {
    recommendation,
    confidence,
    totalAvgGoals,
    avgHomeGoals,
    avgAwayGoals,
    btts,
    over25,
    stats
  };
}

// ========== التعامل مع الرسائل ==========
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;
  if (!authorizedUsers.has(userId)) return bot.sendMessage(chatId, '🚫 غير مصرح. أرسل /request');

  bot.sendChatAction(chatId, 'typing');

  try {
    const analysis = analyze(text);

    const response = `
🎯 *توصية الذكاء الاصطناعي:* 
${analysis.recommendation}

📊 *نسبة الثقة:* ${analysis.confidence}%

📈 *المؤشرات الرئيسية:*
• متوسط أهداف الفريق أ: ${analysis.avgHomeGoals.toFixed(2)}
• متوسط أهداف الفريق ب: ${analysis.avgAwayGoals.toFixed(2)}
• مجموع المتوسط: ${analysis.totalAvgGoals.toFixed(2)}
• احتمالية BTTS: ${(analysis.btts*100).toFixed(1)}%
• احتمالية Over 2.5: ${(analysis.over25*100).toFixed(1)}%

📂 *JSON جاهز للبوت:*
\`\`\`
${JSON.stringify(analysis.stats, null, 2)}
\`\`\`
    `;

    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '❌ حدث خطأ، الرجاء إرسال الإحصائيات مرة أخرى.');
  }
});

console.log('🚀 BouhajBet AI Bot Enhanced is running...');
