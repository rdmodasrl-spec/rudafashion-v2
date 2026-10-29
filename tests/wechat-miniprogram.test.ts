import assert from 'node:assert/strict';
import test from 'node:test';
import {
  exchangeWechatMiniProgramCode,
  WechatMiniProgramError
} from '../src/server/wechatMiniProgram';
import {
  bindMiniProgramIdentity,
  MiniProgramIdentityBindingError,
  type MiniProgramIdentityRepository
} from '../src/server/miniprogramWechatIdentity';

function miniProgramError(code: string, statusCode: number) {
  return (error: unknown) => {
    assert.ok(error instanceof WechatMiniProgramError);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    return true;
  };
}

test('wx.login code exchange sends credentials only to WeChat and returns only AppID-scoped OpenID', async () => {
  let requestUrl: URL | undefined;
  const fetchImpl: typeof fetch = async input => {
    requestUrl = new URL(String(input));
    return new Response(JSON.stringify({ openid: 'openid-1', session_key: 'must-not-be-returned' }), {
      status: 200
    });
  };

  const result = await exchangeWechatMiniProgramCode('single-use-code', {
    appId: 'mini-app-id',
    appSecret: 'server-secret',
    fetchImpl
  });

  assert.deepEqual(result, { appId: 'mini-app-id', openId: 'openid-1' });
  assert.equal(requestUrl?.origin, 'https://api.weixin.qq.com');
  assert.equal(requestUrl?.searchParams.get('appid'), 'mini-app-id');
  assert.equal(requestUrl?.searchParams.get('secret'), 'server-secret');
  assert.equal(requestUrl?.searchParams.get('js_code'), 'single-use-code');
  assert.equal(requestUrl?.searchParams.get('grant_type'), 'authorization_code');
  assert.equal('session_key' in result, false);
});

test('wx.login code exchange rejects missing configuration without making a provider request', async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    return new Response('{}');
  };

  await assert.rejects(
    exchangeWechatMiniProgramCode('single-use-code', {
      appId: '',
      appSecret: '',
      fetchImpl
    }),
    miniProgramError('WECHAT_MINIPROGRAM_NOT_CONFIGURED', 503)
  );
  assert.equal(called, false);
});

test('wx.login provider errors never return the submitted code or server secret', async () => {
  const fetchImpl: typeof fetch = async () => new Response(
    JSON.stringify({ errcode: 40029, errmsg: 'invalid code' }),
    { status: 200 }
  );

  await assert.rejects(
    exchangeWechatMiniProgramCode('private-one-time-code', {
      appId: 'mini-app-id',
      appSecret: 'private-server-secret',
      fetchImpl
    }),
    error => {
      assert.ok(error instanceof WechatMiniProgramError);
      assert.equal(error.code, 'WECHAT_CODE_EXCHANGE_FAILED');
      assert.equal(error.message.includes('private-one-time-code'), false);
      assert.equal(error.message.includes('private-server-secret'), false);
      return true;
    }
  );
});

test('wx.login rejects a provider AppID mismatch without exposing provider details', async () => {
  const fetchImpl: typeof fetch = async () => new Response(
    JSON.stringify({ errcode: 40013, errmsg: 'invalid appid' }),
    { status: 200 }
  );

  await assert.rejects(
    exchangeWechatMiniProgramCode('single-use-code', {
      appId: 'configured-mini-app',
      appSecret: 'server-secret',
      fetchImpl
    }),
    error => {
      assert.ok(error instanceof WechatMiniProgramError);
      assert.equal(error.code, 'WECHAT_CODE_EXCHANGE_FAILED');
      assert.equal(error.statusCode, 401);
      assert.equal(error.message.includes('invalid appid'), false);
      return true;
    }
  );
});

test('wx.login rejects malformed or incomplete provider responses', async t => {
  const cases: Array<{ name: string; response: () => Promise<Response> }> = [
    {
      name: 'invalid JSON',
      response: async () => new Response('not-json', { status: 200 })
    },
    {
      name: 'missing OpenID',
      response: async () => new Response(JSON.stringify({ session_key: 'private-session-key' }), { status: 200 })
    },
    {
      name: 'invalid OpenID',
      response: async () => new Response(JSON.stringify({ openid: 'openid with spaces' }), { status: 200 })
    }
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      await assert.rejects(
        exchangeWechatMiniProgramCode('single-use-code', {
          appId: 'configured-mini-app',
          appSecret: 'server-secret',
          fetchImpl: item.response
        }),
        error => {
          assert.ok(error instanceof WechatMiniProgramError);
          assert.equal(error.code, 'WECHAT_PROVIDER_RESPONSE_INVALID');
          assert.equal(error.statusCode, 502);
          return true;
        }
      );
    });
  }
});

test('wx.login network errors are sanitized instead of exposing request URL credentials', async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error('failed request with private-server-secret and private-one-time-code');
  };

  await assert.rejects(
    exchangeWechatMiniProgramCode('private-one-time-code', {
      appId: 'mini-app-id',
      appSecret: 'private-server-secret',
      fetchImpl
    }),
    error => {
      assert.ok(error instanceof WechatMiniProgramError);
      assert.equal(error.code, 'WECHAT_CODE_EXCHANGE_UNAVAILABLE');
      assert.equal(error.message.includes('private-server-secret'), false);
      assert.equal(error.message.includes('private-one-time-code'), false);
      return true;
    }
  );
});

class InMemoryIdentityRepository implements MiniProgramIdentityRepository {
  private readonly identitiesByWechat = new Map<string, { authAccountId: string; openId: string }>();
  private readonly identitiesByAccount = new Map<string, { authAccountId: string; openId: string }>();

  async findByIdentity(appId: string, openId: string) {
    return this.identitiesByWechat.get(`${appId}:${openId}`) || null;
  }

  async findByAccount(appId: string, authAccountId: string) {
    return this.identitiesByAccount.get(`${appId}:${authAccountId}`) || null;
  }

  async create(identity: { appId: string; openId: string; authAccountId: string }) {
    const wechatKey = `${identity.appId}:${identity.openId}`;
    const accountKey = `${identity.appId}:${identity.authAccountId}`;
    if (this.identitiesByWechat.has(wechatKey) || this.identitiesByAccount.has(accountKey)) {
      throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
    }
    const record = { authAccountId: identity.authAccountId, openId: identity.openId };
    this.identitiesByWechat.set(wechatKey, record);
    this.identitiesByAccount.set(accountKey, record);
  }
}

const buyerAccount = (id: string) => ({ id, role: 'buyer', customerId: `customer-${id}` });

test('binding scopes the same OpenID independently by mini program AppID', async () => {
  const repository = new InMemoryIdentityRepository();

  await bindMiniProgramIdentity(
    { appId: 'mini-app-a', openId: 'same-openid' },
    buyerAccount('buyer-a'),
    repository
  );
  const result = await bindMiniProgramIdentity(
    { appId: 'mini-app-b', openId: 'same-openid' },
    buyerAccount('buyer-b'),
    repository
  );

  assert.deepEqual(result, { alreadyBound: false });
});

test('binding rejects an OpenID already owned by a different buyer within the same AppID', async () => {
  const repository = new InMemoryIdentityRepository();
  const identity = { appId: 'mini-app-a', openId: 'openid-1' };
  await bindMiniProgramIdentity(identity, buyerAccount('buyer-a'), repository);

  await assert.rejects(
    bindMiniProgramIdentity(identity, buyerAccount('buyer-b'), repository),
    error => {
      assert.ok(error instanceof MiniProgramIdentityBindingError);
      assert.equal(error.code, 'WECHAT_IDENTITY_ALREADY_BOUND');
      assert.equal(error.statusCode, 409);
      return true;
    }
  );
});

test('binding prevents one buyer account from linking multiple WeChat identities within an AppID', async () => {
  const repository = new InMemoryIdentityRepository();
  const account = buyerAccount('buyer-a');
  await bindMiniProgramIdentity({ appId: 'mini-app-a', openId: 'openid-1' }, account, repository);

  await assert.rejects(
    bindMiniProgramIdentity({ appId: 'mini-app-a', openId: 'openid-2' }, account, repository),
    error => {
      assert.ok(error instanceof MiniProgramIdentityBindingError);
      assert.equal(error.code, 'BUYER_ACCOUNT_ALREADY_HAS_WECHAT_IDENTITY');
      return true;
    }
  );
});

test('binding is idempotent for the same buyer and WeChat identity', async () => {
  const repository = new InMemoryIdentityRepository();
  const identity = { appId: 'mini-app-a', openId: 'openid-1' };
  const account = buyerAccount('buyer-a');
  await bindMiniProgramIdentity(identity, account, repository);

  assert.deepEqual(await bindMiniProgramIdentity(identity, account, repository), { alreadyBound: true });
});

test('concurrent binding attempts for the same buyer and identity resolve idempotently', async () => {
  const repository = new InMemoryIdentityRepository();
  const identity = { appId: 'mini-app-a', openId: 'openid-1' };
  const account = buyerAccount('buyer-a');

  const results = await Promise.all([
    bindMiniProgramIdentity(identity, account, repository),
    bindMiniProgramIdentity(identity, account, repository)
  ]);

  assert.equal(results.filter(result => result.alreadyBound).length, 1);
  assert.equal(results.filter(result => !result.alreadyBound).length, 1);
});

test('binding refuses non-buyer accounts before writing any identity', async () => {
  const repository = new InMemoryIdentityRepository();

  await assert.rejects(
    bindMiniProgramIdentity(
      { appId: 'mini-app-a', openId: 'openid-1' },
      { id: 'merchant-1', role: 'merchant', customerId: null },
      repository
    ),
    error => {
      assert.ok(error instanceof MiniProgramIdentityBindingError);
      assert.equal(error.code, 'BUYER_ACCOUNT_REQUIRED');
      assert.equal(error.statusCode, 403);
      return true;
    }
  );
  assert.equal(await repository.findByIdentity('mini-app-a', 'openid-1'), null);
});
