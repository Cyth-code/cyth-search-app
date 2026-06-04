import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import {
  getAllSections, getPagesInSection, getPageContent,
  getImageResource, extractImageUrls, htmlToText,
  getEmails, emailToRecord,
  getTeams, getChannels, getChannelMessages, teamsMessageToRecord,
  getChats, getChatMessages, chatMessageToRecord,
} from "../../../lib/graph";
import { extractTextFromImage } from "../../../lib/ocr";
import { setIndex, getIndexStats } from "../../../lib/searchIndex";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { sources = ["onenote", "outlook", "teams"] } = await req.json().catch(() => ({}));
  const token = session.accessToken;
  const allRecords = [];

  if (sources.includes("onenote")) {
    try {
      const sections = await getAllSections(token);
      for (const section of sections) {
        const pages = await getPagesInSection(token, section.id);
        for (const page of pages) {
          let bodyText = "";
          let imageText = "";
          const html = await getPageContent(token, page.id);
          if (html) {
            bodyText = htmlToText(html);
            const imageUrls = extractImageUrls(html);
            const ocrResults = [];
            for (const url of imageUrls.slice(0, 10)) {
              const img = await getImageResource(token, url);
              if (img) {
                const text = await extractTextFromImage(img.base64, img.contentType);
                if (text) ocrResults.push(text);
              }
            }
            imageText = ocrResults.join("\n\n");
          }
          allRecords.push({
            id: `onenote-${page.id}`,
            title: page.title || "Untitled",
            source: "OneNote",
            sourceIcon: "📓",
            bodyText,
            imageText,
            webUrl: page.links?.oneNoteWebUrl?.href || page.links?.oneNoteClientUrl?.href || "#",
            lastModified: page.lastModifiedDateTime,
            meta: `${page.parentNotebook?.displayName || "Notebook"} › ${section.displayName}`,
          });
        }
      }
    } catch (e) {
      console.error("OneNote indexing error:", e.message);
    }
  }

  if (sources.includes("outlook")) {
    try {
      const emails = await getEmails(token);
      for (const email of emails) {
        allRecords.push(emailToRecord(email));
      }
    } catch (e) {
      console.error("Outlook indexing error:", e.message);
    }
  }

  if (sources.includes("teams")) {
    try {
      const teams = await getTeams(token);
      for (const team of teams) {
        const channels = await getChannels(token, team.id);
        for (const channel of channels) {
          const messages = await getChannelMessages(token, team.id, channel.id);
          for (const msg of messages) {
            const record = teamsMessageToRecord(msg, team.displayName, channel.displayName, team.id, channel.id);
            if (record) allRecords.push(record);
          }
        }
      }
      const chats = await getChats(token);
      for (const chat of chats.slice(0, 20)) {
        const messages = await getChatMessages(token, chat.id);
        for (const msg of messages) {
          const record = chatMessageToRecord(msg, chat.topic);
          if (record) allRecords.push(record);
        }
      }
    } catch (e) {
      console.error("Teams indexing error:", e.message);
    }
  }

  setIndex(allRecords);
  const stats = getIndexStats();

  return Response.json({
    success: true,
    message: `Indexed ${allRecords.length} items across ${Object.keys(stats.summary).join(", ")}`,
    stats,
  });
}

export async function GET() {
  return Response.json(getIndexStats());
}
