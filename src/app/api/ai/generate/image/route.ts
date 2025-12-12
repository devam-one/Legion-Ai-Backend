// app/api/ai/generate/image/route.ts
import { NextResponse } from 'next/server'; // FIX 5: Import NextResponse
import { generateImageSchema } from '@/lib/validations/ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = generateImageSchema.parse(body); // FIX 1 & 2: Schema is now consistently exported and imported
    
    // FIX 3: Now safe to use validated.prompt (e.g., call your AI API)
    console.log('Validated prompt:', validated.prompt);
    console.log('Validated style:', validated.style);

    // Example of a successful response (replace with actual API call result)
    return NextResponse.json({ message: 'Image generation request received', data: validated }, { status: 200 });

  } catch (error) {
    // FIX 4: Log the error to utilize the variable and help debugging
    console.error('Validation or processing error:', error); 
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
}
