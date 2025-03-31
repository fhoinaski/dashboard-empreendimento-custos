import { NextResponse } from 'next/server';
import { hash } from 'bcrypt';
import connectToDatabase from '@/lib/db/mongodb';
import { User } from '@/lib/db/models';

export async function GET() {
  try {
    await connectToDatabase();

    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return NextResponse.json({ message: 'Admin já existe', email: adminExists.email });
    }

    const hashedPassword = await hash('12345678suki', 12);
    const adminUser = await User.create({
      name: 'Admin Test',
      email: 'sr.hoinaski@gmail.com',
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ message: 'Admin criado com sucesso', email: adminUser.email });
  } catch (error) {
    console.error('Erro ao criar admin:', error);
    return NextResponse.json({ error: 'Erro ao criar admin' }, { status: 500 });
  }
}