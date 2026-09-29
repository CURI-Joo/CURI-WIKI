import sharp from 'sharp';
import { marked } from 'marked';
import { MAX_IMAGE_SIZE } from '../../upload-constraints';
import { assertPublicUrl } from './source';

const MIME_TYPES: Record<string, string> = {
  jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
};

async function downloadImage(rawUrl: string): Promise<Buffer> {
  let url = new URL(rawUrl);
  const signal = AbortSignal.timeout(15000);
  for (let hop = 0; hop <= 5; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, { redirect: 'manual', signal, headers: { accept: 'image/*' } });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      url = new URL(location, url);
      continue;
    }
    if (!response.ok || !response.body) throw new Error(`이미지 파일을 가져오지 못했습니다 (HTTP ${response.status}).`);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_IMAGE_SIZE) throw new Error('이미지는 10MB 이하여야 합니다.');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.concat(chunks);
  }
  throw new Error('이미지 리다이렉트가 너무 많습니다.');
}

export async function readImageFile(input: { data_base64?: unknown; file_url?: unknown; file_name?: unknown }) {
  if (Boolean(input.data_base64) === Boolean(input.file_url)) {
    throw new Error('원본 파일의 data_base64 또는 다운로드 가능한 file_url 중 하나를 지정하세요.');
  }
  let bytes: Buffer;
  if (input.file_url) {
    bytes = await downloadImage(String(input.file_url));
  } else {
    const value = String(input.data_base64);
    if (value.length > Math.ceil(MAX_IMAGE_SIZE / 3) * 4) throw new Error('이미지는 10MB 이하여야 합니다.');
    // Buffer.from silently skips non-base64 characters, including truncated tool output.
    if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
      throw new Error('이미지 데이터가 잘렸거나 올바르지 않습니다. 생략하지 않은 원본 파일을 업로드하세요.');
    }
    bytes = Buffer.from(value, 'base64');
    if (bytes.toString('base64') !== value) throw new Error('올바른 원본 파일 데이터가 필요합니다.');
  }
  if (!bytes.length || bytes.length > MAX_IMAGE_SIZE) throw new Error('이미지는 0바이트보다 크고 10MB 이하여야 합니다.');
  let format: string;
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    format = metadata.format ?? '';
    if (!MIME_TYPES[format]) throw new Error('unsupported');
    // Decode pixels too: a valid header alone cannot detect a truncated JPEG.
    await image.stats();
  } catch {
    throw new Error('열 수 없는 이미지입니다. 정상적인 PNG, JPEG, WEBP, GIF 원본 파일을 업로드하세요.');
  }
  const name = String(input.file_name || 'image').split(/[\\/]/).pop()!.replace(/\.[^.]*$/, '').slice(0, 120);
  return { bytes, mime_type: MIME_TYPES[format], file_name: `${name || 'image'}.${format === 'jpeg' ? 'jpg' : format}` };
}

function imageSources(markdown: string) {
  const sources = new Set<string>();
  marked.walkTokens(marked.lexer(markdown), (token) => {
    if (token.type === 'image') sources.add(token.href);
    // Abbreviated data URLs containing spaces become plain text to Markdown parsers.
    if (token.type === 'text') {
      for (const match of token.raw.matchAll(/!\[[^\]\n]*\]\(((?:data:|blob:|sandbox:|file:)[^\n)]*)/gi)) sources.add(match[1]);
    }
  });
  return sources;
}

export function requireUploadedImages(markdown: string, baseUrl: string, previous = '') {
  const existing = imageSources(previous);
  for (const source of imageSources(markdown)) {
    if (existing.has(source)) continue;
    const url = new URL(source, baseUrl);
    if (url.origin === new URL(baseUrl).origin && /^\/api\/upload\/[a-zA-Z0-9_-]+\/file$/.test(url.pathname) && !url.search && !url.hash) continue;
    throw new Error('사진은 원본 파일을 upload_image로 먼저 저장하고, 반환된 markdown_url로 삽입하세요. 새 글은 사진 없이 Draft로 만든 뒤 업로드하고 update_document로 사진을 추가하세요. 원본이 없으면 사진을 임의로 만들거나 깨진 주소를 넣지 마세요.');
  }
}
