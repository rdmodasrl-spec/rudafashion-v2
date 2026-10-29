import assert from 'node:assert/strict';
import test from 'node:test';
import { isModaGptImageGenerationRequest } from '../src/shared/modagptImageIntent';

test('recognizes natural-language fashion image requests', () => {
  for (const prompt of [
    '出一张西服图',
    '我要一张西服效果图',
    '帮我生成一张春季女装效果图',
    '帮我设计一张西服图',
    '画一张蓝色连衣裙的款式图',
    'Generate an image of a tailored jacket',
    'Crea un’immagine moda per una giacca'
  ]) {
    assert.equal(isModaGptImageGenerationRequest(prompt), true, prompt);
  }
});

test('keeps design questions and inspiration requests in chat', () => {
  for (const prompt of [
    '帮我设计一款西服，适合商务场景',
    '怎么设计服装设计图的结构规范',
    '给我三个春夏服装系列灵感',
    'What fabric works best for a summer jacket?'
  ]) {
    assert.equal(isModaGptImageGenerationRequest(prompt), false, prompt);
  }
});
