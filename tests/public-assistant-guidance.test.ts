import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPublicAssistantGuidance,
  retrievePublicSupportKnowledge
} from '../src/server/publicSupportKnowledge';

test('public registration questions return a grounded answer and the account-entry action', () => {
  for (const question of ['怎么注册 RUDA？', 'How do I register?', 'Come faccio la registrazione?']) {
    const guidance = getPublicAssistantGuidance(question);
    assert.equal(guidance?.action, 'registration');
    assert.ok(guidance?.reply);
    assert.doesNotMatch(guidance!.reply, /密码.*(?:发|发送|告诉)|password.*(?:send|share)/i);
  }

  const articles = retrievePublicSupportKnowledge('怎么注册个人买家或企业账户');
  assert.ok(articles.some(article => article.includes('/register-wholesale')));
  assert.ok(articles.some(article => article.includes('员工账户不开放自助注册')));
});

test('public platform fee questions explain the verified knowledge boundary without inventing a free price', () => {
  for (const question of ['RUDA 怎么收费？', '注册费是多少？', 'What are the platform fees?', 'Quali sono le commissioni?']) {
    const guidance = getPublicAssistantGuidance(question);
    assert.ok(guidance?.reply);
    assert.match(guidance!.reply, /不会猜测|no puedo|will not guess|non posso quindi inventare/i);
    assert.doesNotMatch(guidance!.reply, /注册免费|免费注册|free registration|registrazione gratuita/i);
  }

  const articles = retrievePublicSupportKnowledge('注册费、入驻费用和佣金');
  assert.ok(articles.some(article => article.includes('不得推断为免费')));
});

test('specific wholesale item price questions are not misrouted to platform fee guidance', () => {
  assert.equal(getPublicAssistantGuidance('How much does this product cost?'), null);
  assert.equal(getPublicAssistantGuidance('这款商品多少钱？'), null);
});
