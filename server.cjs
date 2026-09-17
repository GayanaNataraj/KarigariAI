const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const languageNames = {
  Kannada: "Kannada",
  Hindi: "Hindi",
  Telugu: "Telugu",
  Tamil: "Tamil",
  English: "English",
};

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Karigari AI backend is running",
  });
});


// ===============================
// VOICE / LANGUAGE TRANSLATION
// ===============================

app.post("/api/translate", async (req, res) => {
  try {
    const { text, sourceLanguage, targetLanguage } = req.body;

    if (!text || !sourceLanguage) {
      return res.status(400).json({
        error: "Text and source language are required.",
      });
    }

    if (!languageNames[sourceLanguage]) {
      return res.status(400).json({
        error: "Unsupported source language.",
      });
    }

    if (targetLanguage !== "English") {
      return res.status(400).json({
        error: "Only English translation is supported.",
      });
    }

    if (sourceLanguage === "English") {
      return res.json({
        translation: text.trim(),
        sourceLanguage,
        targetLanguage: "English",
      });
    }

    const language = languageNames[sourceLanguage];

    const prompt = `
Translate the following ${language} text into English.

IMPORTANT RULES:
1. Translate faithfully and accurately.
2. Preserve the original meaning.
3. Do not add information.
4. Do not remove information.
5. Do not rewrite it as marketing content.
6. Do not improve or beautify the sentence.
7. Preserve quantities, numbers, prices, measurements, and facts.
8. Return ONLY the English translation.
9. Do not add quotation marks.
10. Do not explain the translation.

Text to translate:
${text}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const translation = response.text?.trim();

    if (!translation) {
      return res.status(500).json({
        error: "The translation service returned no translation.",
      });
    }

    res.json({
      translation,
      sourceLanguage,
      targetLanguage: "English",
    });
  } catch (error) {
    console.error("Translation error:", error);

    res.status(500).json({
      error: "Translation service failed.",
    });
  }
});


// ===============================
// AI PRODUCT IMAGE ANALYSIS
// ===============================

app.post("/api/analyze-product", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Product image is required.",
      });
    }

    const description = req.body.description || "";

    const base64Image = req.file.buffer.toString("base64");

    const prompt = `
You are an AI assistant for rural Indian artisans.

Analyze the uploaded handmade product image carefully.

Use the user's description as additional information when provided.

User description:
${description}

Generate a product listing using ONLY information supported by:
1. The uploaded image.
2. The user's description.

Return ONLY valid JSON in exactly this format:

{
  "name": "",
  "category": "",
  "material": "",
  "description": "",
  "suggestedPrice": ""
}

Rules:
- "name": Give a clear, accurate product name.
- "category": Choose a suitable handicraft/product category.
- "material": Identify the material only when reasonably supported by the image or description. If uncertain, say "Handcrafted material".
- "description": Write a clear marketplace-ready description based only on the available information. Do not invent features.
- "suggestedPrice": Give a reasonable Indian Rupee price estimate for the visible product. Return only the amount with the ₹ symbol, for example "₹450".
- Do not invent brand names.
- Do not invent dimensions.
- Do not invent certifications.
- Do not invent seller information.
- Do not include seller in the JSON.
- Return JSON only.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: base64Image,
          },
        },
        {
          text: prompt,
        },
      ],
    });

    let resultText = response.text?.trim();

    if (!resultText) {
      return res.status(500).json({
        error: "AI returned no product analysis.",
      });
    }

    // Remove markdown code fences if the model adds them.
    resultText = resultText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let listing;

    try {
      listing = JSON.parse(resultText);
    } catch (parseError) {
      console.error("AI JSON parsing error:", parseError);
      console.error("AI response:", resultText);

      return res.status(500).json({
        error: "AI returned an invalid product listing.",
      });
    }

    res.json({
      success: true,
      listing: {
        name: listing.name || "",
        category: listing.category || "",
        material: listing.material || "",
        description: listing.description || description,
        suggestedPrice: listing.suggestedPrice || "",
        image: `data:${req.file.mimetype};base64,${base64Image}`,
        seller: "Demo Artisan",
      },
    });

  } catch (error) {
    console.error("Product analysis error:", error);

    res.status(500).json({
      error: "AI product analysis failed.",
    });
  }
});


const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Karigari AI backend running at http://localhost:${PORT}`);
});