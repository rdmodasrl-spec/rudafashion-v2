import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFashionStudioProjectUpdateDocument,
  maximumFashionStudioProjectTitleLength,
  maximumFashionStudioProjectVersions,
  parseFashionStudioProjectDocument,
  parseFashionStudioProjectId,
  parseFashionStudioProjectInput
} from '../src/server/fashionStudioProjects';

test('parses and normalizes saved multi-clip video projects', () => {
  assert.deepEqual(parseFashionStudioProjectInput({
    title: '  Milan runway cut  ',
    sourcePostId: 'fashion-post-123',
    clips: [
      { id: 'clip-a', startSeconds: 12.3456, endSeconds: 20.1234 },
      { id: 'clip-b', startSeconds: 3, endSeconds: 12 }
    ]
  }), {
    title: 'Milan runway cut',
    document: {
      version: 9,
      mode: 'video.timeline',
      sourcePostId: 'fashion-post-123',
      canvasPreset: 'source',
      audioVolume: 1,
      audioTrack: null,
      textOverlays: [],
      imageOverlays: [],
      history: [],
      clips: [
        { id: 'clip-a', startSeconds: 12.346, endSeconds: 20.123 },
        { id: 'clip-b', startSeconds: 3, endSeconds: 12 }
      ]
    }
  });
});

test('rejects invalid project documents and unsafe or oversized inputs', () => {
  const valid = {
    title: 'Runway cut',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 15 }]
  };
  for (const input of [
    null,
    [],
    { ...valid, title: ' ' },
    { ...valid, title: 'x'.repeat(maximumFashionStudioProjectTitleLength + 1) },
    { ...valid, sourcePostId: '../outside' },
    { ...valid, clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 181 }] },
    { ...valid, extra: true }
  ]) {
    assert.equal(parseFashionStudioProjectInput(input), null);
  }

  assert.equal(parseFashionStudioProjectDocument({ version: 2, mode: 'video.trim', ...valid }), null);
  assert.equal(parseFashionStudioProjectDocument({
    version: 2,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 15 }],
    extra: 'ignored'
  }), null);
});

test('upgrades saved version-one trim projects to a one-clip timeline', () => {
  assert.deepEqual(parseFashionStudioProjectDocument({
    version: 1,
    mode: 'video.trim',
    sourcePostId: 'fashion-post-123',
    startSeconds: 1,
    endSeconds: 8
  }), {
    version: 9,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 1, endSeconds: 8 }],
    canvasPreset: 'source',
    audioVolume: 1,
    audioTrack: null,
    textOverlays: [],
    imageOverlays: [],
    history: []
  });
});

test('upgrades version-two timelines to projects with default audio settings', () => {
  assert.deepEqual(parseFashionStudioProjectDocument({
    version: 2,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 1, endSeconds: 8 }]
  }), {
    version: 9,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 1, endSeconds: 8 }],
    canvasPreset: 'source',
    audioVolume: 1,
    audioTrack: null,
    textOverlays: [],
    imageOverlays: [],
    history: []
  });
});

test('upgrades version-three projects while preserving source audio volume', () => {
  assert.deepEqual(parseFashionStudioProjectDocument({
    version: 3,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 1, endSeconds: 8 }],
    audioVolume: 0.7
  }), {
    version: 9,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 1, endSeconds: 8 }],
    canvasPreset: 'source',
    audioVolume: 0.7,
    audioTrack: null,
    textOverlays: [],
    imageOverlays: [],
    history: []
  });
});

test('persists and validates project audio volume', () => {
  assert.deepEqual(parseFashionStudioProjectInput({
    title: 'Runway audio',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 10 }],
    audioVolume: 0.65
  })?.document.audioVolume, 0.65);
  assert.equal(parseFashionStudioProjectInput({
    title: 'Runway audio',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 10 }],
    audioVolume: 2.1
  }), null);
});

test('persists and validates a separate project background audio track', () => {
  const audioTrack = {
    assetId: 'f3a34c4e-2b88-4d5a-946d-8d9e55204ab1',
    fileName: 'runway-music.mp3',
    contentType: 'audio/mpeg',
    durationSeconds: 30,
    trimStartSeconds: 1,
    trimEndSeconds: 20,
    volume: 0.4
  };
  assert.deepEqual(parseFashionStudioProjectInput({
    title: 'Runway with music',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 10 }],
    audioVolume: 0.6,
    audioTrack
  })?.document.audioTrack, audioTrack);
  assert.equal(parseFashionStudioProjectInput({
    title: 'Runway with music',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 10 }],
    audioTrack: { ...audioTrack, assetId: '../outside' }
  }), null);
});

test('persists text overlays and upgrades saved version-four projects', () => {
  const textOverlay = {
    id: 'caption-1',
    text: 'RUDA 时尚',
    startSeconds: 1,
    endSeconds: 4,
    position: 'bottom',
    fontSize: 36
  } as const;
  const project = parseFashionStudioProjectInput({
    title: 'Runway captions',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }],
    textOverlays: [textOverlay]
  });
  assert.deepEqual(project?.document.textOverlays, [textOverlay]);
  assert.deepEqual(parseFashionStudioProjectDocument({
    version: 4,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }],
    audioVolume: 1,
    audioTrack: null
  }), {
    version: 9,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }],
    canvasPreset: 'source',
    audioVolume: 1,
    audioTrack: null,
    textOverlays: [],
    imageOverlays: [],
    history: []
  });
});

test('upgrades saved version-five text overlay projects to version nine with empty history', () => {
  assert.deepEqual(parseFashionStudioProjectDocument({
    version: 5,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }],
    audioVolume: 0.8,
    audioTrack: null,
    textOverlays: [{
      id: 'caption-1',
      text: 'Italian runway',
      startSeconds: 1,
      endSeconds: 3,
      position: 'center',
      fontSize: 32
    }]
  }), {
    version: 9,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }],
    canvasPreset: 'source',
    audioVolume: 0.8,
    audioTrack: null,
    textOverlays: [{
      id: 'caption-1',
      text: 'Italian runway',
      startSeconds: 1,
      endSeconds: 3,
      position: 'center',
      fontSize: 32
    }],
    imageOverlays: [],
    history: []
  });

});

test('persists clip-level source references and upgrades older timeline projects safely', () => {
  const multiSource = parseFashionStudioProjectInput({
    title: 'Two-source edit',
    sourcePostId: 'fashion-post-123',
    clips: [
      { id: 'clip-1', startSeconds: 1, endSeconds: 3 },
      { id: 'clip-2', startSeconds: 4, endSeconds: 7, sourcePostId: 'fashion-post-456' }
    ]
  });
  assert.deepEqual(multiSource?.document.clips[1], {
    id: 'clip-2',
    startSeconds: 4,
    endSeconds: 7,
    sourcePostId: 'fashion-post-456'
  });
  assert.deepEqual(parseFashionStudioProjectDocument({
    version: 6,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [
      { id: 'clip-1', startSeconds: 1, endSeconds: 3 },
      { id: 'clip-2', startSeconds: 4, endSeconds: 7, sourcePostId: 'fashion-post-456' }
    ],
    audioVolume: 1,
    audioTrack: null,
    textOverlays: [],
    history: []
  })?.clips[1], {
    id: 'clip-2',
    startSeconds: 4,
    endSeconds: 7,
    sourcePostId: 'fashion-post-456'
  });
  const versionSevenProject = parseFashionStudioProjectDocument({
    version: 7,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 1, endSeconds: 3 }],
    audioVolume: 1,
    audioTrack: null,
    textOverlays: [],
    history: []
  });
  assert.equal(versionSevenProject?.version, 9);
  assert.deepEqual(versionSevenProject?.imageOverlays, []);
  const versionEightProject = parseFashionStudioProjectDocument({
    version: 8,
    mode: 'video.timeline',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 1, endSeconds: 3 }],
    audioVolume: 1,
    audioTrack: null,
    textOverlays: [],
    imageOverlays: [],
    history: []
  });
  assert.equal(versionEightProject?.version, 9);
  assert.equal(versionEightProject?.canvasPreset, 'source');
  assert.equal(parseFashionStudioProjectInput({
    title: 'Invalid source ref',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 3, sourcePostId: '../outside' }]
  }), null);
});

test('persists validated canvas presets in project documents and project history', () => {
  const portraitProject = parseFashionStudioProjectInput({
    title: 'Portrait runway',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }],
    canvasPreset: 'portrait'
  })?.document;
  const squareProject = parseFashionStudioProjectInput({
    title: 'Square runway',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }],
    canvasPreset: 'square'
  })?.document;
  assert.equal(portraitProject?.canvasPreset, 'portrait');
  assert.equal(parseFashionStudioProjectInput({
    title: 'Invalid canvas',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }],
    canvasPreset: 'ultrawide'
  }), null);
  assert.ok(portraitProject);
  assert.ok(squareProject);
  const withHistory = createFashionStudioProjectUpdateDocument(
    'Portrait runway',
    portraitProject,
    'Square runway',
    squareProject
  );
  assert.equal(withHistory.canvasPreset, 'square');
  assert.equal(withHistory.history[0]?.document.canvasPreset, 'portrait');
  assert.deepEqual(parseFashionStudioProjectDocument(withHistory), withHistory);
});

test('persists timed image overlays and includes them in project history', () => {
  const imageOverlay = {
    id: 'image-1',
    sourcePostId: 'fashion-image-456',
    startSeconds: 1,
    endSeconds: 3,
    position: 'bottom-right',
    sizePercent: 25
  } as const;
  const original = parseFashionStudioProjectInput({
    title: 'Runway with image',
    sourcePostId: 'fashion-video-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }],
    imageOverlays: [imageOverlay]
  })?.document;
  const updated = parseFashionStudioProjectInput({
    title: 'Runway without image',
    sourcePostId: 'fashion-video-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }]
  })?.document;
  assert.ok(original);
  assert.ok(updated);
  assert.deepEqual(original.imageOverlays, [imageOverlay]);
  const withHistory = createFashionStudioProjectUpdateDocument(
    'Runway with image',
    original,
    'Runway without image',
    updated
  );
  assert.deepEqual(withHistory.history[0].document.imageOverlays, [imageOverlay]);
  assert.deepEqual(parseFashionStudioProjectDocument(withHistory), withHistory);
  assert.equal(parseFashionStudioProjectInput({
    title: 'Invalid image source',
    sourcePostId: 'fashion-video-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }],
    imageOverlays: [{ ...imageOverlay, sourcePostId: '../outside' }]
  }), null);
});

test('stores bounded project history on edits and does not add snapshots for unchanged saves', () => {
  const original = parseFashionStudioProjectInput({
    title: 'Original title',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }]
  })?.document;
  const updated = parseFashionStudioProjectInput({
    title: 'Updated title',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 6 }]
  })?.document;
  assert.ok(original);
  assert.ok(updated);
  const versioned = createFashionStudioProjectUpdateDocument(
    'Original title',
    original,
    'Updated title',
    updated,
    new Date('2026-10-18T00:00:00.000Z')
  );
  assert.equal(versioned.history.length, 1);
  assert.equal(versioned.history[0].title, 'Original title');
  assert.deepEqual(parseFashionStudioProjectDocument(versioned), versioned);
  assert.equal(createFashionStudioProjectUpdateDocument(
    'Updated title',
    versioned,
    'Updated title',
    updated
  ).history.length, 1);

  let bounded = versioned;
  let currentTitle = 'Updated title';
  for (let index = 0; index < maximumFashionStudioProjectVersions + 2; index += 1) {
    const nextTitle = `Revision ${index}`;
    const next = parseFashionStudioProjectInput({
      title: nextTitle,
      sourcePostId: 'fashion-post-123',
      clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 5 + index / 10 }]
    })?.document;
    assert.ok(next);
    bounded = createFashionStudioProjectUpdateDocument(
      currentTitle,
      bounded,
      nextTitle,
      next,
      new Date(Date.UTC(2026, 9, 18, 0, 0, index))
    );
    currentTitle = nextTitle;
  }
  assert.equal(bounded.history.length, maximumFashionStudioProjectVersions);
  assert.equal(bounded.history.at(-1)?.title, `Revision ${maximumFashionStudioProjectVersions}`);
});

test('rejects invalid persistent project history', () => {
  const base = parseFashionStudioProjectInput({
    title: 'Runway',
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }]
  })?.document;
  assert.ok(base);
  const snapshot = {
    id: 'f3a34c4e-2b88-4d5a-946d-8d9e55204ab1',
    createdAt: '2026-10-18T00:00:00.000Z',
    title: 'Earlier version',
    document: {
      sourcePostId: base.sourcePostId,
      clips: base.clips,
      audioVolume: base.audioVolume,
      audioTrack: base.audioTrack,
      textOverlays: base.textOverlays
    }
  };
  for (const history of [
    [snapshot, snapshot],
    [{ ...snapshot, createdAt: 'invalid' }],
    [{ ...snapshot, title: ' ' }],
    Array.from({ length: maximumFashionStudioProjectVersions + 1 }, (_, index) => ({
      ...snapshot,
      id: `f3a34c4e-2b88-4d5a-946d-${String(index).padStart(12, '0')}`
    }))
  ]) {
    assert.equal(parseFashionStudioProjectDocument({ ...base, version: 8, mode: 'video.timeline', history }), null);
  }
});

test('accepts only canonical UUID project identifiers', () => {
  assert.equal(parseFashionStudioProjectId('f3a34c4e-2b88-4d5a-946d-8d9e55204ab1'), 'f3a34c4e-2b88-4d5a-946d-8d9e55204ab1');
  assert.equal(parseFashionStudioProjectId('../project'), null);
});
