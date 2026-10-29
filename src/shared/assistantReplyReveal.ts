/**
 * ModaUI 回复文本的自然分段（V6）。
 *
 * `/api/merchant/assistant/query` 整包返回真实回复，前端不伪造文字，只决定“每次显示多少”。
 * 这里按自然句子/换行/合理长度切段，避免逐字闪烁，也避免一次性弹出整段造成突兀。
 * 分段只做位置计算，永远不会改写、增删或重排原文。
 */

export type AssistantReplyFrame = {
  /** 本帧结束后已显示的字符数（含）。 */
  end: number;
  /** 本帧新增的字符数，用于粒子核心的 response:chunk。 */
  delta: number;
};

const SENTENCE_END = /[。！？!?…]/;
const LINE_BREAK = /[\n\r]/;
const SOFT_BREAK = /[，,、：:；;—]/;
const TARGET_SEGMENT_CHARS = 42;
const MIN_SEGMENT_CHARS = 6;
const SHORT_REPLY_CHARS = 60;

export function splitAssistantReplySegments(text: string): string[] {
  if (!text) return [];
  const segments: string[] = [];
  let buffer = '';
  let softBreakAt = -1;
  const flush = (end: number) => {
    const segment = buffer.slice(0, end);
    if (segment) segments.push(segment);
    buffer = buffer.slice(end);
    softBreakAt = -1;
  };
  for (const char of text) {
    buffer += char;
    if (SOFT_BREAK.test(char)) softBreakAt = buffer.length;
    if (SENTENCE_END.test(char) || LINE_BREAK.test(char)) {
      if (buffer.length >= MIN_SEGMENT_CHARS) flush(buffer.length);
      continue;
    }
    if (buffer.length >= TARGET_SEGMENT_CHARS) {
      // 超长句优先在最近的逗号/冒号处断开，保持语义完整。
      flush(softBreakAt >= MIN_SEGMENT_CHARS ? softBreakAt : buffer.length);
    }
  }
  if (buffer) segments.push(buffer);
  return segments;
}

export function buildAssistantReplyFrames(text: string): AssistantReplyFrame[] {
  const segments = splitAssistantReplySegments(text);
  let shown = 0;
  return segments.map(segment => {
    shown += segment.length;
    return { end: shown, delta: segment.length };
  });
}

/** 每帧间隔：短回复稍慢一点读得清，长回复整体加快，避免用户等待动画。 */
export function assistantReplyFrameInterval(text: string): number {
  return text.length <= SHORT_REPLY_CHARS ? 34 : 26;
}
