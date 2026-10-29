#!/usr/bin/env node
/**
 * WXML 条件指令静态检查。
 *
 * 微信开发者工具（lib 3.x / glass-easel）对 wx:else、wx:elif 的相邻性要求比旧版严格：
 * `wx:else` 前一个兄弟节点必须是带 `wx:if` / `wx:elif` 的元素，中间夹注释或普通文本
 * 都会报 `Bad attr \`wx:else\` ... wx:if not found`。该错误只在编译期出现，运行时不复现，
 * 因此放在仓库里做机械检查。
 *
 * 用法：
 *   node scripts/check-wxml-directives.mjs                 # 检查 miniprogram + merchant-miniprogram
 *   node scripts/check-wxml-directives.mjs miniprogram     # 只检查指定目录
 *
 * 退出码：0 = 无问题，1 = 发现问题。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'miniprogram_npm', 'dist', 'release']);

export function walkWxml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) walkWxml(child, out);
    else if (entry.name.endsWith('.wxml')) out.push(child);
  }
  return out;
}

const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const COMMENT_RE = /<!--[\s\S]*?-->/g;

function lineAt(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i += 1) if (src[i] === '\n') line += 1;
  return line;
}

function tokenize(src) {
  const tokens = [];
  const comments = [];
  let m;
  COMMENT_RE.lastIndex = 0;
  while ((m = COMMENT_RE.exec(src))) {
    comments.push({ start: m.index, end: m.index + m[0].length });
  }
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(src))) {
    const [, close, tag, attrs, selfClose] = m;
    if (comments.some((c) => m.index >= c.start && m.index < c.end)) continue;
    tokens.push({
      type: close ? 'close' : 'open',
      tag,
      attrs,
      selfClose: selfClose === '/',
      start: m.index,
      end: m.index + m[0].length,
      line: lineAt(src, m.index),
    });
  }
  return { tokens, comments };
}

export function scanWxmlSource(src, file = '<inline>') {
  const { tokens } = tokenize(src);
  const problems = [];
  const root = { tag: '#root', children: [] };
  const stack = [root];

  for (const token of tokens) {
    if (token.type === 'close') {
      if (stack.length === 1) {
        problems.push(`${file}:${token.line} 多余的 </${token.tag}>`);
        continue;
      }
      const top = stack[stack.length - 1];
      if (top.tag !== token.tag) {
        problems.push(`${file}:${token.line} </${token.tag}> 与未闭合的 <${top.tag}>（第 ${top.line} 行）不匹配`);
      }
      top.end = token.end;
      stack.pop();
      continue;
    }

    const parent = stack[stack.length - 1];
    const prev = parent.children[parent.children.length - 1];
    const hasIf = /(?:^|\s)wx:if\s*=/.test(token.attrs);
    const hasElif = /(?:^|\s)wx:elif\s*=/.test(token.attrs);
    const hasElse = /(?:^|\s)wx:else(?:\s|=|$)/.test(token.attrs);
    const hasFor = /(?:^|\s)wx:for\s*=/.test(token.attrs);
    const chained = Boolean(prev && (prev.hasIf || prev.hasElif));

    if ((hasElse || hasElif) && !chained) {
      const prevLabel = prev ? `上一层兄弟 <${prev.tag}>（第 ${prev.line} 行）` : '没有上一层兄弟元素';
      problems.push(
        `${file}:${token.line} ${hasElse ? 'wx:else' : 'wx:elif'} 缺少紧邻的 wx:if/wx:elif：${prevLabel}`,
      );
    }

    if ((hasElse || hasElif) && prev) {
      const between = src.slice(prev.end, token.start);
      if (between.includes('<!--')) {
        problems.push(`${file}:${token.line} ${hasElse ? 'wx:else' : 'wx:elif'} 与上一层兄弟之间夹了注释，开发者工具会报 wx:if not found`);
      } else if (between.trim().length > 0) {
        problems.push(`${file}:${token.line} ${hasElse ? 'wx:else' : 'wx:elif'} 与上一层兄弟之间夹了文本节点 "${between.trim().slice(0, 20)}"`);
      }
    }

    if (hasIf && hasFor) {
      problems.push(`${file}:${token.line} 同一元素同时使用 wx:if 与 wx:for，请拆成外层 <block wx:if> 或内层 <block wx:for>`);
    }

    const node = { tag: token.tag, line: token.line, end: token.end, hasIf: hasIf || hasElif, children: [] };
    parent.children.push(node);
    if (!token.selfClose) stack.push(node);
  }

  for (const open of stack.slice(1)) {
    problems.push(`${file}:${open.line} <${open.tag}> 未闭合`);
  }
  return problems;
}

export function scanWxmlFile(file) {
  return scanWxmlSource(fs.readFileSync(file, 'utf8'), file);
}

export function scanWxmlDirs(dirs) {
  const files = dirs.flatMap((dir) => walkWxml(path.resolve(ROOT, dir)));
  const problems = files.flatMap((file) => scanWxmlFile(file));
  return { files, problems };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const dirs = process.argv.slice(2);
  const targets = dirs.length ? dirs : ['miniprogram', 'merchant-miniprogram'];
  const { files, problems } = scanWxmlDirs(targets);
  for (const problem of problems) console.error(problem);
  console.log(`WXML 条件指令检查：${files.length} 个文件，${problems.length} 个问题`);
  process.exit(problems.length ? 1 : 0);
}
