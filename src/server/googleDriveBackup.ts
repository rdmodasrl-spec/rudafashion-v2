import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { JWT } from 'google-auth-library';

// Full Drive scope is required (not drive.file) because the service account must be able to
// write into a folder it did not create — the admin shares an existing Drive folder with the
// service account's email and grants it "编辑者/Editor" access.
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

export type GoogleDriveServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

export type GoogleDriveUploadResult = {
  fileId: string;
  webViewLink?: string;
};

export function parseGoogleDriveServiceAccount(raw: string): GoogleDriveServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_INVALID');
  }
  if (
    !parsed || typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>).client_email !== 'string' ||
    typeof (parsed as Record<string, unknown>).private_key !== 'string'
  ) {
    throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_INVALID');
  }
  const account = parsed as Record<string, unknown>;
  return {
    client_email: account.client_email as string,
    private_key: (account.private_key as string).replace(/\\n/g, '\n'),
    project_id: typeof account.project_id === 'string' ? account.project_id : undefined
  };
}

function createDriveClient(account: GoogleDriveServiceAccount): JWT {
  return new JWT({
    email: account.client_email,
    key: account.private_key,
    scopes: DRIVE_SCOPES
  });
}

async function driveAccessToken(account: GoogleDriveServiceAccount): Promise<string> {
  const client = createDriveClient(account);
  const tokenResponse = await client.authorize();
  if (!tokenResponse.access_token) throw new Error('GOOGLE_DRIVE_AUTH_FAILED');
  return tokenResponse.access_token;
}

/**
 * Verifies the service account can see the target folder (it must be shared with the
 * service account's client_email as an Editor first) and that it is really a folder.
 */
export async function testGoogleDriveConnection(
  account: GoogleDriveServiceAccount,
  folderId: string
): Promise<{ folderName: string }> {
  const token = await driveAccessToken(account);
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}`);
  url.searchParams.set('fields', 'id,name,mimeType,capabilities(canAddChildren)');
  url.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    if (response.status === 404) throw new Error('GOOGLE_DRIVE_FOLDER_NOT_FOUND');
    if (response.status === 403) throw new Error('GOOGLE_DRIVE_FOLDER_ACCESS_DENIED');
    throw new Error(`GOOGLE_DRIVE_API_ERROR_${response.status}`);
  }
  const data = await response.json() as { name: string; mimeType: string; capabilities?: { canAddChildren?: boolean } };
  if (data.mimeType !== 'application/vnd.google-apps.folder') throw new Error('GOOGLE_DRIVE_TARGET_NOT_A_FOLDER');
  if (data.capabilities && data.capabilities.canAddChildren === false) throw new Error('GOOGLE_DRIVE_FOLDER_NOT_WRITABLE');
  return { folderName: data.name };
}

/** Uploads a local file into the configured Drive folder via a multipart upload. */
export async function uploadFileToGoogleDrive(
  account: GoogleDriveServiceAccount,
  folderId: string,
  filePath: string,
  filename: string
): Promise<GoogleDriveUploadResult> {
  const token = await driveAccessToken(account);
  const info = await stat(filePath);
  const boundary = `ruda-drive-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });

  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    'utf8'
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--`, 'utf8');

  async function* body() {
    yield preamble;
    for await (const chunk of createReadStream(filePath)) yield chunk as Buffer;
    yield epilogue;
  }

  const url = new URL('https://www.googleapis.com/upload/drive/v3/files');
  url.searchParams.set('uploadType', 'multipart');
  url.searchParams.set('fields', 'id,webViewLink');
  url.searchParams.set('supportsAllDrives', 'true');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(preamble.length + info.size + epilogue.length)
    },
    // @ts-expect-error Node's fetch accepts an async iterable body for streaming uploads.
    body: body(),
    duplex: 'half'
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GOOGLE_DRIVE_UPLOAD_FAILED_${response.status}: ${text.slice(0, 300)}`);
  }
  const data = await response.json() as { id: string; webViewLink?: string };
  return { fileId: data.id, webViewLink: data.webViewLink };
}

export async function deleteFileFromGoogleDrive(account: GoogleDriveServiceAccount, fileId: string): Promise<void> {
  const token = await driveAccessToken(account);
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok && response.status !== 404) {
    throw new Error(`GOOGLE_DRIVE_DELETE_FAILED_${response.status}`);
  }
}
