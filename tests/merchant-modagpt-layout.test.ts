import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8');

test('merchant ModaUI surfaces: mobile and web both render the single-page workbench', () => {
  const studio = read('src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx');
  const mobileApp = read('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
  const portal = read('src/apps/merchant-admin-web/MerchantPortal.tsx');

  assert.match(mobileApp, /import\('\.\.\/merchant-admin-common\/components\/merchant\/modaui\/ModaUIWorkbench'\)/);
  assert.doesNotMatch(mobileApp, /components\/merchant\/MerchantAiHome/);
  assert.match(portal, /import\('\.\.\/merchant-admin-common\/components\/merchant\/modaui\/ModaUIWorkbench'\)/);
  assert.doesNotMatch(portal, /components\/merchant\/MerchantAiHome/);
  assert.match(studio, /<main className="[^"]*\bh-full\b[^"]*\bmin-h-0\b[^"]*\bw-full\b[^"]*\bmax-w-\[430px\]/);
  assert.doesNotMatch(studio, /h-\[calc\(100dvh-env\(safe-area-inset-top\)\)\]/);
});

test('ModaGPT entry points provide matching safe-area bounds', () => {
  const mobileApp = read('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
  const portal = read('src/apps/merchant-admin-web/MerchantPortal.tsx');

  assert.match(mobileApp, /fixed inset-x-0 top-0 z-\[60\][^"]*pt-\[env\(safe-area-inset-top\)\]/, 'mobile AI pane keeps the status-bar inset');
  assert.match(mobileApp, /style=\{\{ bottom: visualViewportInset \}\}/, 'mobile AI pane follows the keyboard inset');
  assert.match(portal, /fixed inset-0 z-\[100\][^"]*pt-\[env\(safe-area-inset-top\)\][^"]*pb-\[env\(safe-area-inset-bottom\)\]/);
});

test('ModaUI uses one compact grouped menu and a single bottom navigation handle', () => {
  const studio = read('src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx');

  assert.match(studio, /role="menu"/);
  assert.match(studio, /max-h-\[min\(calc\(100dvh-88px\),520px\)\]/);
  assert.match(studio, /localizeCopy\('对话', 'Conversazione'\)/);
  assert.match(studio, /localizeCopy\('创作工具', 'Strumenti creativi'\)/);
  assert.match(studio, /localizeCopy\('其他', 'Altro'\)/);
  assert.match(studio, /className="ruda-ai-suggestions[^"]*flex[^"]*max-w-2xl/);
  assert.match(studio, /aria-pressed=\{selected\}/);
  assert.match(studio, /selectCreationMode\(id\)/);
  assert.match(studio, /lg:max-w-\[880px\]/);
  assert.match(studio, /aria-controls="merchant-bottom-navigation"/);
  assert.match(studio, /bottomNavigation\?\.onToggle\(\)/);
  assert.match(studio, /navigationDragStartRef/);
  assert.match(studio, /onFocus=\{\(\) => \{\s*handleComposerFocus\(\)/);
  assert.match(studio, /role="menuitemcheckbox"[\s\S]{0,80}aria-checked=\{taskMode\}/);
  assert.match(studio, /bg-neutral-900 text-white' : 'border-neutral-300 bg-white/);
  assert.match(studio, /aria-label=\{localizeCopy\('关闭任务模式'/);
  assert.match(studio, /const activateCreation = \(mode: FashionMode[\s\S]{0,220}setTaskMode\(false\);/);
  assert.match(studio, /setTaskMode\(enabled => !enabled\);[\s\S]{0,120}setFashionMode\(null\);/);
  assert.match(studio, /\{!modeHasSettings && <Icon/);
  assert.doesNotMatch(studio, /pb-\[max\(/);
  assert.match(studio, /style=\{\{ paddingBottom: 'max\(0\.75rem, env\(safe-area-inset-bottom\)\)' \}\}/);
  assert.doesNotMatch(studio, /settingsOpen|modelMenuOpen|setSettingsOpen|setModelMenuOpen|ChevronDown/);
});

test('ModaUI keeps advanced composer controls out of the default dock', () => {
  const studio = read('src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx');

  assert.match(studio, /modeSheetOpen && fashionMode/);
  assert.match(studio, /role="dialog"[\s\S]{0,220}创作设置/);
  assert.match(studio, /setModeSheetOpen\(mode === 'tryon' \|\| mode === 'productLaunch'\)/);
  assert.match(studio, /aria-expanded=\{modeSheetOpen\}/);
  assert.match(studio, /aria-label=\{localizeCopy\('创作设置'/);
  // 只锁定语义：多行、不可手动拉伸。min-h 的实际 token 随 ModaUI 排版迭代微调（当前 min-h-10）。
  assert.match(studio, /max-h-32 min-h-(?:10|11) flex-1 resize-none/);
  assert.doesNotMatch(studio, /max-h-32 min-h-(?:10|11) flex-1 resize-y/);
  assert.doesNotMatch(studio, /任务模式已开启/);
  assert.doesNotMatch(studio, /多方案概念图/);
});



test('ModaUI empty state renders the live particle core instead of the Sparkles placeholder', () => {
  const studio = read('src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx');
  const emptyStateStart = studio.indexOf("activeSection === 'chat' ? (!messages.length ? (");
  const emptyStateEnd = studio.indexOf(') : (', emptyStateStart);
  assert.ok(emptyStateStart > 0 && emptyStateEnd > emptyStateStart, 'empty state block should exist');
  const emptyState = studio.slice(emptyStateStart, emptyStateEnd);

  assert.match(emptyState, /<ModaCoreAnchor/);
  assert.match(emptyState, /kind=\"hero\"/);
  assert.match(studio, /<ModaCoreStageProvider life=\{coreLife\} state=\{coreState\} levelRef=\{micLevelRef\} pulseRef=\{speechPulseRef\}>/);

  assert.match(emptyState, /sendQuestion\(suggestion\)/);
  assert.doesNotMatch(emptyState, /Sparkles/);
  assert.doesNotMatch(emptyState, /今天想做什么/);

  assert.match(studio, /import \{ ModaCoreAnchor, ModaCoreStageProvider \} from '\.\/modaui\/ModaCoreStage'/);
  assert.match(studio, /flashCoreSuccess\(\)/);
  assert.match(studio, /speakReply\(result\.reply\)/);
  assert.match(studio, /const coreState: ModaCoreVisualState = /);
});

test('merchant assistant panel empty state renders the same live particle core', () => {
  const portal = read('src/apps/merchant-admin-web/MerchantPortal.tsx');

  assert.match(
    portal,
    /import \{ ModaCoreAnchor, ModaCoreStageProvider \} from '\.\.\/merchant-admin-common\/components\/merchant\/modaui\/ModaCoreStage'/,
    'panel reuses the shared single-stage core instead of a second implementation'
  );
  assert.match(portal, /import type \{ ModaCoreVisualState \} from '\.\.\/merchant-admin-common\/components\/merchant\/modaui\/modaCoreEngine'/);
  assert.match(portal, /const assistantCoreState: ModaCoreVisualState = /);
  assert.match(
    portal,
    /<ModaCoreStageProvider[\s\S]{0,200}state=\{assistantCoreState\}[\s\S]{0,200}levelRef=\{assistantCoreLevelRef\}[\s\S]{0,200}pulseRef=\{assistantCorePulseRef\}/,
    'panel core is driven by the panel visual state'
  );
  assert.match(portal, /flashAssistantCoreSuccess\(\)/, 'real assistant success flashes the core');
  assert.match(portal, /setAssistantCoreFailed\(true\);/, 'real assistant failure drives the error state');
  assert.match(portal, /localizeCopy\('你好，', 'Ciao,'\)[\s\S]{0,140}localizeCopy\('我是 MODAUI。', 'sono ModaUI\.'\)/);
  assert.match(portal, /onClick=\{\(\) => submitAssistantQuestion\(suggestion\)\}/, 'welcome suggestions reuse the existing assistant question path');
  assert.doesNotMatch(portal, /我们从哪里开始/, 'the old violet Sparkles empty state is gone');
  assert.doesNotMatch(portal, /bg-violet-100 text-violet-800/, 'the old violet empty-state badge is gone');
});
