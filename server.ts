import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload size for image uploads
  app.use(express.json({ limit: '50mb' }));

  // Initialize Gemini API
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Route for product image cataloging
  app.post("/api/catalog-product", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required" });
      }

      // Remove the data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            text: `Você é responsável por cadastrar produtos no banco de dados do aplicativo.

Sempre que receber as informações ou a imagem de um produto, gere um cadastro no formato JSON.

Formato obrigatório:

{
  "codigo": "",
  "nome": "",
  "descricao": ""
}

Regras:
- O código deve ser exatamente o código de barras ou identificação que aparece na imagem. Se não houver, deixe vazio.
- O nome deve ser o nome completo do produto.
- A descrição deve ser objetiva e profissional, baseada apenas na imagem.
- Retorne apenas o JSON, sem explicações ou markdown.`
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Data
            }
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              codigo: { type: Type.STRING },
              nome: { type: Type.STRING },
              descricao: { type: Type.STRING }
            },
            required: ["codigo", "nome", "descricao"]
          }
        }
      });

      const jsonStr = response.text?.trim() || "{}";
      const parsedData = JSON.parse(jsonStr);
      
      res.json(parsedData);
    } catch (error: any) {
      console.error("Error cataloging product:", error);
      res.status(500).json({ error: error.message || "Failed to process image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
