const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ─── SHARED ──────────────────────────────────────────────────────────────────

async function graphFetch(url, accessToken) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error(`Graph API error ${res.status} for ${url}`);
    return null;
  }
  return res.json();
}

export function htmlToText(html) {
  return (html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ─── ONENOTE ─────────────────────────────────────────────────────────────────

export async function getAllSections(accessToken) {
  const data = await graphFetch(`${GRAPH_BASE}/me/onenote/sections?$top=100`, accessToken);
  return data?.value || [];
}

export async function getPagesInSection(accessToken, sectionId) {
  const data = await graphFetch(
    `${GRAPH_BASE}/me/onenote/sections/${sectionId}/pages?$top=100&$select=id,title,createdDateTime,lastModifiedDateTime,parentSection,parentNotebook,links`,
    accessToken
  );
  return data?.value || [];
}

export async function getPageContent(accessToken, pageId) {
  const res = await fetch(`${GRAPH_BASE}/me/onenote/pages/${pageId}/content?includeIDs=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.text();
}

export async function getImageResource(accessToken, resourceUrl) {
  const res = await fetch(resourceUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = res.headers.get("content-type") || "image/png";
  return { base64, contentType };
}

export function extractImageUrls(htmlContent) {
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  const urls = [];
  let match;
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    const src = match[1];
    if (src.includes("graph.microsoft.com")) urls.push(src);
  }
  return [...new Set(urls)];
}

// ─── OUTLOOK ─────────────────────────────────────────────────────────────────

/**
 * Fetch recent emails (last 500, most recent first)
 */
export async function getEmails(accessToken) {
  const data = await graphFetch(
    `${GRAPH_BASE}/me/messages?$top=500&$select=id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,webLink&$orderby=receivedDateTime desc`,
    accessToken
  );
  return data?.value || [];
}

/**
 * Convert an email object into a flat indexable record
 */
export function emailToRecord(email) {
  const bodyText = htmlToText(email.body?.content || email.bodyPreview || "");
  const from = email.from?.emailAddress?.name || email.from?.emailAddress?.address || "";
  const to = (email.toRecipients || [])
    .map((r) => r.emailAddress?.name || r.emailAddress?.address || "")
    .join(", ");

  return {
    id: `email-${email.id}`,
    title: email.subject || "(No subject)",
    source: "Outlook",
    sourceIcon: "📧",
    bodyText: `From: ${from}\nTo: ${to}\n\n${bodyText}`,
    imageText: "",
    webUrl: email.webLink || "#",
    lastModified: email.receivedDateTime,
    meta: `From: ${from}`,
  };
}

// ─── TEAMS ───────────────────────────────────────────────────────────────────

/**
 * Fetch all Teams the user is a member of
 */
export async function getTeams(accessToken) {
  const data = await graphFetch(`${GRAPH_BASE}/me/joinedTeams`, accessToken);
  return data?.value || [];
}

/**
 * Fetch all channels in a Team
 */
export async function getChannels(accessToken, teamId) {
  const data = await graphFetch(`${GRAPH_BASE}/teams/${teamId}/channels`, accessToken);
  return data?.value || [];
}

/**
 * Fetch recent messages from a channel (last 50)
 */
export async function getChannelMessages(accessToken, teamId, channelId) {
  const data = await graphFetch(
    `${GRAPH_BASE}/teams/${teamId}/channels/${channelId}/messages?$top=50`,
    accessToken
  );
  return data?.value || [];
}

/**
 * Fetch recent chat messages (1:1 and group chats)
 */
export async function getChats(accessToken) {
  const data = await graphFetch(
    `${GRAPH_BASE}/me/chats?$expand=members&$top=30`,
    accessToken
  );
  return data?.value || [];
}

export async function getChatMessages(accessToken, chatId) {
  const data = await graphFetch(
    `${GRAPH_BASE}/me/chats/${chatId}/messages?$top=50`,
    accessToken
  );
  return data?.value || [];
}

/**
 * Convert a Teams channel message into a flat indexable record
 */
export function teamsMessageToRecord(msg, teamName, channelName, teamId, channelId) {
  const bodyText = htmlToText(msg.body?.content || "");
  if (!bodyText.trim()) return null; // skip empty/system messages

  const sender = msg.from?.user?.displayName || "Unknown";
  const webUrl = `https://teams.microsoft.com/l/message/${channelId}/${msg.id}?groupId=${teamId}`;

  return {
    id: `teams-${msg.id}`,
    title: bodyText.slice(0, 80) + (bodyText.length > 80 ? "…" : ""),
    source: "Teams",
    sourceIcon: "💬",
    bodyText: `${sender}: ${bodyText}`,
    imageText: "",
    webUrl,
    lastModified: msg.createdDateTime,
    meta: `${teamName} › ${channelName} · ${sender}`,
  };
}

/**
 * Convert a Teams chat message into a flat indexable record
 */
export function chatMessageToRecord(msg, chatTopic) {
  const bodyText = htmlToText(msg.body?.content || "");
  if (!bodyText.trim()) return null;

  const sender = msg.from?.user?.displayName || "Unknown";

  return {
    id: `chat-${msg.id}`,
    title: bodyText.slice(0, 80) + (bodyText.length > 80 ? "…" : ""),
    source: "Teams Chat",
    sourceIcon: "💬",
    bodyText: `${sender}: ${bodyText}`,
    imageText: "",
    webUrl: `https://teams.microsoft.com`,
    lastModified: msg.createdDateTime,
    meta: `Chat: ${chatTopic || "Direct Message"} · ${sender}`,
  };
}
