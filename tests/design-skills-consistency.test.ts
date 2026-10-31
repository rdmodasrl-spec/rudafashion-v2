import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const DESIGN_VALUES = 'docs/engineering/design-values.md';
const SKILLS = [
  '.agents/skills/redesign-existing-projects/SKILL.md',
  '.agents/skills/landing-page-design/SKILL.md',
  '.agents/skills/frontend-design/SKILL.md',
  '.agents/skills/brand-guidelines/SKILL.md',
  '.agents/skills/webapp-testing/SKILL.md'
];

const MIRRORED_SKILLS = [
  'redesign-existing-projects',
  'landing-page-design',
  'frontend-design',
  'webapp-testing',
  'brand-guidelines'
];

test('design values doc and every adapted skill exist and are non-trivial', () => {
  for (const file of [DESIGN_VALUES, ...SKILLS]) {
    assert.ok(source(file).trim().length > 1000, `${file} carries real content`);
  }
});

test('every adapted skill points at the design values source of truth', () => {
  for (const file of SKILLS) {
    assert.match(source(file), /docs\/engineering\/design-values\.md/, `${file} cites the authoritative values`);
  }
});

test('skills and doc agree with the radius tokens shipped in css', () => {
  const css = source('src/index.css');
  const mobile = source('src/apps/shared/mobile-design-system.css');
  const doc = source(DESIGN_VALUES);

  const tokens: Array<[string, string]> = [
    ['control', '2px'],
    ['card', '2px'],
    ['input', '2px'],
    ['modal', '2px'],
    ['tag', '2px']
  ];
  for (const [token, value] of tokens) {
    assert.match(css, new RegExp(`--radius-ruda-${token}:\\s*${value}`), `src/index.css keeps ${token} at ${value}`);
    assert.match(doc, new RegExp(`--radius-ruda-${token}\`?\\s*\\|\\s*${value.replace('.', '\\.')}`), `design-values documents ${token} as ${value}`);
  }

  for (const target of ['frontend-mobile', 'merchant-admin-mobile', 'platform-admin-mobile']) {
    assert.match(mobile, new RegExp(`html\\[data-ruda-app="${target}"\\]`), `${target} keeps the mobile radius overrides`);
  }
  for (const value of ['6px', '8px', '10px', '4px']) {
    assert.match(mobile, new RegExp(`--radius-ruda-[a-z]+:\\s*${value}`), `mobile override ${value} still exists`);
  }
});

test('skills carry the RUDA font, accent, icon and motion values', () => {
  // frontend-design 专注于判断与取舍，数值由 design-values.md 权威定义；
  // 其余技能必须直接写明 RUDA 的具体值。
  const VALUE_SKILLS = SKILLS.filter(file => !/frontend-design|brand-guidelines/.test(file));
  for (const file of VALUE_SKILLS) {
    const skill = source(file);
    assert.match(skill, /cubic-bezier\(0\.22, ?1, ?0\.36, ?1\)/, `${file} uses the RUDA base curve`);
    assert.match(skill, /#201e1a/, `${file} uses the single RUDA accent`);
    assert.match(skill, /lucide-react/, `${file} keeps lucide-react as the only icon set`);
    assert.match(skill, /--radius-ruda-card/, `${file} uses the RUDA radius tokens`);
    assert.match(skill, /Manrope/, `${file} keeps the RUDA sans stack`);
  }
});

test('upstream defaults that conflict with RUDA are not reintroduced', () => {
  const banned: Array<[RegExp, string]> = [
    [/\*\*(Use|Icons):\*\*\s*(Phosphor|Solar|Iconamoon)/i, 'upstream icon set recommendation'],
    [/Geist/, 'upstream font stack'],
    [/#131209/, 'upstream dark palette value'],
  ];
  for (const file of SKILLS) {
    const skill = source(file);
    for (const [pattern, label] of banned) {
      assert.ok(!pattern.test(skill), `${file} must not reintroduce ${label}`);
    }
    for (const line of skill.split('\n')) {
      if (/不引入|禁止|不得/.test(line)) continue;
      assert.doesNotMatch(line, /\bheading-1\b|\bbody-4\b/, `${file} must not define a new utility class: ${line.trim()}`);
    }
  }
});

test('landing skill scopes part A to new conversion pages and forbids redesign', () => {
  const skill = source('.agents/skills/landing-page-design/SKILL.md');
  assert.match(skill, /只用于\*\*新建\*\*转化页/, 'part A is limited to new conversion pages');
  assert.match(skill, /不推翻现有页面结构/, 'the skill forbids restructuring existing pages');
  assert.match(skill, /不引入新依赖/, 'the skill forbids new dependencies');
});

test('claude and agents skill mirrors stay identical', () => {
  for (const name of MIRRORED_SKILLS) {
    const skill = source(`.agents/skills/${name}/SKILL.md`);
    assert.equal(source(`.claude/skills/${name}/SKILL.md`), skill, `${name}/SKILL.md mirrors .agents`);
    // Anthropic 派生技能保留上游 Apache-2.0 原文，其余保留聚合许可证说明。
    const licenceFile = MIRRORED_SKILLS.indexOf(name) >= 2 ? 'LICENSE.txt' : 'LICENSE.md';
    assert.equal(
      source(`.claude/skills/${name}/${licenceFile}`),
      source(`.agents/skills/${name}/${licenceFile}`),
      `${name}/${licenceFile} mirrors .agents`
    );
  }
});

test('anthropic derived skills keep their Apache-2.0 licence text', () => {
  for (const name of ['frontend-design', 'webapp-testing', 'brand-guidelines']) {
    const licence = source(`.agents/skills/${name}/LICENSE.txt`);
    assert.match(licence, /Apache License/, `${name} keeps the upstream Apache licence`);
    assert.match(licence, /Version 2\.0/, `${name} licence is version 2.0`);
  }
});

test('anthopic-derived skills must not carry Anthropic brand values', () => {
  for (const name of ['frontend-design', 'webapp-testing', 'brand-guidelines']) {
    const lines = source(`.agents/skills/${name}/SKILL.md`).split('\n');
    for (const line of lines) {
      // 明确以"删除/禁止/不得"提及上游值是允许的，用来告诉代理不要用。
      if (/删除|禁止|不得|不要用/.test(line)) continue;
      for (const banned of ['#d97757', '#141413', '#faf9f5', 'Poppins', 'Lora']) {
        assert.ok(!line.includes(banned), `${name} must not ship Anthropic brand value ${banned}: ${line.trim()}`);
      }
    }
  }
});

test('webapp-testing stays read-only against production and gates demo login', () => {
  const skill = source('.agents/skills/webapp-testing/SKILL.md');
  assert.match(skill, /禁止对生产/, 'production write actions are forbidden');
  assert.match(skill, /INDUSTRY_DEMO_LOGIN_ENABLED/, 'demo login is gated');
  assert.match(skill, /storefront-template/, 'store template verification is documented');
});
