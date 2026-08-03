// Client-side downscale/compress before upload, replacing expo-image-manipulator's role on
// mobile — same target (max ~1600px wide, JPEG ~0.6 quality) so receipt photos don't balloon the
// upload past the backend's 15MB multipart limit.
export async function resizeImageForUpload(file: File, maxWidth = 1600, quality = 0.6): Promise<Blob> {
  if (typeof createImageBitmap === "undefined") return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", quality);
  });
}
