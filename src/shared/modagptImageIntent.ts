export function isModaGptImageGenerationRequest(prompt: string): boolean {
  const normalized = prompt.toLocaleLowerCase().replace(/\s+/g, '');
  return /(?:出图|生图|文生图|(?:生成|画|绘制|制作|做|给我|我要|想要|来一张|来|出).{0,16}(?:图|图片|图像|效果图|设计图|服装图|款式图|概念图|插画|海报)|(?:图|图片|图像|效果图|设计图|服装图|款式图).{0,12}(?:生成|画|绘制|制作|出))/.test(normalized)
    || /设计.{0,8}(?:一张|一幅|一组).{0,12}(?:图|图片|图像|效果图|设计图|服装图|款式图|概念图|插画|海报)/.test(normalized)
    || /(?:generate|create|draw|render|make).{0,40}(?:image|picture|illustration|fashiondesign|outfit)/.test(normalized)
    || /(?:genera|crea|disegna|realizza).{0,40}(?:immagine|figura|illustrazione|moda)/.test(normalized);
}
