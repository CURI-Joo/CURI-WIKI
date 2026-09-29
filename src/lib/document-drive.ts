const DRIVE_HEADER = /^<!-- curi:drive-url ([^\r\n]+) -->\r?\n(?:\r?\n)?/;
export const DRIVE_LINK_ERROR = 'Google Drive 또는 Google Docs의 공유 링크를 입력해 주세요.';

export function normalizeDriveUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error(DRIVE_LINK_ERROR);
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (text.length > 2048 || /[<>\\]/.test(text) || [...text].some(char => char.charCodeAt(0) <= 32)
      || url.protocol !== 'https:' || url.username || url.password || url.port
      || !['drive.google.com', 'docs.google.com'].includes(url.hostname)) throw new Error();
    return url.href;
  } catch {
    throw new Error(DRIVE_LINK_ERROR);
  }
}

/** A reserved document header travels with Markdown, independently of the editable body. */
export function readDriveMetadata(content: string): { driveUrl: string | null; body: string } {
  const match = DRIVE_HEADER.exec(content);
  if (match) {
    try {
      const driveUrl = normalizeDriveUrl(match[1]);
      if (driveUrl) return { driveUrl, body: content.slice(match[0].length) };
    } catch { /* Invalid headers remain literal document text. */ }
  }
  return { driveUrl: null, body: content };
}

export function writeDriveMetadata(content: string, driveUrl: unknown): string {
  const url = normalizeDriveUrl(driveUrl);
  const { body } = readDriveMetadata(content);
  return url ? `<!-- curi:drive-url ${url} -->\n\n${body}` : body;
}

/** Omitted link fields preserve the link during body-only edits, including MCP updates. */
export function mergeDriveMetadata(content: string, previousContent: string, driveUrl?: unknown): string {
  const url = driveUrl === undefined
    ? readDriveMetadata(content).driveUrl ?? readDriveMetadata(previousContent).driveUrl
    : driveUrl;
  return writeDriveMetadata(content, url);
}
