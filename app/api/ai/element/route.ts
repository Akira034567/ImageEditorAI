import { NextResponse } from "next/server";
import { generateImage } from "@/lib/openaiImages";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = `Crie um elemento isolado para composicao em editor de imagens. Use fundo transparente se possivel. Elemento pedido: ${body.prompt}`;
    const result = await generateImage({ ...body, prompt, background: "transparent" });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 400 });
  }
}
