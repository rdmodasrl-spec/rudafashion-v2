/**
 * GLB（glTF-Binary, glTF 2.0）结构校验。
 *
 * 服务端不能相信浏览器给的 MIME：上传完成后必须按字节校验文件本身。
 *
 * 策略：只接受**自包含**的单文件 GLB。
 * - 允许符合规范的内嵌 `data:` URI（base64 资源在文件内部，不产生网络请求）；
 * - 拒绝外部相对/绝对路径（.bin、纹理），因为买家端会缺资源。
 *
 * 校验分两层：
 * 1) 容器层：magic / 版本 / 总长度 / chunk 顺序 / 4 字节对齐 / 尾随垃圾字节 / BIN 长度
 * 2) 结构层：buffer、bufferView、accessor、mesh primitive、node 的引用必须真实存在且范围合法
 *
 * 只数 mesh 数量不足以证明模型有效，所以结构层是必需的。
 */

export type GlbVerdict = { ok: true } | { ok: false; reason: string };

const GLB_MAGIC = 'glTF';
const CHUNK_TYPE_JSON = 0x4e4f534a;
const CHUNK_TYPE_BIN = 0x004e4942;
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

/** glTF 2.0 accessor componentType → 每个分量的字节数 */
const COMPONENT_BYTES: Record<number, number> = {
  5120: 1, // BYTE
  5121: 1, // UNSIGNED_BYTE
  5122: 2, // SHORT
  5123: 2, // UNSIGNED_SHORT
  5125: 4, // UNSIGNED_INT
  5126: 4  // FLOAT
};

/** accessor.type → 分量个数 */
const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16
};

const isDataUri = (value: unknown): boolean =>
  typeof value === 'string' && /^data:[^,]*,/i.test(value);

/** 既不是 data URI 又非空的字符串 = 外部引用，一律拒绝 */
const isExternalReference = (value: unknown): boolean =>
  typeof value === 'string' && value.length > 0 && !isDataUri(value);

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * 容器层：读 chunk 表，校验顺序、对齐、长度与尾随字节。
 * 成功返回 JSON 文档与 BIN chunk 长度（无 BIN 时为 null）。
 */
function readContainer(buffer: Buffer, expectedSize: number):
  | { ok: true; document: any; binLength: number | null }
  | { ok: false; reason: string } {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < HEADER_BYTES + CHUNK_HEADER_BYTES) {
    return { ok: false, reason: 'GLB_TOO_SMALL' };
  }
  if (buffer.length < HEADER_BYTES + CHUNK_HEADER_BYTES) return { ok: false, reason: 'GLB_HEADER_TRUNCATED' };
  if (buffer.toString('ascii', 0, 4) !== GLB_MAGIC) return { ok: false, reason: 'GLB_MAGIC_INVALID' };
  if (buffer.readUInt32LE(4) !== 2) return { ok: false, reason: 'GLB_VERSION_UNSUPPORTED' };

  // 总长度必须同时等于「声明值」「对象大小」「实际读到的字节数」
  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength !== expectedSize) return { ok: false, reason: 'GLB_LENGTH_MISMATCH' };
  if (buffer.length !== expectedSize) return { ok: false, reason: 'GLB_SIZE_MISMATCH' };

  // 第一个 chunk 必须是 JSON
  let offset = HEADER_BYTES;
  const jsonLength = buffer.readUInt32LE(offset);
  const jsonType = buffer.readUInt32LE(offset + 4);
  if (jsonType !== CHUNK_TYPE_JSON) return { ok: false, reason: 'GLB_JSON_CHUNK_NOT_FIRST' };
  if (!isNonNegativeInt(jsonLength) || jsonLength <= 0) return { ok: false, reason: 'GLB_JSON_CHUNK_INVALID' };
  if (jsonLength % 4 !== 0) return { ok: false, reason: 'GLB_JSON_CHUNK_UNALIGNED' };
  const jsonStart = offset + CHUNK_HEADER_BYTES;
  const jsonEnd = jsonStart + jsonLength;
  if (jsonEnd > buffer.length) return { ok: false, reason: 'GLB_JSON_CHUNK_OUT_OF_RANGE' };

  let document: any;
  try {
    document = JSON.parse(buffer.toString('utf8', jsonStart, jsonEnd));
  } catch {
    return { ok: false, reason: 'GLB_JSON_PARSE_FAILED' };
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return { ok: false, reason: 'GLB_JSON_INVALID' };
  }
  if (document.asset?.version !== '2.0') return { ok: false, reason: 'GLB_ASSET_VERSION_INVALID' };

  // 后续 chunk：只允许一个 BIN，且必须是最后一个；长度 4 字节对齐；不允许尾随垃圾
  offset = jsonEnd;
  let binLength: number | null = null;
  while (offset < buffer.length) {
    if (offset + CHUNK_HEADER_BYTES > buffer.length) return { ok: false, reason: 'GLB_TRAILING_BYTES' };
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    if (!isNonNegativeInt(length) || length % 4 !== 0) return { ok: false, reason: 'GLB_CHUNK_UNALIGNED' };
    if (type === CHUNK_TYPE_JSON) return { ok: false, reason: 'GLB_DUPLICATE_JSON_CHUNK' };
    if (type !== CHUNK_TYPE_BIN) return { ok: false, reason: 'GLB_UNKNOWN_CHUNK' };
    if (binLength !== null) return { ok: false, reason: 'GLB_DUPLICATE_BIN_CHUNK' };
    const end = offset + CHUNK_HEADER_BYTES + length;
    if (end > buffer.length) return { ok: false, reason: 'GLB_BIN_CHUNK_OUT_OF_RANGE' };
    binLength = length;
    offset = end;
  }

  return { ok: true, document, binLength };
}

/** 结构层：buffer / bufferView / accessor / mesh / node / scene 的引用与范围。 */
function validateDocument(document: any, binLength: number | null): GlbVerdict {
  const buffers: any[] = Array.isArray(document.buffers) ? document.buffers : [];
  const bufferViews: any[] = Array.isArray(document.bufferViews) ? document.bufferViews : [];
  const accessors: any[] = Array.isArray(document.accessors) ? document.accessors : [];
  const meshes: any[] = Array.isArray(document.meshes) ? document.meshes : [];
  const nodes: any[] = Array.isArray(document.nodes) ? document.nodes : [];
  const materials: any[] = Array.isArray(document.materials) ? document.materials : [];

  // 1) buffers：外部路径拒绝；内嵌 data URI 或引用 BIN chunk 才允许
  for (const buffer of buffers) {
    if (!buffer || typeof buffer !== 'object') return { ok: false, reason: 'GLB_BUFFER_INVALID' };
    if (isExternalReference(buffer.uri)) return { ok: false, reason: 'GLB_EXTERNAL_BUFFER_REFERENCE' };
    if (!isNonNegativeInt(buffer.byteLength) || buffer.byteLength <= 0) {
      return { ok: false, reason: 'GLB_BUFFER_LENGTH_INVALID' };
    }
  }
  const glbBuffers = buffers.filter(buffer => buffer.uri === undefined);
  if (glbBuffers.length > 1) return { ok: false, reason: 'GLB_MULTIPLE_BIN_BUFFERS' };
  if (glbBuffers.length === 1) {
    // 声明了 GLB buffer 就必须有 BIN chunk，且 BIN 必须装得下它
    if (binLength === null) return { ok: false, reason: 'GLB_BIN_CHUNK_MISSING' };
    if (glbBuffers[0].byteLength > binLength) return { ok: false, reason: 'GLB_BUFFER_EXCEEDS_BIN' };
  }

  // 2) bufferViews：不引用外部 uri，范围必须落在所属 buffer 内
  for (const view of bufferViews) {
    if (!view || typeof view !== 'object') return { ok: false, reason: 'GLB_BUFFER_VIEW_INVALID' };
    if (view.uri !== undefined && isExternalReference(view.uri)) {
      return { ok: false, reason: 'GLB_EXTERNAL_BUFFER_VIEW_REFERENCE' };
    }
    if (!isNonNegativeInt(view.buffer) || view.buffer >= buffers.length) {
      return { ok: false, reason: 'GLB_BUFFER_VIEW_BUFFER_INVALID' };
    }
    if (!isNonNegativeInt(view.byteLength) || view.byteLength <= 0) {
      return { ok: false, reason: 'GLB_BUFFER_VIEW_LENGTH_INVALID' };
    }
    const byteOffset = view.byteOffset === undefined ? 0 : view.byteOffset;
    if (!isNonNegativeInt(byteOffset)) return { ok: false, reason: 'GLB_BUFFER_VIEW_OFFSET_INVALID' };
    if (byteOffset + view.byteLength > buffers[view.buffer].byteLength) {
      return { ok: false, reason: 'GLB_BUFFER_VIEW_OUT_OF_RANGE' };
    }
  }

  // 3) accessors：类型合法，引用存在的 bufferView 且不越界
  for (const accessor of accessors) {
    if (!accessor || typeof accessor !== 'object') return { ok: false, reason: 'GLB_ACCESSOR_INVALID' };
    const componentBytes = COMPONENT_BYTES[accessor.componentType];
    const components = TYPE_COMPONENTS[accessor.type];
    if (!componentBytes || !components) return { ok: false, reason: 'GLB_ACCESSOR_TYPE_INVALID' };
    if (!isNonNegativeInt(accessor.count) || accessor.count <= 0) {
      return { ok: false, reason: 'GLB_ACCESSOR_COUNT_INVALID' };
    }
    if (accessor.bufferView !== undefined) {
      if (!isNonNegativeInt(accessor.bufferView) || accessor.bufferView >= bufferViews.length) {
        return { ok: false, reason: 'GLB_ACCESSOR_BUFFER_VIEW_INVALID' };
      }
      const view = bufferViews[accessor.bufferView];
      const elementBytes = componentBytes * components;
      const byteOffset = accessor.byteOffset === undefined ? 0 : accessor.byteOffset;
      if (!isNonNegativeInt(byteOffset)) return { ok: false, reason: 'GLB_ACCESSOR_OFFSET_INVALID' };
      if (byteOffset + elementBytes * accessor.count > view.byteLength) {
        return { ok: false, reason: 'GLB_ACCESSOR_OUT_OF_RANGE' };
      }
    }
  }

  // 4) meshes：每个 primitive 的 attribute / indices / material 引用都要有效
  if (!meshes.length) return { ok: false, reason: 'GLB_NO_MESH' };
  for (const mesh of meshes) {
    if (!mesh || typeof mesh !== 'object') return { ok: false, reason: 'GLB_MESH_INVALID' };
    const primitives = Array.isArray(mesh.primitives) ? mesh.primitives : [];
    if (!primitives.length) return { ok: false, reason: 'GLB_MESH_NO_PRIMITIVE' };
    for (const primitive of primitives) {
      if (!primitive || typeof primitive !== 'object') return { ok: false, reason: 'GLB_PRIMITIVE_INVALID' };
      const attributes = primitive.attributes;
      if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
        return { ok: false, reason: 'GLB_PRIMITIVE_ATTRIBUTES_MISSING' };
      }
      const attributeAccessors = Object.values(attributes);
      if (!attributeAccessors.length) return { ok: false, reason: 'GLB_PRIMITIVE_ATTRIBUTES_MISSING' };
      for (const accessorIndex of attributeAccessors) {
        if (!isNonNegativeInt(accessorIndex) || accessorIndex >= accessors.length) {
          return { ok: false, reason: 'GLB_PRIMITIVE_ATTRIBUTE_ACCESSOR_INVALID' };
        }
      }
      if (primitive.indices !== undefined) {
        if (!isNonNegativeInt(primitive.indices) || primitive.indices >= accessors.length) {
          return { ok: false, reason: 'GLB_PRIMITIVE_INDICES_INVALID' };
        }
      }
      if (primitive.material !== undefined) {
        if (!isNonNegativeInt(primitive.material) || primitive.material >= materials.length) {
          return { ok: false, reason: 'GLB_PRIMITIVE_MATERIAL_INVALID' };
        }
      }
    }
  }

  // 5) nodes：mesh / children 引用必须有效
  if (!nodes.length) return { ok: false, reason: 'GLB_NO_NODE' };
  for (const node of nodes) {
    if (!node || typeof node !== 'object') return { ok: false, reason: 'GLB_NODE_INVALID' };
    if (node.mesh !== undefined) {
      if (!isNonNegativeInt(node.mesh) || node.mesh >= meshes.length) {
        return { ok: false, reason: 'GLB_NODE_MESH_INVALID' };
      }
    }
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) return { ok: false, reason: 'GLB_NODE_CHILDREN_INVALID' };
      for (const childIndex of node.children) {
        if (!isNonNegativeInt(childIndex) || childIndex >= nodes.length) {
          return { ok: false, reason: 'GLB_NODE_CHILD_INVALID' };
        }
      }
    }
  }

  // 6) images：允许内嵌 data URI 或 bufferView，拒绝外部路径
  const images: any[] = Array.isArray(document.images) ? document.images : [];
  for (const image of images) {
    if (!image || typeof image !== 'object') return { ok: false, reason: 'GLB_IMAGE_INVALID' };
    if (image.uri !== undefined && isExternalReference(image.uri)) {
      return { ok: false, reason: 'GLB_EXTERNAL_IMAGE_REFERENCE' };
    }
    if (image.bufferView !== undefined) {
      if (!isNonNegativeInt(image.bufferView) || image.bufferView >= bufferViews.length) {
        return { ok: false, reason: 'GLB_IMAGE_BUFFER_VIEW_INVALID' };
      }
    }
    if (image.uri === undefined && image.bufferView === undefined) {
      return { ok: false, reason: 'GLB_IMAGE_SOURCE_MISSING' };
    }
  }

  // 7) 场景与根节点引用
  const scenes: any[] = Array.isArray(document.scenes) ? document.scenes : [];
  if (document.scene !== undefined) {
    if (!isNonNegativeInt(document.scene) || document.scene >= scenes.length) {
      return { ok: false, reason: 'GLB_SCENE_INDEX_INVALID' };
    }
  }
  for (const scene of scenes) {
    if (!scene || typeof scene !== 'object') return { ok: false, reason: 'GLB_SCENE_INVALID' };
    if (scene.nodes !== undefined) {
      if (!Array.isArray(scene.nodes)) return { ok: false, reason: 'GLB_SCENE_NODES_INVALID' };
      for (const nodeIndex of scene.nodes) {
        if (!isNonNegativeInt(nodeIndex) || nodeIndex >= nodes.length) {
          return { ok: false, reason: 'GLB_SCENE_NODE_INVALID' };
        }
      }
    }
  }

  return { ok: true };
}

export function validateGlbStructure(buffer: Buffer, expectedSize: number): GlbVerdict {
  const container = readContainer(buffer, expectedSize);
  if (container.ok === false) return container;
  return validateDocument(container.document, container.binLength);
}
