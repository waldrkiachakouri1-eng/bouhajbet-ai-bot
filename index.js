require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// دالة مساعدة لاستخراج الأرقام
function extractNumber(text, pattern) {
  const match = text.match(pattern);
  if (match && match[1]) {
    return parseFloat(match[1]);
  }
  return null;
}

// دالة تحليل ذكية تعتمد على الأرقام
function analyzeMatch(statsText) {
  // استخراج الأرقام من النص
  const avgHomeGoals = extractNumber(statsText, /home.*?(\d+\.?\d*).*?AVG Goals/i) || 
                        extractNumber(statsText, /(\d+\.?\d*).*?AVG Goals.*?home/i) || 
                        extractNumber(statsText, /AVG Goals.*?(\d+\.?\d*).*?home/i) || 2.0;
  
  const avgAwayGoals = extractNumber(statsText, /away.*?(\d+\.?\d*).*?AVG Goals/i) || 
                        extractNumber(statsText, /(\d+\.?\d*).*?AVG Goals.*?away/i) || 
                        extractNumber(statsText, /AVG Goals.*?(\d+\.?\d*).*?away/i) || 1.5;
  
  const bttsPercent = extractNumber(statsText, /BTTS.*?(\d+)%/) || 
                      extractNumber(statsText, /(\d+)%.*?BTTS/i) || 45;
  
  const over25Percent = extractNumber(statsText, /\+2\.5 Goals.*?(\d+)%/) || 
                        extractNumber(statsText, /(\d+)%.*?\+2\.5/i) || 40;
  
  const homeCleanSheet = extractNumber(statsText, /home.*?Clean Sheet.*?(\d+)%/) || 
                         extractNumber(statsText, /Clean Sheet.*?(\d+)%.*?home/i) || 30;
  
  const awayCleanSheet = extractNumber(statsText, /away.*?Clean Sheet.*?(\d+)%/) || 
                         extractNumber(statsText, /Clean Sheet.*?(\d+)%.*?away/i) || 30;
  
  const homeScored = extractNumber(statsText, /home.*?Scored.*?(\d+)%/) || 70;
  const awayScored = extractNumber(statsText, /away.*?Scored.*?(\d+)%/) || 70;
  
  // حساب التوقعات
  const totalAvgGoals = avgHomeGoals + avgAwayGoals;
  const over25Probability = (totalAvgGoals / 3) * 100;
  const bttsProbability = bttsPercent || ((homeScored + awayScored) / 2);
  
  // تحديد التوصية النهائية
  let recommendation = "";
  let confidence = 0;
  let reasoning = "";
  
  // التحليل المنطقي
  if (totalAvgGoals >= 2.8 && over25Probability >= 65) {
    recommendation = "Over 2.5 Goals ✅";
    confidence = Math.min(95, Math.floor(over25Probability));
    reasoning = `مجموع متوسط الأهداف ${totalAvgGoals.toFixed(1)} (فريق أ ${avgHomeGoals}، فريق ب ${avgAwayGoals}) يشير إلى مباراة مفتوحة.`;
  } 
  else if (totalAvgGoals >= 2.2 && bttsProbability >= 55) {
    recommendation = "BTTS Yes ✅";
    confidence = Math.min(90, Math.floor(bttsProbability));
    reasoning = `نسبة BTTS ${bttsProbability}% ومتوسط الأهداف ${totalAvgGoals.toFixed(1)} يدعمان كلا الفريقين للتسجيل.`;
  }
  else if (totalAvgGoals <= 1.8 || (homeCleanSheet > 60 && awayCleanSheet > 60)) {
    recommendation = "Under 2.5 Goals ✅";
    confidence = Math.min(85, Math.floor(100 - over25Probability));
    reasoning = `الفرق تميل للدفاع (Clean Sheet ${homeCleanSheet}% / ${awayCleanSheet}%) ومتوسط الأهداف منخفض ${totalAvgGoals.toFixed(1)}.`;
  }
  else if (homeScored > 80 && awayScored < 40) {
    recommendation = "Home Win ✅";
    confidence = Math.min(88, Math.floor(homeScored));
    reasoning = `الفريق أ يهاجم بقوة (${homeScored}% يسجل) بينما الفريق ب يعاني دفاعياً.`;
  }
  else if (awayScored > 80 && homeScored < 40) {
    recommendation = "Away Win ✅";
    confidence = Math.min(88, Math.floor(awayScored));
    reasoning = `الفريق ب أقوى هجوماً (${awayScored}% يسجل) وقد يفاجئ الفريق أ.`;
  }
  else if (totalAvgGoals >= 2.0 && bttsProbability >= 50) {
    recommendation = "Over 1.5 Goals & BTTS ✅";
    confidence = Math.min(85, Math.floor((over25Probability + bttsProbability) / 2));
    reasoning = `المباراة متوازنة مع توقع وجود أهداف (${totalAvgGoals.toFixed(1)}/مباراة) وكلا الفريقين يسجلان (${bttsProbability}%).`;
  }
  else {
    recommendation = "BTTS Yes or Over 1.5 Goals ✅";
    confidence = 70;
    reasoning = "البيانات متوسطة، لكن المؤشرات تدعم وجود أهداف في المباراة.";
  }
  
  // تحسين الثقة بناءً على كمية البيانات
  const dataCompleteness = [avgHomeGoals, avgAwayGoals, bttsPercent, over25Percent].filter(v => v > 0).length;
  if (dataCompleteness < 2) confidence = Math.min(confidence, 65);
  if (dataCompleteness >= 3) confidence = Math.min(confidence + 5, 95);
  
  return { recommendation, confidence, reasoning, totalAvgGoals, bttsProbability };
}

// أمر /start
bot.onText(/\/start/, (msg) => {
  const welcomeMsg = `
🤖 *BouhajBet AI - محلل المباريات الذكي*

أرسل إحصائيات المباراة وسأقوم بتحليلها باستخدام الذكاء الاصطناعي وإعطائك *توصية واحدة فقط* مدعومة بتحليل دقيق.

📊 *مثال للإحصائيات المقبولة:*
\`\`\`
Pioneros de Cancún vs Racing de Veracruz
AVG Goals: home 2.73 | away 2.09
BTTS: 55%
Over 2.5: 45%
Clean Sheet: home 27% | away 73%
\`\`\`

🎯 *سأعطيك:* توصية نهائية + نسبة ثقة + سبب التحليل

*الأوامر:*
/help - المساعدة
/about - عن البوت
  `;
  bot.sendMessage(msg.chat.id, welcomeMsg, { parse_mode: 'Markdown' });
});

// أمر /help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
📖 *كيفية استخدام BouhajBet AI*

1️⃣ انسخ إحصائيات المباراة من موقع OddAlerts أو أي مصدر
2️⃣ أرسلها إلى البوت
3️⃣ احصل على توصية واحدة دقيقة

💡 *أفضل البيانات للتحليل:*
• متوسط أهداف الفريقين
• نسبة BTTS
• نسبة Over 2.5
• نسبة Clean Sheet

🎯 *البوت يحلل:* 
• احتمالية الأهداف
• فرص كلا الفريقين للتسجيل
• قوة الهجوم والدفاع
  `, { parse_mode: 'Markdown' });
});

// أمر /about
bot.onText(/\/about/, (msg) => {
  bot.sendMessage(msg.chat.id, `
⚡ *BouhajBet AI v3.0*

بوت تحليل مباريات بالذكاء الاصطناعي

✨ *المميزات:*
• توصية واحدة مدعومة بالتحليل
• نسبة ثقة ديناميكية
• تحليل ذكي للأرقام
• تحديثات مستمرة

📅 *الإصدار:* مارس 2026
  `, { parse_mode: 'Markdown' });
});

// معالجة الرسائل
bot.on('message', async (msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;
  
  if (!text || text.startsWith('/')) return;
  
  // إظهار مؤشر الكتابة
  bot.sendChatAction(chatId, 'typing');
  
  try {
    // التحليل الذكي
    const analysis = analyzeMatch(text);
    
    // إنشاء الرد المخصص
    const response = `
🎯 *توصية الذكاء الاصطناعي:* 
${analysis.recommendation}

📊 *نسبة الثقة:* ${analysis.confidence}%

🔍 *تحليل المباراة:*
${analysis.reasoning}

📈 *المؤشرات الرئيسية:*
• متوسط الأهداف الكلي: ${analysis.totalAvgGoals.toFixed(1)}/مباراة
• احتمالية BTTS: ${analysis.bttsProbability}%

---
🤖 *BouhajBet AI* - تحليل دقيق مدعوم بالذكاء الاصطناعي
    `;
    
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error:', error);
    bot.sendMessage(chatId, '❌ حدث خطأ في التحليل. الرجاء إرسال الإحصائيات مرة أخرى.');
  }
});

console.log('🚀 BouhajBet AI Bot is running with AI analysis...');
