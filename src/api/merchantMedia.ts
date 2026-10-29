import { apiPost } from './client';

export interface UploadedMerchantMedia {
  url: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
}

export async function uploadMerchantMedia(
  blob: Blob,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<UploadedMerchantMedia> {
  const result = await apiPost<{
    success: true;
    uploadUrl: string;
    publicUrl: string;
    key: string;
    contentType: string;
    sizeBytes: number;
  }>('/api/merchant/media/presign', { contentType, fileSize: blob.size });
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', result.uploadUrl);
    request.timeout = 14 * 60 * 1000;
    request.setRequestHeader('Content-Type', contentType);
    request.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error(`MEDIA_UPLOAD_FAILED_${request.status}`));
    request.onerror = () => reject(new Error('MEDIA_UPLOAD_CONNECTION_FAILED'));
    request.ontimeout = () => reject(new Error('MEDIA_UPLOAD_TIMEOUT'));
    request.onabort = () => reject(new Error('MEDIA_UPLOAD_ABORTED'));
    request.send(blob);
  });
  return {
    url: result.publicUrl,
    storageKey: result.key,
    contentType: result.contentType,
    sizeBytes: result.sizeBytes
  };
}
