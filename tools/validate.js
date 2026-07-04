// 整合性チェックスクリプト — レシピヘルパー
// 実行: node tools/validate.js
// チェック内容:
//   1. id の重複・形式
//   2. genre / method が固定リストに含まれるか
//   3. main_ingredients が食材マスタと完全一致するか(1〜4個)
//   4. time_minutes / servings / steps の妥当性
//   5. 食材マスタのカバレッジ(主要食材として未使用の食材がないか)

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadVar(file, varName) {
  const code = fs.readFileSync(path.join(__dirname, "..", "data", file), "utf8");
  // constで宣言されているため、最後に変数名を評価して値を取り出す
  return vm.runInNewContext(code + "\n;" + varName + ";");
}

const INGREDIENTS = loadVar("ingredients.js", "INGREDIENTS");
const RECIPES = loadVar("recipes.js", "RECIPES");

const GENRES = ["和食", "洋食", "中華", "韓国・エスニック"];
const METHODS = ["焼く", "炒める", "煮る", "蒸す", "揚げる", "和える・生食", "汁物・鍋", "ごはん・麺"];

const master = new Set(Object.values(INGREDIENTS).flat());
const errors = [];
const seenIds = new Set();
const usedIngredients = new Set();

for (const r of RECIPES) {
  const tag = `${r.id} ${r.name}`;
  if (!/^r\d{3}$/.test(r.id)) errors.push(`${tag}: id形式が不正`);
  if (seenIds.has(r.id)) errors.push(`${tag}: idが重複`);
  seenIds.add(r.id);
  if (!GENRES.includes(r.genre)) errors.push(`${tag}: genre不正「${r.genre}」`);
  if (!METHODS.includes(r.method)) errors.push(`${tag}: method不正「${r.method}」`);
  if (!Array.isArray(r.main_ingredients) || r.main_ingredients.length < 1 || r.main_ingredients.length > 4) {
    errors.push(`${tag}: main_ingredientsは1〜4個(現在${r.main_ingredients.length}個)`);
  }
  for (const ing of r.main_ingredients) {
    if (!master.has(ing)) errors.push(`${tag}: マスタ外の食材「${ing}」`);
    usedIngredients.add(ing);
  }
  if (!Number.isFinite(r.time_minutes) || r.time_minutes <= 0) errors.push(`${tag}: time_minutes不正`);
  if (!Number.isFinite(r.servings) || r.servings <= 0) errors.push(`${tag}: servings不正`);
  if (!Array.isArray(r.steps) || r.steps.length < 3 || r.steps.length > 8) {
    errors.push(`${tag}: stepsは3〜8個(現在${r.steps.length}個)`);
  }
}

const unused = [...master].filter((i) => !usedIngredients.has(i));

console.log(`レシピ件数: ${RECIPES.length}`);
console.log(`食材マスタ: ${master.size}品 / 主要食材として使用済み: ${usedIngredients.size}品`);

const genreCount = {};
const methodCount = {};
for (const r of RECIPES) {
  genreCount[r.genre] = (genreCount[r.genre] || 0) + 1;
  methodCount[r.method] = (methodCount[r.method] || 0) + 1;
}
console.log("ジャンル内訳:", JSON.stringify(genreCount));
console.log("調理法内訳:", JSON.stringify(methodCount));

if (unused.length) console.log(`\n未使用の食材(${unused.length}品): ${unused.join("、")}`);
else console.log("\n全食材がいずれかのレシピの主要食材として使用されています");

// 主要食材としての登場回数と、3件未満の食材(底上げ対象)
const ingCount = {};
master.forEach((i) => (ingCount[i] = 0));
for (const r of RECIPES) for (const i of r.main_ingredients) if (i in ingCount) ingCount[i]++;
const under3 = Object.entries(ingCount).filter(([, v]) => v < 3).sort((a, b) => a[1] - b[1]);
console.log(`\n=== 主要食材として3件未満の食材: ${under3.length}品(目標: 0品)===`);
if (under3.length) console.log("  " + under3.map(([k, v]) => `${k}(${v})`).join("、"));

// 食材ペアのカバレッジ
const pairCnt = {};
for (const r of RECIPES) {
  const m = [...new Set(r.main_ingredients)];
  for (let i = 0; i < m.length; i++)
    for (let j = i + 1; j < m.length; j++) {
      const k = [m[i], m[j]].sort().join(" + ");
      pairCnt[k] = (pairCnt[k] || 0) + 1;
    }
}
console.log(`\n2つ同時に含むレシピが存在する食材ペア数: ${Object.keys(pairCnt).length}`);

if (errors.length) {
  console.log(`\nエラー ${errors.length}件:`);
  for (const e of errors) console.log("  - " + e);
  process.exit(1);
} else {
  console.log("エラー: なし ✓");
}
