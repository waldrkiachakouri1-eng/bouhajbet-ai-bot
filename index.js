  require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// ========== قائمة المستخدمين المصرح لهم ==========
const authorizedUsers = new Set([
  8569323647,  // هذا هو معرفك
]);

// ========== دالة استخراج الأرقام من OddAlerts ==========
function extractOddAlertsStats(text) {
  // استخراج متوسط الأهداف (التنسيق: "3.10 AVG Goals")
  const avgHomeMatch = text.match(/home\s+(\d+\.?\d*)\s+AVG Goals/i);
  const avgAwayMatch = text.match(/away\s+(\d+\.?\d*)\s+AVG Goals/i);
  
  const avgHomeGoals = avgHomeMatch ? parseFloat(avgHomeMatch[1]) : null;
  const avgAwayGoals = avgAwayMatch ? parseFloat(avgAwayMatch[1]) : null;
  
  // استخراج BTTS (التنسيق: "40% BTTS %")
  const bttsMatch = text.match(/(\d+)%\s+BTTS\s+%/i) || text.match(/BTTS\s+%\s+(\d+)%/i) || text.match(/(\d+)%\s+BTTS/i);
  const bttsPercent = bttsMatch ? parseInt(bttsMatch[1]) : null;
  
  // استخراج Over 2.5 (التنسيق: "40% +2.5 Goals %")
  const over25Match = text.match(/(\d+)%\s+\+2\.5 Goals\s+%/i) || text.match(/\+\2\.5 Goals\s+%\s+(\d+)%/i);
  const over25Percent = over25Match ? parseInt(over25Match[1]) : null;
  
  // استخراج Clean Sheet
  const homeCleanMatch = text.match(/home\s+(\d+)%\s+Clean Sheet\s+%/i);
  const awayCleanMatch = text.match(/away\s+(\d+)%\s+Clean Sheet\s+%/i);
  const homeCleanSheet = homeCleanMatch ? parseInt(homeCleanMatch[1]) : null;
  const awayCleanSheet = awayCleanMatch ? parseInt(awayCleanMatch[1]) : null;
  
  // استخراج Scored +0.5
  const homeScoredMatch = text.match(/home\s+(\d+)%\s+Scored\s+\+0\.5/i);
  const awayScoredMatch = text.match(/away\s+(\d+)%\s+Scored\s+\+0\.5/i);
  const homeScored = homeScoredMatch ? parseInt(homeScoredMatch[1]) : null;
  const awayScored = awayScoredMatch ? parseInt(awayScoredMatch[1]) : null;
  
  // استخراج Failed to Score
  const homeFailedMatch = text.match(/home\s+(\d+)%\s+Failed to Score/i);
  const awayFailedMatch = text.match(/away\s+(\d+)%\s+Failed to Score/i);
  const homeFailed = homeFailedMatch ? parseInt(homeFailedMatch[1]) : null;
  const awayFailed = awayFailedMatch ? parseInt(awayFailedMatch[1]) : null;
  
  return {
    avgHomeGoals,
    avgAwayGoals,
    bttsPercent,
    over25Percent,
    homeCleanSheet,
    awayCleanSheet,
    homeScored,
    awayScored,
    homeFailed,
    awayFailed
  };
}

// ========== دالة التحليل الذكي ==========
function analyzeMatch(statsText) {
  // استخراج الأرقام من OddAlerts
  const stats = extractOddAlertsStats(statsText);
  
  // استخدام القيم المستخرجة أو القيم الافتراضية إذا لم توجد
  const avgHomeGoals = stats.avgHomeGoals !== null ? stats.avgHomeGoals : 2.0;
  const avgAwayGoals = stats.avgAwayGoals !== null ? stats.avgAwayGoals : 2.0;
  const bttsPercent = stats.bttsPercent !== null ? stats.bttsPercent : 45;
  const over25Percent = stats.over25Percent !== null ? stats.over25Percent : 45;
  const homeScored = stats.homeScored !== null ? stats.homeScored : 70;
  const awayScored = stats.awayScored !== null ? stats.awayScored : 70;
  const homeFailed = stats.homeFailed !== null ? stats.homeFailed : 30;
  const awayFailed = stats.awayFailed !== null ? stats.awayFailed : 30;
  
  // حساب المؤشرات
  const totalAvgGoals = avgHomeGoals + avgAwayGoals;
  const over25Probability = Math.min(95, (totalAvgGoals / 5) * 100);
  const bttsProbability = bttsPercent;
  
  // تحديد التوصية
  let recommendation = "";
  let confidence = 0;
  let reasoning = "";
  
  // تحليل متقدم يعتمد على الأرقام الفعلية
  if (totalAvgGoals >= 5.5) {
    recommendation = "Over 2.5 Goals ✅ (احتمال قوي جداً)";
    confidence = Math.min(95, Math.floor(over25Probability));
    reasoning = `متوسط الأهداف مرتفع جداً (${totalAvgGoals.toFixed(1)}/مباراة) - هجوم قوي من الفريقين (${avgHomeGoals} و ${avgAwayGoals}).`;
  }
  else if (totalAvgGoals >= 4.0) {
    recommendation = "Over 2.5 Goals ✅";
    confidence = Math.min(90, Math.floor(over25Probability));
    reasoning = `مجموع متوسط الأهداف ${totalAvgGoals.toFixed(1)} (فريق أ ${avgHomeGoals}، فريق ب ${avgAwayGoals}) يشير إلى مباراة مفتوحة.`;
  }
  else if (totalAvgGoals >= 3.0 && bttsProbability >= 50) {
    recommendation = "BTTS Yes ✅";
    confidence = Math.min(85, bttsProbability);
    reasoning = `نسبة BTTS ${bttsProbability}% ومتوسط الأهداف ${totalAvgGoals.toFixed(1)} يدعمان كلا الفريقين للتسجيل.`;
  }
  else if (totalAvgGoals <= 2.0 || (homeScored < 50 && awayScored < 50)) {
    recommendation = "Under 2.5 Goals ✅";
    confidence = Math.min(80, Math.floor(100 - over25Probability));
    reasoning = `متوسط الأهداف منخفض (${totalAvgGoals.toFixed(1)}/مباراة) والفرق تعاني هجومياً (${homeScored}% و ${awayScored}%).`;
  }
  else if (homeScored > 80 && awayScored < 50) {
    recommendation = "Home Win ✅";
    confidence = Math.min(85, homeScored);
    reasoning = `الفريق أ يهاجم بقوة (${homeScored}% يسجل) بينما الفريق ب يعاني (${awayFailed}% يفشل في التسجيل).`;
  }
  else if (awayScored > 80 && homeScored < 50) {
    recommendation = "Away Win ✅";
    confidence = Math.min(85, awayScored);
    reasoning = `الفريق ب أقوى هجوماً (${awayScored}% يسجل) وقد يفاجئ الفريق أ.`;
  }
  else {
    recommendation = "BTTS Yes or Over 1.5 Goals ✅";
    confidence = 70;
    reasoning = "المباراة متوازنة مع توقع وجود أهداف.";
  }
  
  // تحسين الثقة بناءً على البيانات المستخرجة
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

// ========== طلبات الإضافة ==========
let pendingRequests = [];

// ========== أمر /start ==========
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (isAuthorized(userId)) {
    bot.sendMessage(chatId, `
🤖 *BouhajBet AI - محلل المباريات الذكي* 🎯

✅ أنت مستخدم مصرح لك!

📊 *أرسل إحصائيات المباراة من OddAlerts* وسأقوم بتحليلها وإعطائك توصية واحدة دقيقة.

📈 *سأحلل لك:*
• متوسط أهداف الفريقين
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

// ========== أمر /id ==========
bot.onText(/\/id/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || "لا يوجد";
  
  bot.sendMessage(chatId, `
📌 *معرف حسابك:*
\`${userId}\`

👤 *اسم المستخدم:* @${username}

💡 *شارك هذا المعرف مع المسؤول لإضافتك.*
  `, { parse_mode: 'Markdown' });
});

// ========== أمر /request ==========
bot.onText(/\/request/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || "بدون اسم";
  
  if (isAuthorized(userId)) {
    bot.sendMessage(chatId, "✅ أنت بالفعل مستخدم مصرح لك!");
    return;
  }
  
  const alreadyRequested = pendingRequests.some(r => r.userId === userId);
  if (alreadyRequested) {
    bot.sendMessage(chatId, "⏳ طلبك قيد المراجعة، يرجى الانتظار.");
    return;
  }
  
  pendingRequests.push({ userId, username, chatId });
  bot.sendMessage(chatId, `
📨 *تم إرسال طلبك بنجاح!*

سيتواصل معك المسؤول قريباً.

📌 *معرفك:* \`${userId}\`
  `, { parse_mode: 'Markdown' });
  
  const adminId = Array.from(authorizedUsers)[0];
  if (adminId) {
    bot.sendMessage(adminId, `
🔔 *طلب استخدام جديد!*

👤 المستخدم: @${username}
🆔 المعرف: \`${userId}\`

للموافقة: /approve ${userId}
للرفض: /deny ${userId}
    `, { parse_mode: 'Markdown' });
  }
});

// ========== أمر /approve ==========
bot.onText(/\/approve (\d+)/, (msg, match) => {
  const adminId = msg.from.id;
  const targetUserId = parseInt(match[1]);
  
  if (!isAuthorized(adminId)) {
    bot.sendMessage(msg.chat.id, "🚫 هذا الأمر للمسؤول فقط.");
    return;
  }
  
  const request = pendingRequests.find(r => r.userId === targetUserId);
  if (!request) {
    bot.sendMessage(msg.chat.id, `❌ لا يوجد طلب للمستخدم ${targetUserId}`);
    return;
  }
  
  authorizedUsers.add(targetUserId);
  pendingRequests = pendingRequests.filter(r => r.userId !== targetUserId);
  
  bot.sendMessage(msg.chat.id, `✅ تمت الموافقة على المستخدم \`${targetUserId}\` بنجاح!`, { parse_mode: 'Markdown' });
  bot.sendMessage(request.chatId, `
🎉 *تمت الموافقة على طلبك!*

أصبح بإمكانك الآن استخدام بوت BouhajBet AI.

أرسل /start للبدء 🚀
    `, { parse_mode: 'Markdown' });
});

// ========== أمر /deny ==========
bot.onText(/\/deny (\d+)/, (msg, match) => {
  const adminId = msg.from.id;
  const targetUserId = parseInt(match[1]);
  
  if (!isAuthorized(adminId)) {
    bot.sendMessage(msg.chat.id, "🚫 هذا الأمر للمسؤول فقط.");
    return;
  }
  
  const request = pendingRequests.find(r => r.userId === targetUserId);
  if (request) {
    pendingRequests = pendingRequests.filter(r => r.userId !== targetUserId);
    bot.sendMessage(request.chatId, "❌ عذراً، تم رفض طلبك.");
  }
  
  bot.sendMessage(msg.chat.id, `❌ تم رفض المستخدم \`${targetUserId}\``, { parse_mode: 'Markdown' });
});

// ========== أمر /list ==========
bot.onText(/\/list/, (msg) => {
  const adminId = msg.from.id;
  
  if (!isAuthorized(adminId)) {
    bot.sendMessage(msg.chat.id, "🚫 هذا الأمر للمسؤول فقط.");
    return;
  }
  
  const usersList = Array.from(authorizedUsers).join('\n');
  const pendingList = pendingRequests.map(r => `${r.userId} (@${r.username})`).join('\n') || "لا يوجد";
  
  bot.sendMessage(msg.chat.id, `
📋 *المستخدمين المصرح لهم:*
\`\`\`
${usersList || "أنت فقط"}
\`\`\`

⏳ *طلبات الانتظار:*
${pendingList}
  `, { parse_mode: 'Markdown' });
});

// ========== أمر /remove ==========
bot.onText(/\/remove (\d+)/, (msg, match) => {
  const adminId = msg.from.id;
  const targetUserId = parseInt(match[1]);
  
  if (!isAuthorized(adminId)) {
    bot.sendMessage(msg.chat.id, "🚫 هذا الأمر للمسؤول فقط.");
    return;
  }
  
  if (targetUserId === adminId) {
    bot.sendMessage(msg.chat.id, "❌ لا يمكنك إزالة نفسك!");
    return;
  }
  
  if (authorizedUsers.has(targetUserId)) {
    authorizedUsers.delete(targetUserId);
    bot.sendMessage(msg.chat.id, `✅ تم إزالة المستخدم \`${targetUserId}\` بنجاح.`, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(msg.chat.id, `❌ المستخدم \`${targetUserId}\` غير موجود.`, { parse_mode: 'Markdown' });
  }
});

// ========== أمر /help ==========
bot.onText(/\/help/, (msg) => {
  const userId = msg.from.id;
  
  if (!isAuthorized(userId)) {
    bot.sendMessage(msg.chat.id, "🚫 هذا البوت خاص. أرسل /request لطلب الإضافة.");
    return;
  }
  
  bot.sendMessage(msg.chat.id, `
📖 *قائمة الأوامر:*

👤 *لجميع المستخدمين:*
/start - بدء استخدام البوت
/help - عرض المساعدة
/id - عرض معرف حسابك

👑 *للمسؤول فقط:*
/approve [id] - الموافقة على مستخدم جديد
/deny [id] - رفض طلب مستخدم
/list - عرض المستخدمين المصرح لهم
/remove [id] - إزالة مستخدم

📊 *كيفية الاستخدام:*
انسخ إحصائيات المباراة من OddAlerts وأرسلها للبوت
  `, { parse_mode: 'Markdown' });
});

// ========== معالجة الرسائل للتحليل ==========
bot.on('message', async (msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!text || text.startsWith('/')) return;
  
  if (!isAuthorized(userId)) {
    bot.sendMessage(chatId, `
🚫 *غير مصرح لك باستخدام هذا البوت*

لطلب الإضافة، أرسل:
/request
    `, { parse_mode: 'Markdown' });
    return;
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
    bot.sendMessage(chatId, '❌ حدث خطأ في التحليل. الرجاء إرسال الإحصائيات مرة أخرى.');
  }
});

console.log('🚀 BouhajBet AI Bot is running with OddAlerts support...');
