'use strict';
// SWR（stale-while-revalidate）缓存行为单测：用桩替换全局 fetch，验证
// ①首次等待网络、二次命中缓存 ②过期先回旧值并后台刷新、成功后广播 ③并发去重
// ④强制刷新绕过缓存（轮询器依赖） ⑤预取去重与容错
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const sbRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'scoreboard.json'), 'utf8'));
const smRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'summary.json'), 'utf8'));

const ds = require('../src/main/dataService');
const DEFAULT_FRESHNESS = { ...ds.FRESHNESS };

let calls = [];
let delayMs = 0;
let failOnce = false;
const realFetch = global.fetch;

beforeEach(() => {
  ds.clearCaches();
  Object.assign(ds.FRESHNESS, DEFAULT_FRESHNESS);
  calls = [];
  delayMs = 0;
  failOnce = false;
  global.fetch = async (url) => {
    calls.push(String(url));
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (failOnce) { failOnce = false; throw new Error('simulated network error'); }
    const body = String(url).includes('summary') ? smRaw : sbRaw;
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) };
  };
});

afterEach(() => {
  global.fetch = realFetch;
});

test('首次读取等待网络，之后命中缓存不再发请求', async () => {
  const a = await ds.getScoreboard();
  assert.equal(calls.length, 1, '首次应触发一次网络请求');
  assert.equal(a.events.length, 2);
  const b = await ds.getScoreboard();
  assert.equal(calls.length, 1, '新鲜缓存不应再发请求');
  assert.deepEqual(a, b);
});

test('缓存过期：立即返回旧数据并后台刷新，刷新成功后广播更新', async () => {
  ds.FRESHNESS.scoreboard = 10; // 把新鲜期缩短以便触发过期路径
  await ds.getScoreboard();
  assert.equal(calls.length, 1);

  const kinds = [];
  ds.onUpdate((e) => kinds.push(e.kind));

  await new Promise((r) => setTimeout(r, 30)); // 等缓存过期
  delayMs = 40;                                 // 让后台刷新慢于本次读取，便于断言"没有等待"

  const t0 = Date.now();
  const stale = await ds.getScoreboard();
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 20, `过期时应立即返回旧数据（实测 ${elapsed}ms），而不是等网络`);
  assert.equal(stale.events.length, 2);
  assert.equal(calls.length, 2, '过期读取应触发一次后台刷新');

  await new Promise((r) => setTimeout(r, 80));
  assert.ok(kinds.includes('scoreboard'), '后台刷新成功应广播 scoreboard 更新');
});

test('并发的强制刷新只发一次网络请求（在途去重）', async () => {
  delayMs = 20;
  await Promise.all([ds.refreshScoreboard(), ds.refreshScoreboard(), ds.refreshScoreboard()]);
  assert.equal(calls.length, 1, '在途请求应合并为一次');
});

test('refreshScoreboard 强制走网络：轮询器不能被缓存短路', async () => {
  await ds.getScoreboard();          // 填满新鲜缓存
  assert.equal(calls.length, 1);
  await ds.refreshScoreboard();      // 强制刷新（关注事件检测依赖此路径）
  assert.equal(calls.length, 2, '强制刷新必须真的发起请求');
});

test('详情缓存：终场数据长缓存，重复读取不再请求', async () => {
  await ds.getSummary('401999002');
  assert.equal(calls.length, 1);
  await ds.getSummary('401999002');
  assert.equal(calls.length, 1, '已结束比赛的长缓存不应重复请求');
});

test('prefetchSummaries：重复 id 去重', async () => {
  await ds.prefetchSummaries(['7', '7', '7']);
  assert.equal(calls.length, 1, '同一场比赛只请求一次');
});

test('prefetchSummaries：单个失败不抛出、不影响其它', async () => {
  failOnce = true; // 第一场失败（fetchJson 会重试一次）
  await assert.doesNotReject(ds.prefetchSummaries(['a', 'b']), '预取失败不应向上抛出');
  assert.ok(calls.length >= 2, '失败后仍应继续预取其它比赛');
});

test('预取并发上限不超过 3（避免打爆免费接口）', async () => {
  let maxConcurrent = 0;
  let active = 0;
  global.fetch = async (url) => {
    calls.push(String(url));
    active++;
    maxConcurrent = Math.max(maxConcurrent, active);
    await new Promise((r) => setTimeout(r, 15));
    active--;
    return { ok: true, status: 200, json: async () => smRaw };
  };
  await ds.prefetchSummaries(['1', '2', '3', '4', '5', '6']);
  assert.ok(maxConcurrent <= 3, `并发应 ≤3，实测 ${maxConcurrent}`);
  assert.equal(calls.length, 6);
});
