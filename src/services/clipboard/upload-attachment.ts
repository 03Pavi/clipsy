export async function uploadAttachment(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/attachments', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload attachment');
  }

  const data = await response.json();

  if (data.success && data.success.length > 0) {
    return data.success[0];
  }

  if (data.failed && data.failed.length > 0) {
    throw new Error(data.failed[0].reason);
  }

  throw new Error('Upload failed');
}
