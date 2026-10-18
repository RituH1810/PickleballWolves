"use client";

/**
 * Shrinks an image in the browser before upload so branding stays small: fits it inside
 * maxWidth x maxHeight (never enlarging) and re-encodes as PNG (logos keep transparency) or JPEG.
 */
export async function resizeImage(file: File, maxWidth: number, maxHeight: number, type: "image/png" | "image/jpeg") {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't process that image.");
  if (type === "image/jpeg") { context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  if (!blob) throw new Error("Couldn't process that image.");
  return new File([blob], type === "image/png" ? "image.png" : "image.jpg", { type });
}
