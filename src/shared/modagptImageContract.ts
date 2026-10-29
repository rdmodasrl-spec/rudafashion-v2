export const maximumModaGptImagePromptLength = 800;

const fashionDesignConceptDirections = [
  'Stay closest to the brief with a refined, commercially wearable interpretation.',
  'Explore a noticeably different silhouette and one distinctive construction detail while keeping the same garment category.',
  'Take a minimal, timeless approach with cleaner lines and restrained detailing.',
  'Explore a bolder editorial direction with a distinctive detail and considered color blocking.'
] as const;

export function buildFashionDesignConceptPrompt(brief: string, conceptNumber: number): string {
  if (!Number.isSafeInteger(conceptNumber) || conceptNumber < 1 || conceptNumber > fashionDesignConceptDirections.length || !brief.trim()) {
    throw new Error('MODAGPT_FASHION_DESIGN_PROMPT_INVALID');
  }

  const prefix = 'Create one commercial fashion design concept illustration for an adult apparel garment. Design brief: ';
  const suffix = `. Concept ${conceptNumber}: ${fashionDesignConceptDirections[conceptNumber - 1]} Show one clear front or three-quarter product view on a plain studio background. Keep the brief constraints; do not invent fiber-content claims or add text, logos, or watermarks.`;
  const maximumBriefLength = maximumModaGptImagePromptLength - prefix.length - suffix.length;
  if (maximumBriefLength < 1) throw new Error('MODAGPT_FASHION_DESIGN_PROMPT_INVALID');

  let boundedBrief = '';
  for (const character of brief.trim()) {
    if (boundedBrief.length + character.length > maximumBriefLength) break;
    boundedBrief += character;
  }
  if (!boundedBrief) throw new Error('MODAGPT_FASHION_DESIGN_PROMPT_INVALID');

  return `${prefix}${boundedBrief}${suffix}`;
}

export function buildModelStudioPrompt(
  brief: string,
  viewNumber: number,
  viewDirection: string
): string {
  if (!Number.isSafeInteger(viewNumber) || viewNumber < 1 || !viewDirection.trim()) {
    throw new Error('MODAGPT_MODEL_STUDIO_PROMPT_INVALID');
  }

  const prefix = 'Create a commercial fashion image from this brief: ';
  const suffix = `. View ${viewNumber}: ${viewDirection.trim()}. Follow the requested model, garment, background, lighting, and photography style. Do not add logos, text, or watermarks.`;
  const maximumBriefLength = maximumModaGptImagePromptLength - prefix.length - suffix.length;
  if (maximumBriefLength < 0) throw new Error('MODAGPT_MODEL_STUDIO_PROMPT_INVALID');

  let boundedBrief = '';
  for (const character of brief.trim()) {
    if (boundedBrief.length + character.length > maximumBriefLength) break;
    boundedBrief += character;
  }

  return `${prefix}${boundedBrief}${suffix}`;
}
