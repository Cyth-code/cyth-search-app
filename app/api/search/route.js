import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { search, getIndexStats } from "../../../lib/searchIndex";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const sources = searchParams.get("sources")?.split(",").filter(Boolean) || [];
  const limit = parseInt(searchParams.get("limit") || "30");

  if (!query.trim()) return Response.json({ results: [], stats: getIndexStats() });

  const results = search(query, { sources, limit });
  return Response.json({ results, stats: getIndexStats(), query });
}
