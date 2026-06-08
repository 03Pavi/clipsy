export const encodeImage = ({
  file,
  quality = 0.6,
  maxWidth = 800,
}: {
  file: File;
  quality?: number;
  maxWidth?: number;
}): Promise<{
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.readAsDataURL(file);

    reader.onload = () => {
      const img = new Image();

      img.src = reader.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject("Canvas context not found");
          return;
        }

        let width = img.width;
        let height = img.height;

        // Resize large images
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed webp
        const compressedBase64 = canvas.toDataURL(
          "image/webp",
          quality
        );

        // Remove prefix
        const shortBase64 =
          compressedBase64.split(",")[1];

        resolve({
          base64: shortBase64,
          mimeType: "image/webp",
          width,
          height,
        });
      };

      img.onerror = reject;
    };

    reader.onerror = reject;
  });
};

export const decodeImage = ({
  base64,
  mimeType = "image/webp",
}: {
  base64: string;
  mimeType?: string;
}) => {
  return `data:${mimeType};base64,${base64}`;
};

export const downloadImageAsFormat = async (
  src: string,
  format: 'jpeg' | 'png' | 'webp',
  fileName: string = 'download'
) => {
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);

      const mimeType = `image/${format}`;
      const dataUrl = canvas.toDataURL(mimeType, 1.0);

      const link = document.createElement('a');
      link.download = `${fileName}.${format === 'jpeg' ? 'jpg' : format}`;
      link.href = dataUrl;
      link.click();
      resolve();
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for conversion'));
    };
  });
};
