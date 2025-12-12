// lib/storage.ts
/**
 * Storage utilities for handling media uploads
 * Currently using base64 from AI generation
 * Future: Can integrate Cloudinary/S3 for user-uploaded images
 */

// Placeholder for future image upload functionality
export async function uploadImage(base64Data: string): Promise<string> {
  // For now, return the base64 data URL as-is
  // Later: Upload to Cloudinary and return public URL
  return base64Data;
}

export async function deleteImage(imageUrl: string): Promise<boolean> {
  // Placeholder for future deletion logic
  console.log('Delete image:', imageUrl);
  return true;
}

/**
 * Convert base64 to file size in bytes
 */
export function getBase64Size(base64String: string): number {
  const base64Data = base64String.split(',')[1] || base64String;
  return Math.ceil((base64Data.length * 3) / 4);
}

/**
 * Validate image format
 */
export function isValidImageFormat(mimeType: string): boolean {
  const validFormats = ['image/jpeg', 'image/png', 'image/webp'];
  return validFormats.includes(mimeType);
}

// Export constants
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'webp'];
export const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];