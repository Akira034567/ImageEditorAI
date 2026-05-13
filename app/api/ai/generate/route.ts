import { NextResponse } from "next/server";
import { generateImage } from "@/lib/openaiImages";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await generateImage(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 400 });
  }
}
