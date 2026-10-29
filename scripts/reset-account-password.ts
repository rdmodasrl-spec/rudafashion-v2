import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient, type AuthAccount } from '@prisma/client';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

dotenv.config({ quiet: true });

const prisma = new PrismaClient();

async function prompt(question: string): Promise<string> {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    return (await readline.question(question)).trim();
  } finally {
    readline.close();
  }
}

function promptHidden(question: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('请在 SSH 交互终端中运行此工具。');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();

    const finish = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.off('data', onData);
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          finish(new Error('操作已取消。'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }
        if (character >= ' ') {
          value += character;
          stdout.write('*');
        }
      }
    };

    stdin.on('data', onData);
  });
}

function describeAccount(account: AuthAccount): string {
  return account.role === 'admin'
    ? `管理员账号 ${account.username ?? ''}`
    : `商家账号 ${account.email ?? account.phone ?? account.id}`;
}

async function main(): Promise<void> {
  const roleInput = await prompt('要重设哪类账号？输入 admin 或 merchant: ');
  if (roleInput !== 'admin' && roleInput !== 'merchant') {
    throw new Error('账号类型必须是 admin 或 merchant。');
  }
  const role = roleInput;
  const identifierPrompt = role === 'admin'
    ? '管理员登录名: '
    : '商家登录邮箱或已验证手机号: ';
  const identifier = await prompt(identifierPrompt);
  if (!identifier) throw new Error('登录名、邮箱或手机号不能为空。');

  const accounts = await prisma.authAccount.findMany({
    where: role === 'admin'
      ? { role, username: identifier }
      : {
          role,
          OR: [
            { email: identifier.toLowerCase() },
            { phone: identifier }
          ]
        },
    take: 2
  });

  if (accounts.length === 0) throw new Error('没有找到匹配的账号；未修改任何数据。');
  if (accounts.length !== 1) throw new Error('匹配到多个账号；未修改任何数据，请联系数据库管理员核对。');

  const account = accounts[0];
  const sharedIdentity = account.identityId
    ? await prisma.accountIdentity.findUnique({ where: { id: account.identityId }, select: { id: true } })
    : null;
  if (account.identityId && !sharedIdentity) {
    throw new Error('账号关联的统一身份不存在；未修改任何数据，请联系系统管理员。');
  }

  stdout.write(`将重设：${describeAccount(account)}\n`);
  if (sharedIdentity) {
    stdout.write('此账号使用统一登录；所有关联账号的密码也会同步更新。\n');
  }
  const confirmation = await prompt('输入 RESET 确认继续: ');
  if (confirmation !== 'RESET') throw new Error('确认文字不匹配；未修改任何数据。');

  const minimumPasswordLength = role === 'admin' ? 6 : 12;
  const password = await promptHidden(`输入新密码（至少 ${minimumPasswordLength} 位，不显示）: `);
  const passwordConfirmation = await promptHidden('再次输入新密码: ');
  if (password.length < minimumPasswordLength) {
    throw new Error(`新密码至少需要 ${minimumPasswordLength} 个字符。`);
  }
  if (password !== passwordConfirmation) throw new Error('两次输入的密码不一致。');

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async transaction => {
    if (account.identityId) {
      await transaction.accountIdentity.update({
        where: { id: account.identityId },
        data: { passwordHash }
      });
      await transaction.authAccount.updateMany({
        where: { identityId: account.identityId },
        data: { passwordHash }
      });
    } else {
      await transaction.authAccount.update({
        where: { id: account.id },
        data: { passwordHash }
      });
    }
  });

  stdout.write(`已重设 ${describeAccount(account)} 的密码。请妥善保存新密码。\n`);
}

try {
  await main();
} catch (error) {
  stdout.write(`${error instanceof Error ? error.message : '密码重设失败。'}\n`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
