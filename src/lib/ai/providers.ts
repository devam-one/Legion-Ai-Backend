// lib/ai/providers.ts
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { experimental_generateImage as generateImage } from 'ai';

/**
 * AI Provider configuration
 * You can easily switch providers here
 */
export const AI_MODELS = {
  // Image generation
  image: {
    openai: openai.image('dall-e-3'),
    // Use 'gemini-2.5-flash-image' or 'imagen-4.0-generate-001' as supported identifiers
    google: google.image('imagen-4.0-generate-001'),
    google2: google.image('imagen-3'), // Alternative Google model
    // Add more providers as needed
  },
  
  // Text generation
  text: {
    openai: openai('gpt-4o'),
    gemini: google('gemini-1.5-pro'),
    gptMini: openai('gpt-4o-mini'), // Cheaper option
  },
} as const;

/**
 * Generate image using Vercel AI SDK
 * Supports multiple providers with same API
 */
export async function generateAIImage(prompt: string, provider: 'google' = 'google') {
  try {
    const { image } = await generateImage({
      model: AI_MODELS.image[provider],
      prompt: prompt,
      size: '1024x1024',
      providerOptions: {
        gemini: {
          quality: 'standard', // or 'hd' for premium
        },
      },
    });

    // Convert image to base64 data URL
    const base64Image = image.base64;
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return {
      success: true,
      url: dataUrl,
      base64: base64Image,
    };
  } catch (error) {
    console.error('AI image generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}

/**
 * Generate text using Vercel AI SDK
 * Can switch between OpenAI and Gemini easily
 */
export async function generateAIText(
  prompt: string, 
  provider: 'openai' | 'gemini' | 'gptMini' = 'gemini' // Gemini default (cheaper)
) {
  try {
    const { generateText } = await import('ai');
    
    const { text } = await generateText({
      model: AI_MODELS.text[provider],
      prompt: prompt,
      maxTokens: 500,
    });

    return {
      success: true,
      text: text,
    };
  } catch (error) {
    console.error('AI text generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}
