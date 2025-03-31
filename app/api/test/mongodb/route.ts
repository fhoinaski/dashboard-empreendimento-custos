import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';

export async function GET() {
  try {
    await connectToDatabase();
    return NextResponse.json({ success: true, message: 'MongoDB conectado' });
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    return NextResponse.json({ success: false, error: 'Falha ao conectar ao MongoDB' }, { status: 500 });
  }
}