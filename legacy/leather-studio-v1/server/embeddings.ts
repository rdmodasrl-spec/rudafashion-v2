import { GoogleGenAI } from '@google/genai';

export const EMBEDDING_DIM = 256;

const LEATHER_DOMAIN_CONCEPTS: Array<{ dim: number; keywords: string[] }> = [
  { dim: 0, keywords: ['托特', 'tote', '敞口', '购物袋'] },
  { dim: 1, keywords: ['手提', 'handbag', '翻盖', '锁扣', 'box'] },
  { dim: 2, keywords: ['肩背', 'shoulder', '斜挎', '肩带', 'strap'] },
  { dim: 3, keywords: ['植鞣', 'veg_tan', '原皮', '打磨', 'burnish'] },
  { dim: 4, keywords: ['小牛皮', 'box_calf', 'soft_calf', 'calf', '油边', 'edge_paint'] },
  { dim: 5, keywords: ['荔枝纹', 'pebbled', '羊皮', 'lambskin', '柔软', 'soft'] },
  { dim: 6, keywords: ['内衬', 'lining', '内缩', '缩量', '堆褶', 'wrinkle'] },
  { dim: 7, keywords: ['底托', 'bottom_board', '皮糠纸', '加固', 'reinforcement'] },
  { dim: 8, keywords: ['折边', 'folded', '铲薄', 'skiving', 'skive', '爆裂'] },
  { dim: 9, keywords: ['滚边', 'piped', '胶骨', '高脚压脚'] },
  { dim: 10, keywords: ['提手', 'handle', '耳仔', 'anchor', '铆钉', 'rivet'] },
  { dim: 11, keywords: ['侧围', '侧片', 'gusset', '圆弧', 'curved', 'tapered'] },
  { dim: 12, keywords: ['拉链', 'zipper', '挡片', '开窗', 'flap'] },
  { dim: 13, keywords: ['缝份', 'seam_allowance', '接缝', '对位', 'mismatch', '误差'] },
  { dim: 14, keywords: ['排料', 'nesting', '纹理', 'grain', '省料', '浪费'] },
  { dim: 15, keywords: ['意式', 'italian', '高级', 'luxury', '定型'] },
];

export function computeDeterministicEmbedding(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  const normalized = text.toLowerCase().trim();

  // Domain concept signals (high-weight dims 0..15)
  for (const concept of LEATHER_DOMAIN_CONCEPTS) {
    for (const kw of concept.keywords) {
      if (normalized.includes(kw)) {
        vec[concept.dim] += 2.5;
      }
    }
  }

  // Character bi-gram & tri-gram hashing into dims 16..255
  for (let i = 0; i < normalized.length; i++) {
    const c1 = normalized.charCodeAt(i);
    const c2 = i + 1 < normalized.length ? normalized.charCodeAt(i + 1) : 0;
    const c3 = i + 2 < normalized.length ? normalized.charCodeAt(i + 2) : 0;
    const h1 = ((c1 * 131 + c2 * 31) >>> 0) % (EMBEDDING_DIM - 16);
    const h2 = ((c1 * 37 + c2 * 17 + c3 * 7) >>> 0) % (EMBEDDING_DIM - 16);
    vec[16 + h1] += 1.0;
    vec[16 + h2] += 0.6;
  }

  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    norm += vec[i] * vec[i];
  }
  const mag = Math.sqrt(norm) || 1;
  return vec.map((v) => Math.round((v / mag) * 1e6) / 1e6);
}

export async function generateSemanticEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return computeDeterministicEmbedding(text);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text.slice(0, 2000),
      config: {
        outputDimensionality: EMBEDDING_DIM,
      },
    });
    const values = response.embeddings?.[0]?.values;
    if (Array.isArray(values) && values.length === EMBEDDING_DIM) {
      let norm = 0;
      for (const v of values) norm += v * v;
      const mag = Math.sqrt(norm) || 1;
      return values.map((v) => Math.round((v / mag) * 1e6) / 1e6);
    }
  } catch {
    // Silent fallback to deterministic bilingual domain embedding
  }
  return computeDeterministicEmbedding(text);
}
