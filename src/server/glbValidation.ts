/**
 * GLB（glTF-Binary）结构校验。
 *
 * 服务端不能相信浏览器给的 MIME：上传完成后必须按字节校验文件本身。
 * 只接受自包含的单文件 GLB —— 依赖外部 .bin / 纹理的模型会导致买家端缺资源，
 * 因此 JSON chunk 里出现任何外部 uri 都判定无效。
 */

export type GlbVerdict = { ok: true } | { ok: false; reason: string };

const GLB_MAGIC = 'glTF';
const CHUNK_TYPE_JSON = 0x4e4f534a;
const CHUNK_TYPE_BIN = 0x004e4942;

export function validateGlbStructure(buffer: Buffer, expectedSize: number): GlbVerdict {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 20) return { ok: false, reason: 'GLB_TOO_SMALL' };
  if (buffer.length < 20) return { ok: false, reason: 'GLB_HEADER_TRUNCATED' };
  if (buffer.toString('ascii', 0, 4) !== GLB_MAGIC) return { ok: false, reason: 'GLB_MAGIC_INVALID' };
  const version = buffer.readUInt32LE(4);
  if (version !== 2) return { ok: false, reason: 'GLB_VERSION_UNSUPPORTED' };
  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength !== expectedSize) return { ok: false, reason: 'GLB_LENGTH_MISMATCH' };
  // 声明长度还必须与真实读到的字节数一致，避免 HEAD 与实际对象不一致
  if (buffer.length !== expectedSize) return { ok: false, reason: 'GLB_SIZE_MISMATCH' };

  // 第一个 chunk 必须是 JSON
  let offset = 12;
  if (offset + 8 > buffer.length) return { ok: false, reason: 'GLB_CHUNK_TRUNCATED' };
  const jsonLength = buffer.readUInt32LE(offset);
  const jsonType = buffer.readUInt32LE(offset + 4);
  if (jsonType !== CHUNK_TYPE_JSON) return { ok: false, reason: 'GLB_JSON_CHUNK_MISSING' };
  if (!Number.isSafeInteger(jsonLength) || jsonLength <= 0) return { ok: false, reason: 'GLB_JSON_CHUNK_INVALID' };
  const jsonStart = offset + 8;
  const jsonEnd = jsonStart + jsonLength;
  if (jsonEnd > buffer.length) return { ok: false, reason: 'GLB_JSON_CHUNK_OUT_OF_RANGE' };

  let document: any;
  try {
    document = JSON.parse(buffer.toString('utf8', jsonStart, jsonEnd));
  } catch {
    return { ok: false, reason: 'GLB_JSON_PARSE_FAILED' };
  }
  if (!document || typeof document !== 'object') return { ok: false, reason: 'GLB_JSON_INVALID' };
  if (document.asset?.version !== '2.0') return { ok: false, reason: 'GLB_ASSET_VERSION_INVALID' };

  // 单文件 GLB 的 buffers 只能指向自身 BIN chunk（无 uri）
  const buffers = Array.isArray(document.buffers) ? document.buffers : [];
  if (buffers.some((item: any) => typeof item?.uri === 'string' && item.uri.length > 0)) {
    return { ok: false, reason: 'GLB_EXTERNAL_BUFFER_REFERENCE' };
  }
  const images = Array.isArray(document.images) ? document.images : [];
  if (images.some((item: any) => typeof item?.uri === 'string' && item.uri.length > 0)) {
    return { ok: false, reason: 'GLB_EXTERNAL_IMAGE_REFERENCE' };
  }
  // 至少要有一个 mesh，否则不是可展示的商品模型
  const meshes = Array.isArray(document.meshes) ? document.meshes : [];
  const nodes = Array.isArray(document.nodes) ? document.nodes : [];
  if (!meshes.length || !nodes.length) return { ok: false, reason: 'GLB_NO_MESH' };

  // 第二种 chunk 若存在必须是 BIN，且范围合法
  offset = jsonEnd;
  if (offset + 8 <= buffer.length) {
    const binLength = buffer.readUInt32LE(offset);
    const binType = buffer.readUInt32LE(offset + 4);
    if (binType !== CHUNK_TYPE_BIN) return { ok: false, reason: 'GLB_BIN_CHUNK_INVALID' };
    if (!Number.isSafeInteger(binLength) || offset + 8 + binLength > buffer.length) {
      return { ok: false, reason: 'GLB_BIN_CHUNK_OUT_OF_RANGE' };
    }
  }
  return { ok: true };
}
