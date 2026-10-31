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
  '.agents/skills/landing-page-design/SKILL.md'
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
  for (const file of SKILLS) {
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
  for (const name of ['redesign-existing-projects', 'landing-page-design']) {
    for (const file of ['SKILL.md', 'LICENSE.md']) {
      const agents = source(`.agents/skills/${name}/${file}`);
      const claude = source(`.claude/skills/${name}/${file}`);
      assert.equal(claude, agents, `${name}/${file} mirrors .agents`);
    }
  }
});
