const maximumVideoDurationSeconds = 180;
const ebmlSegmentId = 0x18538067;
const ebmlInfoId = 0x1549a966;
const ebmlTimecodeScaleId = 0x2ad7b1;
const ebmlDurationId = 0x4489;

type Mp4Box = { type: string; payloadStart: number; end: number };
type EbmlElement = { id: number; payloadStart: number; end: number };

const readMp4Boxes = (bytes: Buffer, start: number, end: number): Mp4Box[] => {
  const boxes: Mp4Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      const extendedSize = bytes.readBigUInt64BE(offset + 8);
      if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(extendedSize);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) break;
    boxes.push({ type, payloadStart: offset + headerSize, end: offset + size });
    offset += size;
  }
  return boxes;
};

const getMp4DurationSeconds = (bytes: Buffer): number | null => {
  const topLevel = readMp4Boxes(bytes, 0, bytes.length);
  if (!topLevel.some(box => box.type === 'ftyp')) return null;
  const moov = topLevel.find(box => box.type === 'moov');
  if (!moov) return null;
  const moovBoxes = readMp4Boxes(bytes, moov.payloadStart, moov.end);
  const readMediaHeader = (box: Mp4Box | undefined): number | null => {
    if (!box || box.payloadStart + 20 > box.end) return null;
    const version = bytes[box.payloadStart];
    const timescaleOffset = box.payloadStart + (version === 1 ? 20 : 12);
    const durationOffset = box.payloadStart + (version === 1 ? 24 : 16);
    if (version !== 0 && version !== 1) return null;
    if (timescaleOffset + 4 > box.end) return null;
    const timescale = bytes.readUInt32BE(timescaleOffset);
    if (!timescale) return null;
    if (version === 1) {
      if (durationOffset + 8 > box.end) return null;
      const duration = bytes.readBigUInt64BE(durationOffset);
      if (duration === 0xffffffffffffffffn) return null;
      return Number(duration) / timescale;
    }
    if (durationOffset + 4 > box.end) return null;
    const duration = bytes.readUInt32BE(durationOffset);
    if (duration === 0xffffffff) return null;
    return duration / timescale;
  };
  const movieDuration = readMediaHeader(moovBoxes.find(box => box.type === 'mvhd'));
  if (movieDuration === null) return null;
  const trackDurations = moovBoxes.filter(box => box.type === 'trak').map(track => {
    const media = readMp4Boxes(bytes, track.payloadStart, track.end).find(box => box.type === 'mdia');
    const mediaHeader = media && readMp4Boxes(bytes, media.payloadStart, media.end).find(box => box.type === 'mdhd');
    return readMediaHeader(mediaHeader);
  });
  const validTrackDurations = trackDurations.filter((duration): duration is number => duration !== null);
  if (validTrackDurations.length !== trackDurations.length) return null;
  return Math.max(movieDuration, ...validTrackDurations);
};

const readEbmlVint = (bytes: Buffer, offset: number, keepMarker: boolean): { value: number; length: number } | null => {
  if (offset >= bytes.length) return null;
  const first = bytes[offset];
  let mask = 0x80;
  let length = 1;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8 || offset + length > bytes.length || (keepMarker && length > 4)) return null;
  let value = keepMarker ? first : first & (mask - 1);
  for (let index = 1; index < length; index += 1) value = value * 256 + bytes[offset + index];
  return { value, length };
};

const readEbmlElements = (bytes: Buffer, start: number, end: number): EbmlElement[] => {
  const elements: EbmlElement[] = [];
  let offset = start;
  while (offset < end) {
    const id = readEbmlVint(bytes, offset, true);
    if (!id) break;
    const size = readEbmlVint(bytes, offset + id.length, false);
    if (!size) break;
    const payloadStart = offset + id.length + size.length;
    const unknownSizeMask = 2 ** (7 * size.length) - 1;
    const payloadSize = size.value === unknownSizeMask ? end - payloadStart : size.value;
    if (payloadSize < 0 || payloadStart + payloadSize > end) break;
    elements.push({ id: id.value, payloadStart, end: payloadStart + payloadSize });
    offset = payloadStart + payloadSize;
  }
  return elements;
};

const getEbmlDurationSeconds = (bytes: Buffer): number | null => {
  const header = readEbmlVint(bytes, 0, true);
  if (!header || header.value !== 0x1a45dfa3) return null;
  const headerSize = readEbmlVint(bytes, header.length, false);
  if (!headerSize) return null;
  const segment = readEbmlElements(bytes, header.length + headerSize.length + headerSize.value, bytes.length)
    .find(element => element.id === ebmlSegmentId);
  if (!segment) return null;
  const info = readEbmlElements(bytes, segment.payloadStart, segment.end).find(element => element.id === ebmlInfoId);
  if (!info) return null;
  const infoElements = readEbmlElements(bytes, info.payloadStart, info.end);
  const scaleElement = infoElements.find(element => element.id === ebmlTimecodeScaleId);
  const durationElement = infoElements.find(element => element.id === ebmlDurationId);
  if (!durationElement) return null;
  const scaleLength = scaleElement ? scaleElement.end - scaleElement.payloadStart : 0;
  if (scaleElement && (scaleLength < 1 || scaleLength > 6)) return null;
  const scale = scaleElement
    ? bytes.readUIntBE(scaleElement.payloadStart, scaleLength)
    : 1_000_000;
  const durationBytes = durationElement.end - durationElement.payloadStart;
  const duration = durationBytes === 4
    ? bytes.readFloatBE(durationElement.payloadStart)
    : durationBytes === 8
      ? bytes.readDoubleBE(durationElement.payloadStart)
      : NaN;
  return Number.isFinite(duration) && scale > 0 ? duration * scale / 1_000_000_000 : null;
};

export const getVideoDurationSeconds = (bytes: Buffer, contentType: string): number | null => {
  if (contentType === 'video/mp4' || contentType === 'video/quicktime') return getMp4DurationSeconds(bytes);
  if (contentType === 'video/webm') return getEbmlDurationSeconds(bytes);
  return null;
};

export const validateVideoDuration = (bytes: Buffer, contentType: string): boolean => {
  const duration = getVideoDurationSeconds(bytes, contentType);
  return duration !== null && Number.isFinite(duration) && duration > 0 && duration <= maximumVideoDurationSeconds;
};
