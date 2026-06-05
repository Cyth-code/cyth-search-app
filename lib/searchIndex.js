import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const indexKey = (userId) => `cyth:index:${userId}`;
const metaKey  = (userId) => `cyth:meta:${userId}`;

export async function setIndex(userId, records) {
  const summary = records.reduce((acc, r) => {
    acc[r.source] = (acc[r.source] || 0) + 1;
    return acc;
  }, {});
  const meta = { total: records.length, lastIndexed: new Date().toISOString(), summary };
  await Promise.all([
    redis.set(indexKey(userId), JSON.stringify(records)),
    redis.set(metaKey(userId), JSON.stringify(meta)),
  ]);
  return meta;
}

export async function getIndex(userId) {
  const raw = await redis.get(indexKey(userId));
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function getIndexStats(userId) {
  const raw = await redis.get(metaKey(userId));
  if (!raw) return { total: 0, lastIndexed: null, summary: {} };
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function clearIndex(userId) {
  await Promise.all([redis.del(indexKey(userId)), redis.del(metaKey(userId))]);
}

export async function search(userId, query, { sources = [], limit = 30 } = {}) {
  if (!query) return [];
  const index = await getIndex(userId);
  if (index.length === 0) return [];

  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const phrase = query.toLowerCase();

  let pool = index;
  if (sources.length > 0) pool = index.filter((r) => sources.includes(r.source));

  return pool
    .map((record) => {
      const titleL = (record.title || "").toLowerCase();
      const bodyL  = (record.bodyText || "").toLowerCase();
      const imageL = (record.imageText || "").toLowerCase();
      const metaL  = (record.meta || "").toLowerCase();

      let score = 0;
      for (const term of terms) {
        const re = new RegExp(escapeRegex(term), "g");
        score += ((titleL.match(re) || []).length) * 10;
        score += ((bodyL.match(re)  || []).length) * 2;
        score += ((imageL.match(re) || []).length) * 3;
        score += ((metaL.match(re)  || []).length) * 4;
      }
      if (titleL.includes(phrase)) score += 15;
      if (bodyL.includes(phrase))  score += 5;
      if (imageL.includes(phrase)) score += 8;

      return { record, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ record, score }) => ({
      ...record,
      score,
      snippet: getSnippet((record.bodyText || "") + " " + (record.imageText || ""), terms),
    }));
}

function getSnippet(text, terms) {
  if (!text) return "";
  const lower = text.toLowerCase();
  let pos = -1;
  for (const term of terms) {
    pos = lower.indexOf(term);
    if (pos !== -1) break;
  }
  if (pos === -1) return text.slice(0, 200);
  const start = Math.max(0, pos - 80);
  const end = Math.min(text.length, pos + 120);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
