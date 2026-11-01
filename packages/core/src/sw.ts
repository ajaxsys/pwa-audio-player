/**
 * Range header parser result
 */
export interface ByteRange {
  start: number;
  end: number;
}

/**
 * Options for constructing a partial Response from audio data.
 */
export interface PartialResponseOptions {
  contentType?: string;
  extraHeaders?: Record<string, string>;
}

/**
 * Parses HTTP Range header string into normalized start and end byte indices.
 * Complies with RFC 7233 byte-range-spec.
 *
 * @param rangeHeader - e.g. "bytes=0-1023", "bytes=100-", "bytes=-500"
 * @param totalSize - Total size of the resource in bytes
 * @returns Normalized start and end indices, or null if invalid/unsatisfiable
 */
export function parseRangeHeader(
  rangeHeader: string | null | undefined,
  totalSize: number
): ByteRange | null {
  if (!rangeHeader || totalSize <= 0) return null;

  const match = rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return null;

  let start: number;
  let end: number;

  if (!startStr) {
    // Suffix range: bytes=-500 (last 500 bytes)
    const suffixLength = parseInt(endStr, 10);
    if (isNaN(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, totalSize - suffixLength);
    end = totalSize - 1;
  } else if (!endStr) {
    // Prefix range: bytes=100- (from byte 100 to end)
    start = parseInt(startStr, 10);
    if (isNaN(start) || start < 0) return null;
    end = totalSize - 1;
  } else {
    // Full range: bytes=100-200
    start = parseInt(startStr, 10);
    end = parseInt(endStr, 10);
    if (isNaN(start) || isNaN(end) || start < 0) return null;
  }

  // Bounds validation (RFC 7233: 416 range not satisfiable)
  if (start >= totalSize) return null;

  start = Math.max(0, Math.min(start, totalSize - 1));
  end = Math.max(start, Math.min(end, totalSize - 1));

  return { start, end };
}

/**
 * Creates an HTTP 206 Partial Content Response from a Blob and Range header.
 * Uses zero-copy Blob.slice to prevent memory bloat during audio seeking.
 *
 * @param blob - The full audio Blob
 * @param rangeHeader - HTTP Range header string (e.g. "bytes=100-499")
 * @param options - Additional options including contentType and extraHeaders
 */
export function createPartialResponseFromBlob(
  blob: Blob,
  rangeHeader: string | null | undefined,
  options?: PartialResponseOptions
): Response {
  const total = blob.size;
  const range = parseRangeHeader(rangeHeader, total);

  const contentType = options?.contentType || blob.type || 'audio/mpeg';
  const headers = new Headers(options?.extraHeaders);
  headers.set('Content-Type', contentType);
  headers.set('Accept-Ranges', 'bytes');

  if (!range) {
    headers.set('Content-Length', String(total));
    return new Response(blob, {
      status: 200,
      statusText: 'OK',
      headers
    });
  }

  const chunk = blob.slice(range.start, range.end + 1);
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${total}`);
  headers.set('Content-Length', String(chunk.size));

  return new Response(chunk, {
    status: 206,
    statusText: 'Partial Content',
    headers
  });
}

/**
 * Wraps a full 200 OK Response (e.g. from CacheStorage) and converts it to a 206 Partial Content Response
 * if the request included an HTTP Range header.
 *
 * @param fullResponse - The full 200 Response from CacheStorage
 * @param rangeHeader - HTTP Range header string
 */
export async function createPartialResponse(
  fullResponse: Response,
  rangeHeader: string | null | undefined
): Promise<Response> {
  if (!rangeHeader) {
    return fullResponse;
  }

  const blob = await fullResponse.blob();
  const baseHeaders = new Headers(fullResponse.headers);
  const extraHeaders: Record<string, string> = {};
  baseHeaders.forEach((val, key) => {
    extraHeaders[key] = val;
  });

  return createPartialResponseFromBlob(blob, rangeHeader, {
    contentType: baseHeaders.get('Content-Type') || blob.type || 'audio/mpeg',
    extraHeaders
  });
}

/**
 * Helper to check whether a URL or path refers to an audio stream.
 */
export function isAudioRequest(urlOrPath: string): boolean {
  if (!urlOrPath) return false;
  return (
    urlOrPath.includes('/stream') ||
    /\.(mp3|flac|wav|m4a|aac|ogg|opus)(\?.*)?$/i.test(urlOrPath)
  );
}
