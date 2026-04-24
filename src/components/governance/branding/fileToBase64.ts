// Convert a File or Blob to a base64 data URI suitable for sending to the
// governance asset upload endpoints. Wraps the FileReader API in a Promise
// and surfaces a friendly error if the read fails.
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected non-string result from FileReader.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export function validateImageFile(
  file: File,
  allowed: string[] = ['image/png', 'image/jpeg', 'image/svg+xml'],
): string | null {
  if (!allowed.includes(file.type)) {
    return `Unsupported format. Use ${allowed.map((m) => m.split('/')[1]).join(', ')}.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum is 2 MB.`;
  }
  return null;
}
