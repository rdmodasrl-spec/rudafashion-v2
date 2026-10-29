import assert from 'node:assert/strict';
import test from 'node:test';
import { getGrowthChannelConnections, growthChannels } from '../src/shared/growthChannels';

test('regional channel registry includes agreed markets without enabling future Telegram', () => {
  const byId = new Map(growthChannels.map(channel => [channel.id, channel]));
  assert.deepEqual(byId.get('wechat_official')?.markets, ['china', 'europe']);
  assert.deepEqual(byId.get('instagram')?.markets, ['europe', 'mexico']);
  assert.deepEqual(byId.get('mexico_kol')?.markets, ['mexico']);
  assert.equal(byId.get('telegram')?.phase, 'future');
  assert.equal(byId.get('telegram')?.connector, null);
});

test('channel status distinguishes configured credentials, verified assets, and unimplemented channels', () => {
  const connections = getGrowthChannelConnections({
    metaConfigured: true,
    facebookPageCount: 2,
    instagramAccountCount: 1
  });
  const byId = new Map(connections.map(channel => [channel.id, channel]));

  assert.deepEqual(
    [byId.get('facebook')?.status, byId.get('facebook')?.connectedAssets],
    ['connected', 2]
  );
  assert.deepEqual(
    [byId.get('instagram')?.status, byId.get('instagram')?.connectedAssets],
    ['connected', 1]
  );
  assert.equal(byId.get('google_ads')?.status, 'not_implemented');
  assert.equal(byId.get('telegram')?.status, 'future');
});

test('Meta credentials without authorized assets are not shown as connected', () => {
  const connections = getGrowthChannelConnections({
    metaConfigured: true,
    facebookPageCount: 0,
    instagramAccountCount: 0
  });
  const byId = new Map(connections.map(channel => [channel.id, channel]));
  assert.equal(byId.get('facebook')?.status, 'configured');
  assert.equal(byId.get('instagram')?.status, 'configured');
  assert.equal(byId.get('tiktok')?.status, 'not_implemented');
});
