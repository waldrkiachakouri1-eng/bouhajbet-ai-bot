require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// ========== قائمة المستخدمين المصرح لهم ==========
const authorizedUsers = new Set([
  8569323647,  // معرفك
]);

// ========== دالة استخراج الأرقام من OddAlerts (محسنة بالكامل) ==========
function extractOddAlertsStats(text) {
  // تقسيم النص للعثور على قسم الإحصائيات
  const lines = text.split('\n');
  let statsSection = [];
  let inStats = false;
  
  for (let line of lines) {
    if (line.includes('Stats') && line.includes('Timings')) {
      inStats = true;
      continue;
    }
    if (inStats && line.includes('Form')) {
      break;
    }
    if (inStats) {
      statsSection.push(line);
    }
  }
  
  const statsText = statsSection.join('\n');
  
  // استخراج متوسط الأهداف (التنسيق: سطرين "home" ثم "away" ثم الأرقام)
  const avgGoalsPattern = /home\s+away\s+(\d+\.?\d*)\s+AVG Goals\s+(\d+\.?\d*)/is;
  const avgMatch = statsText.match(avgGoalsPattern);
  
  let avgHomeGoals = null;
  let avgAwayGoals = null;
  
  if (avgMatch) {
    avgHomeGoals = parseFloat(avgMatch[1]);
    avgAwayGoals = parseFloat(avgMatch[2]);
  } else {
    // محاولة بديلة: البحث عن الأرقام بعد AVG Goals
    const avgLines = statsText.match(/(\d+\.?\d*)\s+AVG Goals/g);
    if (avgLines && avgLines.length >= 2) {
      const numbers = avgLines.map(l => parseFloat(l.match(/(\d+\.?\d*)/)[1]));
      avgHomeGoals = numbers[0];
      avgAwayGoals = numbers[1];
    }
  }
  
  // استخراج BTTS
  const bttsMatch = statsText.match(/(\d+)%\s+BTTS\s+%/i) || 
                     statsText.match(/BTTS\s+%\s+(\d+)%/i) ||
                     statsText.match(/(\d+)%\s+BTTS/i);
  const bttsPercent = bttsMatch ? parseInt(bttsMatch[1]) : null;
  
  // استخراج Over 2.5
  const over25Match = statsText.match(/(\d+)%\s+\+2\.5 Goals\s+%/i) ||
                      statsText.match(/\+\2\.5 Goals\s+%\s+(\d+)%/i) ||
                      statsText.match(/(\d+)%\s+\+2\.5/i);
  const over25Percent = over25Match ? parseInt(over25Match[1]) : null;
  
  // استخراج Clean Sheet
  const homeCleanMatch = statsText.match(/home\s+(\d+)%\s+Clean Sheet/i);
  const awayCleanMatch = statsText.match(/away\s+(\d+)%\s+Clean Sheet/i);
  const homeCleanSheet = homeCleanMatch ? parseInt(homeCleanMatch[1]) : null;
  const awayCleanSheet = awayCleanMatch ? parseInt(awayCleanMatch[1]) : null;
  
  // استخراج Scored +0.5
  const homeScoredMatch = statsText.match(/home\s+(\d+)%\s+Scored\s+\+0\.5/i);
  const awayScoredMatch = statsText.match(/away\s+(\d+)%\s+Scored\s+\+0\.5/i);
  const homeScored = homeScoredMatch ? parseInt(homeScoredMatch[1]) : null;
  const awayScored = awayScoredMatch ? parseInt(awayScoredMatch[1]) : null;
  
  return {
    avgHomeGoals,
    avgAwayGoals,
    bttsPercent,
    over25Percent,
    homeCleanSheet,
    awayCleanSheet,
    homeScored,
    awayScored
  };
}

// ========== دالة التحليل الذكي ==========
function analyzeMatch(statsText) {
  const stats = extractOddAlertsStats(statsText);
  
  // استخدام القيم المستخرجة أو القيم الافتراضية
  const avgHomeGoals = stats.avgHomeGoals !== null ? stats.avgHomeGoals : 2.0;
  const avgAwayGoals = stats.avgAwayGoals !== null ? stats.avgAwayGoals : 2.0;
  const bttsPercent = stats.bttsPercent !== null ? stats.bttsPercent : 45;
  const over25Percent = stats.over25Percent !== null ? stats.over25Percent : 45;
  const homeScored = stats.homeScored !== null ? stats.homeScored : 70;
  const awayScored = stats.awayScored !== null ? stats.awayScored : 70;
  
  const totalAvgGoals = avgHomeGoals + avgAwayGoals;
  const bttsProbability = bttsPercent;
  
  let recommendation = "";
  let confidence = 0;
  let reasoning = "";
  
  // تحليل متقدم
  if (totalAvgGoals >= 5.0) {
    recommendation = "Over 2.5 Goals ✅ (احتمال قوي جداً)";
    confidence = Math.min(95, Math.floor((totalAvgGoals / 6) * 100));
    reasoning = `متوسط الأهداف مرتفع جداً (${totalAvgGoals.toFixed(1)}/مباراة) - هجوم قوي من الفريقين (${avgHomeGoals} و ${avgAwayGoals}).`;
  }
  else if (totalAvgGoals >= 4.0) {
    recommendation = "Over 2.5 Goals ✅";
    confidence = Math.min(90, Math.floor((totalAvgGoals / 5) * 100));
    reasoning = `مجموع متوسط الأهداف ${totalAvgGoals.toFixed(1)} (فريق أ ${avgHomeGoals}، فريق ب ${avgAwayGoals}) يشير إلى مباراة مفتوحة.`;
  }
  else if (totalAvgGoals >= 3.0 && bttsProbability >= 50) {
    recommendation = "BTTS Yes ✅";
    confidence = Math.min(85, bttsProbability);
    reasoning = `نسبة BTTS ${bttsProbability}% ومتوسط الأهداف ${totalAvgGoals.toFixed(1)} يدعمان كلا الفريقين للتسجيل.`;
  }
  else if (totalAvgGoals <= 2.2 || (over25Percent <= 35)) {
    recommendation = "Under 2.5 Goals ✅";
    confidence = Math.min(80, Math.floor(100 - over25Probability));
    reasoning = `متوسط الأهداف منخفض (${totalAvgGoals.toFixed(1)}/مباراة) ونسبة الأهداف ${over25Percent}%.`;
  }
  else if (homeScored > 75 && awayScored < 50) {
    recommendation = "Home Win ✅";
    confidence = Math.min(85, homeScored);
    reasoning = `الفريق أ يهاجم بقوة (${homeScored}% يسجل) بينما الفريق ب يعاني هجومياً (${awayScored}%).`;
  }
  else if (awayScored > 75 && homeScored < 50) {
    recommendation = "Away Win ✅";
    confidence = Math.min(85, awayScored);
    reasoning = `الفريق ب أقوى هجوماً (${awayScored}% يسجل) وقد يفاجئ الفريق أ.`;
  }
  else {
    recommendation = "BTTS Yes or Over 1.5 Goals ✅";
    confidence = 70;
    reasoning = "المباراة متوازنة مع توقع وجود أهداف.";
  }
  
  // حساب نسبة الثقة النهائية
  const dataCount = [stats.avgHomeGoals, stats.avgAwayGoals, stats.bttsPercent, stats.over25Percent].filter(v => v !== null).length;
  if (dataCount >= 3) confidence = Math.min(confidence + 5, 95);
  if (dataCount <= 1) confidence = Math.min(confidence, 70);
  
  return {
    recommendation,
    confidence,
    reasoning,
    totalAvgGoals,
    bttsProbability,
    avgHomeGoals,
    avgAwayGoals,
    over25Percent
  };
}

// ========== دالة التحقق من الصلاحية ==========
function isAuthorized(userId) {
  return authorizedUsers.has(userId);
}

let pendingRequests = [];

// ========== أوامر البوت ==========
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (isAuthorized(userId)) {
    bot.sendMessage(chatId, `
🤖 *BouhajBet AI - محلل المباريات الذكي* 🎯

✅ أنت مستخدم مصرح لك!

📊 *أرسل إحصائيات المباراة من OddAlerts* وسأقوم بتحليلها بدقة.

📈 *سأحلل لك:*
• متوسط أهداف الفريقين (home & away)
• نسبة BTTS
• نسبة Over 2.5
• قوة الهجوم والدفاع

*الأوامر:*
/help - المساعدة
/id - معرف حسابك
    `, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, `
🚫 *عذراً، ليس لديك صلاحية استخدام هذا البوت*

للحصول على الصلاحية، أرسل /request لطلب الإضافة.
    `, { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/id/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  bot.sendMessage(chatId, `📌 *معرف حسابك:* \`${userId}\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/request/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || "بدون اسم";
  
  if (isAuthorized(userId)) {
    bot.sendMessage(chatId, "✅ أنت بالفعل مستخدم مصرح لك!");
    return;
  }
  
  if (pendingRequests.some(r => r.userId === userId)) {
    bot.sendMessage(chatId, "⏳ طلبك قيد المراجعة.");
    return;
  }
  
  pendingRequests.push({ userId, username, chatId });
  bot.sendMessage(chatId, `📨 *تم إرسال طلبك!*\n\n📌 معرفك: \`${userId}\``, { parse_mode: 'Markdown' });
  
  const adminId = Array.from(authorizedUsers)[0];
  if (adminId) {
    bot.sendMessage(adminId, `🔔 طلب جديد: @${username} - \`${userId}\``, { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/approve (\d+)/, (msg, match) => {
  const adminId = msg.from.id;
  if (!isAuthorized(adminId)) return bot.sendMessage(msg.chat.id, "🚫 للمسؤول فقط.");
  
  const targetUserId = parseInt(match[1]);
  const request = pendingRequests.find(r => r.userId === targetUserId);
  if (!request) return bot.sendMessage(msg.chat.id, `❌ لا يوجد طلب.`);
  
  authorizedUsers.add(targetUserId);
  pendingRequests = pendingRequests.filter(r => r.userId !== targetUserId);
  
  bot.sendMessage(msg.chat.id, `✅ تمت الموافقة على \`${targetUserId}\``, { parse_mode: 'Markdown' });
  bot.sendMessage(request.chatId, `🎉 تمت الموافقة! أرسل /start للبدء.`, { parse_mode: 'Markdown' });
});

bot.onText(/\/list/, (msg) => {
  if (!isAuthorized(msg.from.id)) return bot.sendMessage(msg.chat.id, "🚫 للمسؤول فقط.");
  
  const usersList = Array.from(authorizedUsers).join('\n');
  bot.sendMessage(msg.chat.id, `📋 *المستخدمين:*\n\`\`\`\n${usersList}\n\`\`\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
  const userId = msg.from.id;
  if (!isAuthorized(userId)) return bot.sendMessage(msg.chat.id, "🚫 غير مصرح. أرسل /request");
  
  bot.sendMessage(msg.chat.id, `
📖 *الأوامر:*

👤 *للمستخدمين:*
/start - بدء الاستخدام
/help - المساعدة
/id - معرف حسابك

👑 *للمسؤول:*
/approve [id] - الموافقة
/list - عرض المستخدمين
  `, { parse_mode: 'Markdown' });
});

// ========== معالجة الرسائل للتحليل ==========
bot.on('message', async (msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!text || text.startsWith('/')) return;
  
  if (!isAuthorized(userId)) {
    return bot.sendMessage(chatId, `🚫 غير مصرح. أرسل /request`, { parse_mode: 'Markdown' });
  }
  
  bot.sendChatAction(chatId, 'typing');
  
  try {
    const analysis = analyzeMatch(text);
    
    const response = `
🎯 *توصية الذكاء الاصطناعي:* 
${analysis.recommendation}

📊 *نسبة الثقة:* ${analysis.confidence}%

🔍 *تحليل المباراة:*
${analysis.reasoning}

📈 *المؤشرات الرئيسية:*
• متوسط أهداف الفريق أ: ${analysis.avgHomeGoals.toFixed(2)}/مباراة
• متوسط أهداف الفريق ب: ${analysis.avgAwayGoals.toFixed(2)}/مباراة
• مجموع المتوسط: ${analysis.totalAvgGoals.toFixed(2)}/مباراة
• احتمالية BTTS: ${analysis.bttsProbability}%
• احتمالية Over 2.5: ${analysis.over25Percent}%

---
🤖 *BouhajBet AI* - تحليل دقيق من OddAlerts
    `;
    
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error:', error);
    bot.sendMessage(chatId, '❌ حدث خطأ. الرجاء إرسال الإحصائيات مرة أخرى.');
  }
});

console.log('🚀 BouhajBet AI Bot is running with full OddAlerts support...');
