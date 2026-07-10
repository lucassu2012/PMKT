import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, "$1:"));
const dataText = await fs.readFile(path.join(root, "province-data.js"), "utf8");
const jsonText = dataText.slice(dataText.indexOf("=") + 1).trim().replace(/;$/, "");
const dataset = JSON.parse(jsonText);

const expectedNames = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏",
  "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西",
  "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
];

assert.equal(dataset.dataVersion, "2026-07-10");
assert.equal(dataset.provinces.length, 31);
assert.deepEqual([...new Set(dataset.provinces.map((p) => p.name))].sort(), expectedNames.sort());
assert.deepEqual([1, 2, 3].map((wave) => dataset.provinces.filter((p) => p.wave === wave).length), [1, 4, 4]);
assert.equal(dataset.provinces.filter((p) => p.top1Intent).length, 10);
assert.equal(dataset.qualityIssueCount, 11);

for (const province of dataset.provinces) {
  const expectedLandscape = province.platform.bigData === "华为" && province.platform.iop === "华为"
    ? "强格局"
    : province.platform.bigData === "华为" || province.platform.iop === "华为"
      ? "部分格局"
      : "友商格局";
  assert.equal(province.landscape, expectedLandscape, `${province.name} 格局映射错误`);
  assert.equal(typeof province.kpiValuePct.stockMonthlyChurn, "number", `${province.name} 存量离网率未标准化`);
}

const xinjiang = dataset.provinces.find((p) => p.name === "新疆");
assert.equal(xinjiang.kpi.globalRetention, null);
assert.equal(xinjiang.kpiValuePct.globalRetention, null);
assert.ok(xinjiang.qualityFlags.some((flag) => flag.includes("跨表冲突")));

const html = await fs.readFile(path.join(root, "index.html"), "utf8");
assert.ok(html.includes("zlyj_battle_v4"));
assert.ok(html.includes("PMKT_PROVINCE_DATA"));
assert.ok(!html.includes("const SRCDATA"));
assert.ok(!html.includes("adoptAllBtn"));

const seedMatch = html.match(/const SEED = (\[[\s\S]*?\n\]);\n\n\/\* ============ Excel/);
assert.ok(seedMatch, "未找到 SEED 数据块");
const seed = vm.runInNewContext(`(${seedMatch[1]})`);
assert.equal(seed.length, 31);
const score = (p) => p.data * 0.3 + p.model * 0.2 + p.mkt * 0.3 + p.exp * 0.2;
const tier = (p) => {
  const raw = score(p) >= 4 ? "T1" : score(p) >= 3 ? "T2" : score(p) >= 2 ? "T3" : "T4";
  return p.data < 3 && ["T1", "T2"].includes(raw) ? "T3" : raw;
};
assert.deepEqual(["T1", "T2", "T3", "T4"].map((name) => seed.filter((p) => tier(p) === name).length), [0, 6, 19, 6]);

console.log(JSON.stringify({
  dataVersion: dataset.dataVersion,
  provinces: dataset.provinces.length,
  waves: [1, 2, 3].map((wave) => dataset.provinces.filter((p) => p.wave === wave).length),
  qualityIssues: dataset.qualityIssueCount,
  result: "ok",
}));
