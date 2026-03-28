function analyzeMatchFromJSON(stats) {
  const avgHomeGoals = stats.avgHomeGoals ?? 2.0;
  const avgAwayGoals = stats.avgAwayGoals ?? 2.0;
  const bttsPercent = stats.bttsPercent ?? 45;
  const over25Percent = stats.over25Percent ?? 45;
  const homeScored = stats.scoredHome ?? 70;
  const awayScored = stats.scoredAway ?? 70;

  const totalAvgGoals = avgHomeGoals + avgAwayGoals;
  const bttsProbability = bttsPercent;

  let recommendation = "";
  let confidence = 0;
  let reasoning = "";

  if (totalAvgGoals >= 5.0) {
    recommendation = "Over 2.5 Goals ✅ (احتمال قوي جداً)";
    confidence = Math.min(95, Math.floor((totalAvgGoals / 6) * 100));
    reasoning = `متوسط الأهداف مرتفع جداً (${totalAvgGoals.toFixed(1)}/مباراة) - هجوم قوي من الفريقين (${avgHomeGoals} و ${avgAwayGoals}).`;
  } else if (totalAvgGoals >= 4.0) {
    recommendation = "Over 2.5 Goals ✅";
    confidence = Math.min(90, Math.floor((totalAvgGoals / 5) * 100));
    reasoning = `مجموع متوسط الأهداف ${totalAvgGoals.toFixed(1)} (فريق أ ${avgHomeGoals}، فريق ب ${avgAwayGoals}) يشير إلى مباراة مفتوحة.`;
  } else if (totalAvgGoals >= 3.0 && bttsProbability >= 50) {
    recommendation = "BTTS Yes ✅";
    confidence = Math.min(85, bttsProbability);
    reasoning = `نسبة BTTS ${bttsProbability}% ومتوسط الأهداف ${totalAvgGoals.toFixed(1)} يدعمان كلا الفريقين للتسجيل.`;
  } else if (totalAvgGoals <= 2.2 || (over25Percent <= 35)) {
    recommendation = "Under 2.5 Goals ✅";
    confidence = Math.min(80, Math.floor(100 - over25Percent));
    reasoning = `متوسط الأهداف منخفض (${totalAvgGoals.toFixed(1)}/مباراة) ونسبة الأهداف ${over25Percent}%.`;
  } else if (homeScored > 75 && awayScored < 50) {
    recommendation = "Home Win ✅";
    confidence = Math.min(85, homeScored);
    reasoning = `الفريق أ يهاجم بقوة (${homeScored}% يسجل) بينما الفريق ب يعاني هجومياً (${awayScored}%).`;
  } else if (awayScored > 75 && homeScored < 50) {
    recommendation = "Away Win ✅";
    confidence = Math.min(85, awayScored);
    reasoning = `الفريق ب أقوى هجوماً (${awayScored}% يسجل) وقد يفاجئ الفريق أ.`;
  } else {
    recommendation = "BTTS or Over 1.5 Goals ✅";
    confidence = 70;
    reasoning = "المباراة متوازنة مع توقع وجود أهداف.";
  }

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
