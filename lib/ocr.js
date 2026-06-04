import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function extractTextFromImage(base64Image, contentType = "image/png") {
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: contentType, data: base64Image },
            },
            {
              type: "text",
              text: `Extract ALL text visible in this image including printed text, handwriting, diagrams, tables, code, labels.
Return ONLY the extracted text. If no text exists, respond with exactly: NO_TEXT`,
            },
          ],
        },
      ],
    });
    const result = response.content[0]?.text || "";
    if (result.trim() === "NO_TEXT") return "";
    return result.trim();
  } catch (err) {
    console.error("OCR error:", err.message);
    return "";
  }
}
