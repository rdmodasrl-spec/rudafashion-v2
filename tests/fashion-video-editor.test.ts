import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  maximumFashionVideoAudioVolume,
  maximumFashionVideoExportDurationSeconds,
  maximumFashionVideoImageOverlays,
  maximumFashionVideoTimelineClips,
  parseFashionVideoTrimInput,
  parseFashionVideoTrimRequest,
  parseFashionVideoTrimTaskPayload,
  parseFashionVideoTimeline,
  renderFashionVideoTimeline
} from '../src/server/fashionVideoEditor';

const execFileAsync = promisify(execFile);

test('accepts bounded video trim ranges and rounds them to milliseconds', () => {
  assert.deepEqual(parseFashionVideoTrimInput({
    sourcePostId: 'fashion-post-123',
    startSeconds: 12.34567,
    endSeconds: 42.12345
  }), {
    sourcePostId: 'fashion-post-123',
    startSeconds: 12.346,
    endSeconds: 42.123
  });
  assert.deepEqual(parseFashionVideoTrimTaskPayload({
    version: 1,
    sourcePostId: 'fashion-post-123',
    startSeconds: 0,
    endSeconds: 15
  }), {
    version: 1,
    sourcePostId: 'fashion-post-123',
    startSeconds: 0,
    endSeconds: 15
  });
});

test('rejects unsafe ids, malformed task payloads, and out-of-bounds ranges', () => {
  const valid = { sourcePostId: 'post-123', startSeconds: 0, endSeconds: 15 };
  for (const input of [
    null,
    [],
    { ...valid, extra: true },
    { ...valid, sourcePostId: '../outside' },
    { ...valid, startSeconds: -1 },
    { ...valid, startSeconds: 15, endSeconds: 15 },
    { ...valid, startSeconds: Number.NaN },
    { ...valid, endSeconds: maximumFashionVideoExportDurationSeconds + 1 },
    { ...valid, endSeconds: 30 * 60 + 1 }
  ]) {
    assert.equal(parseFashionVideoTrimInput(input), null);
  }
  assert.equal(parseFashionVideoTrimTaskPayload({ version: 2, ...valid }), null);
  assert.equal(parseFashionVideoTrimTaskPayload({ version: 1, ...valid, unexpected: true }), null);
});

test('accepts ordered timeline clips and bounds the total render duration', () => {
  const timeline = {
    sourcePostId: 'fashion-post-123',
    clips: [
      { id: 'clip-a', startSeconds: 18.1234, endSeconds: 28.1256 },
      { id: 'clip-b', startSeconds: 1, endSeconds: 6.5 }
    ]
  };
  assert.deepEqual(parseFashionVideoTimeline(timeline), {
    sourcePostId: 'fashion-post-123',
    clips: [
      { id: 'clip-a', startSeconds: 18.123, endSeconds: 28.126 },
      { id: 'clip-b', startSeconds: 1, endSeconds: 6.5 }
    ],
    canvasPreset: 'source',
    audioVolume: 1,
    audioTrack: null,
    textOverlays: [],
    imageOverlays: []
  });
  assert.equal(parseFashionVideoTimeline({ ...timeline, canvasPreset: 'portrait' })?.canvasPreset, 'portrait');
  assert.equal(parseFashionVideoTimeline({ ...timeline, canvasPreset: 'ultrawide' }), null);

  assert.deepEqual(parseFashionVideoTrimRequest(timeline), {
    version: 8,
    ...parseFashionVideoTimeline(timeline)
  });
  assert.deepEqual(parseFashionVideoTrimTaskPayload({ version: 2, ...timeline }), {
    version: 2,
    ...parseFashionVideoTimeline(timeline)
  });
  assert.deepEqual(parseFashionVideoTrimTaskPayload({
    version: 3,
    ...timeline,
    audioVolume: 0.5
  }), {
    version: 3,
    ...parseFashionVideoTimeline({ ...timeline, audioVolume: 0.5 })
  });
  assert.deepEqual(parseFashionVideoTrimTaskPayload({
    version: 4,
    ...timeline,
    audioVolume: 0.5,
    audioTrack: null
  }), {
    version: 4,
    ...parseFashionVideoTimeline({ ...timeline, audioVolume: 0.5, audioTrack: null })
  });
  const versionEightTask = parseFashionVideoTrimTaskPayload({
    version: 8,
    ...timeline,
    canvasPreset: 'square',
    audioVolume: 1,
    audioTrack: null,
    textOverlays: [],
    imageOverlays: []
  });
  assert.equal(versionEightTask?.version, 8);
  assert.equal(
    versionEightTask && 'canvasPreset' in versionEightTask ? versionEightTask.canvasPreset : undefined,
    'square'
  );
});

test('validates per-clip video source references and task version compatibility', () => {
  const timeline = {
    sourcePostId: 'source-main',
    clips: [
      { id: 'clip-a', startSeconds: 0, endSeconds: 3 },
      { id: 'clip-b', startSeconds: 1, endSeconds: 4, sourcePostId: 'source-secondary' }
    ],
    audioVolume: 1,
    audioTrack: null,
    textOverlays: []
  };
  assert.deepEqual(parseFashionVideoTimeline(timeline)?.clips[1], {
    id: 'clip-b',
    startSeconds: 1,
    endSeconds: 4,
    sourcePostId: 'source-secondary'
  });
  assert.equal(parseFashionVideoTrimRequest(timeline)?.version, 8);
  assert.equal(parseFashionVideoTrimTaskPayload({ version: 5, ...timeline })?.version, 5);
  assert.equal(parseFashionVideoTrimTaskPayload({ version: 6, ...timeline })?.version, 6);
  assert.equal(parseFashionVideoTimeline({
    ...timeline,
    clips: [{ ...timeline.clips[1], sourcePostId: '../outside' }]
  }), null);
});

test('validates and parses timed image overlays on the visual track', () => {
  const imageOverlays = [{
    id: 'image-1',
    sourcePostId: 'fashion-image-123',
    startSeconds: 0.5,
    endSeconds: 2,
    position: 'bottom-right',
    sizePercent: 30
  }];
  const timeline = {
    sourcePostId: 'fashion-video-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 3 }],
    imageOverlays
  };
  assert.equal(maximumFashionVideoImageOverlays, 8);
  assert.deepEqual(parseFashionVideoTimeline(timeline)?.imageOverlays, imageOverlays);
  assert.equal(parseFashionVideoTrimRequest(timeline)?.version, 8);
  assert.equal(parseFashionVideoTrimTaskPayload({
    version: 7,
    ...timeline,
    audioVolume: 1,
    audioTrack: null,
    textOverlays: []
  })?.version, 7);
  assert.equal(parseFashionVideoTimeline({
    ...timeline,
    imageOverlays: [{ ...imageOverlays[0], sourcePostId: '../outside' }]
  }), null);
  assert.equal(parseFashionVideoTimeline({
    ...timeline,
    imageOverlays: [{ ...imageOverlays[0], endSeconds: 4 }]
  }), null);
  assert.equal(parseFashionVideoTimeline({
    ...timeline,
    imageOverlays: [{ ...imageOverlays[0], sizePercent: 71 }]
  }), null);
  assert.equal(parseFashionVideoTimeline({
    ...timeline,
    imageOverlays: Array.from({ length: maximumFashionVideoImageOverlays + 1 }, (_, index) => ({
      ...imageOverlays[0],
      id: `image-${index}`
    }))
  }), null);
});

test('validates bounded, safe background audio tracks on video timelines', () => {
  const audioTrack = {
    assetId: 'f3a34c4e-2b88-4d5a-946d-8d9e55204ab1',
    fileName: 'runway-music.mp3',
    contentType: 'audio/mpeg',
    durationSeconds: 30,
    trimStartSeconds: 1.25,
    trimEndSeconds: 18.5,
    volume: 0.35
  };
  assert.deepEqual(parseFashionVideoTimeline({
    sourcePostId: 'fashion-post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 15 }],
    audioTrack
  })?.audioTrack, audioTrack);
  for (const invalidTrack of [
    { ...audioTrack, assetId: '../audio.mp3' },
    { ...audioTrack, contentType: 'video/mp4' },
    { ...audioTrack, trimStartSeconds: -1 },
    { ...audioTrack, trimEndSeconds: 0.1 },
    { ...audioTrack, trimEndSeconds: 31 },
    { ...audioTrack, volume: 2.1 },
    { ...audioTrack, fileName: 'bad\u0000name.mp3' }
  ]) {
    assert.equal(parseFashionVideoTimeline({
      sourcePostId: 'fashion-post-123',
      clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 15 }],
      audioTrack: invalidTrack
    }), null);
  }
});

test('rejects duplicate, malformed, too-short, and excessive timeline clips', () => {
  const clip = { id: 'clip-a', startSeconds: 0, endSeconds: 5 };
  for (const timeline of [
    { sourcePostId: 'post-123', clips: [] },
    { sourcePostId: 'post-123', clips: [{ ...clip, id: '../path' }] },
    { sourcePostId: 'post-123', clips: [clip, clip] },
    { sourcePostId: 'post-123', clips: [{ ...clip, endSeconds: 0.1 }] },
    { sourcePostId: 'post-123', clips: [clip], audioVolume: -0.1 },
    { sourcePostId: 'post-123', clips: [clip], audioVolume: maximumFashionVideoAudioVolume + 0.1 },
    { sourcePostId: 'post-123', clips: [clip], audioVolume: Number.NaN },
    { sourcePostId: 'post-123', clips: [clip, { id: 'clip-b', startSeconds: 5, endSeconds: 181 }] },
    {
      sourcePostId: 'post-123',
      clips: Array.from({ length: maximumFashionVideoTimelineClips + 1 }, (_, index) => ({
        id: `clip-${index}`,
        startSeconds: index * 2,
        endSeconds: index * 2 + 1
      }))
    },
    { sourcePostId: '../source', clips: [clip] }
  ]) {
    assert.equal(parseFashionVideoTimeline(timeline), null);
  }
});

test('validates subtitle and text overlay tracks against the edited timeline', () => {
  const timeline = {
    sourcePostId: 'post-123',
    clips: [{ id: 'clip-1', startSeconds: 0, endSeconds: 8 }],
    textOverlays: [{
      id: 'title-1',
      text: 'RUDA 时尚',
      startSeconds: 1.2345,
      endSeconds: 4.5678,
      position: 'bottom',
      fontSize: 36
    }]
  };
  assert.deepEqual(parseFashionVideoTimeline(timeline)?.textOverlays, [{
    id: 'title-1',
    text: 'RUDA 时尚',
    startSeconds: 1.234,
    endSeconds: 4.568,
    position: 'bottom',
    fontSize: 36
  }]);
  assert.deepEqual(parseFashionVideoTrimRequest(timeline), {
    version: 8,
    ...parseFashionVideoTimeline(timeline)
  });
  assert.deepEqual(parseFashionVideoTrimTaskPayload({
    version: 6,
    ...timeline,
    audioVolume: 1,
    audioTrack: null
  })?.version, 6);
  for (const invalidOverlay of [
    { ...timeline.textOverlays[0], id: '../escape' },
    { ...timeline.textOverlays[0], text: '   ' },
    { ...timeline.textOverlays[0], text: 'bad\u0000text' },
    { ...timeline.textOverlays[0], startSeconds: -0.1 },
    { ...timeline.textOverlays[0], endSeconds: 8.1 },
    { ...timeline.textOverlays[0], endSeconds: 1.1 },
    { ...timeline.textOverlays[0], position: 'outside' },
    { ...timeline.textOverlays[0], fontSize: 97 }
  ]) {
    assert.equal(parseFashionVideoTimeline({ ...timeline, textOverlays: [invalidOverlay] }), null);
  }
  assert.equal(parseFashionVideoTimeline({
    ...timeline,
    textOverlays: [timeline.textOverlays[0], timeline.textOverlays[0]]
  }), null);
});

test('renders timeline text overlays into the exported video without losing its audio', async context => {
    try {
      await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { timeout: 10_000 });
      await execFileAsync(process.env.FFPROBE_PATH || 'ffprobe', ['-version'], { timeout: 10_000 });
    } catch {
      context.skip('FFmpeg and ffprobe are required for the real-render integration test');
      return;
    }

    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'ruda-studio-text-test-'));
    try {
      const sourcePath = path.join(temporaryDirectory, 'source.mp4');
      await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', 'color=c=navy:s=320x240:r=25:d=2',
        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=2',
        '-t', '2',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-shortest', sourcePath
      ], { timeout: 30_000, maxBuffer: 128 * 1024 });
      const musicPath = path.join(temporaryDirectory, 'music.wav');
      await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=44100:duration=1.2',
        '-c:a', 'pcm_s16le', musicPath
      ], { timeout: 30_000, maxBuffer: 128 * 1024 });

      const clips = [{ id: 'clip-1', startSeconds: 0, endSeconds: 2 }];
      const base = await renderFashionVideoTimeline(sourcePath, path.join(temporaryDirectory, 'base'), clips);
      let overlayStageCalled = false;
      const rendered = await renderFashionVideoTimeline(sourcePath, path.join(temporaryDirectory, 'overlay'), clips, {
        audioTrack: {
          assetId: 'f3a34c4e-2b88-4d5a-946d-8d9e55204ab1',
          fileName: 'music.wav',
          contentType: 'audio/wav',
          durationSeconds: 1.2,
          trimStartSeconds: 0,
          trimEndSeconds: 1.2,
          volume: 0.3
        },
        audioTrackPath: musicPath,
        textOverlays: [{
          id: 'caption-1',
          text: 'RUDA 时尚: runway, R&D',
          startSeconds: 0.5,
          endSeconds: 1.5,
          position: 'bottom',
          fontSize: 36
        }],
        onRenderTextOverlays: () => {
          overlayStageCalled = true;
        }
      });

      assert.equal(overlayStageCalled, true);

      const readGrayFrame = async (videoPath: string, second: number) => {
        const { stdout } = await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
          '-hide_banner', '-loglevel', 'error', '-ss', second.toFixed(2),
          '-i', videoPath, '-frames:v', '1', '-vf', 'format=gray', '-f', 'rawvideo', '-'
        ], { timeout: 15_000, maxBuffer: 512 * 1024, encoding: 'buffer' });
        return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
      };
      const meanFrameDifference = (left: Buffer, right: Buffer) => {
        assert.equal(left.length, right.length);
        let total = 0;
        for (let index = 0; index < left.length; index += 1) {
          total += Math.abs(left[index] - right[index]);
        }
        return total / left.length;
      };
      const inactiveDifference = meanFrameDifference(
        await readGrayFrame(base.videoPath, 1.8),
        await readGrayFrame(rendered.videoPath, 1.8)
      );
      const activeDifference = meanFrameDifference(
        await readGrayFrame(base.videoPath, 1),
        await readGrayFrame(rendered.videoPath, 1)
      );
      assert.ok(
        activeDifference > Math.max(5, inactiveDifference * 2),
        `Expected subtitle frame difference ${activeDifference} to exceed the uncaptioned difference ${inactiveDifference}`
      );

      const { stdout: audioStreams } = await execFileAsync(process.env.FFPROBE_PATH || 'ffprobe', [
        '-v', 'error', '-select_streams', 'a',
        '-show_entries', 'stream=codec_type', '-of', 'csv=p=0',
        rendered.videoPath
      ], { timeout: 15_000 });
      assert.match(audioStreams, /audio/);
      assert.ok(Math.abs(rendered.durationSeconds - 2) < 0.1);
      assert.ok(rendered.sizeBytes > 0);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
});

test('renders timeline clips from their individually selected video sources', async context => {
  try {
    await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { timeout: 10_000 });
    await execFileAsync(process.env.FFPROBE_PATH || 'ffprobe', ['-version'], { timeout: 10_000 });
  } catch {
    context.skip('FFmpeg and ffprobe are required for the real multi-source render test');
    return;
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'ruda-studio-sources-test-'));
  try {
    const firstSourcePath = path.join(temporaryDirectory, 'source-first.mp4');
    const secondSourcePath = path.join(temporaryDirectory, 'source-second.mp4');
    await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=red:s=320x240:r=25:d=1',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p',
      firstSourcePath
    ], { timeout: 30_000, maxBuffer: 128 * 1024 });
    await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=blue:s=160x320:r=30:d=1',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=1',
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-ac', '1', '-ar', '44100',
      secondSourcePath
    ], { timeout: 30_000, maxBuffer: 128 * 1024 });
    const rendered = await renderFashionVideoTimeline(
      firstSourcePath,
      path.join(temporaryDirectory, 'multi-source-output'),
      [
        { id: 'clip-first', startSeconds: 0, endSeconds: 1 },
        { id: 'clip-second', startSeconds: 0, endSeconds: 1, sourcePostId: 'source-blue' }
      ],
      {
        sourcePathsByPostId: new Map([['source-blue', secondSourcePath]]),
        canvasPreset: 'portrait'
      }
    );
    const readFrame = async (time: number) => {
      const { stdout } = await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-ss', String(time),
        '-i', rendered.videoPath, '-frames:v', '1', '-vf', 'scale=1:1,format=rgb24', '-f', 'rawvideo', '-'
      ], { timeout: 15_000, maxBuffer: 512, encoding: 'buffer' });
      return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
    };
    const firstFrame = await readFrame(0.4);
    const secondFrame = await readFrame(1.4);
    assert.equal(firstFrame.length, 3);
    assert.equal(secondFrame.length, 3);
    assert.ok(firstFrame[0] > firstFrame[2], 'first clip should use the red source video');
    assert.ok(secondFrame[2] > secondFrame[0], 'second clip should use its individually assigned blue source video');
    const { stdout: outputDimensions } = await execFileAsync(process.env.FFPROBE_PATH || 'ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0',
      rendered.videoPath
    ], { timeout: 15_000 });
    assert.equal(outputDimensions.trim(), '1080x1920', 'portrait export should use the selected 9:16 output canvas');
    const { stdout: audioFormat } = await execFileAsync(process.env.FFPROBE_PATH || 'ffprobe', [
      '-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=sample_rate,channels', '-of', 'csv=s=,:p=0',
      rendered.videoPath
    ], { timeout: 15_000 });
    assert.equal(audioFormat.trim(), '48000,2', 'clips with different audio layouts should be normalized before concatenation');
    assert.ok(Math.abs(rendered.durationSeconds - 2) < 0.15);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('renders timed image overlays into the exported video', async context => {
  try {
    await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { timeout: 10_000 });
    await execFileAsync(process.env.FFPROBE_PATH || 'ffprobe', ['-version'], { timeout: 10_000 });
  } catch {
    context.skip('FFmpeg and ffprobe are required for the real image-overlay render test');
    return;
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'ruda-studio-image-overlay-test-'));
  try {
    const videoPath = path.join(temporaryDirectory, 'source.mp4');
    const imagePath = path.join(temporaryDirectory, 'overlay.png');
    await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:r=25:d=2',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p',
      videoPath
    ], { timeout: 30_000, maxBuffer: 128 * 1024 });
    await sharp({
      create: { width: 96, height: 96, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } }
    }).png().toFile(imagePath);

    const rendered = await renderFashionVideoTimeline(
      videoPath,
      path.join(temporaryDirectory, 'image-overlay-output'),
      [{ id: 'clip-one', startSeconds: 0, endSeconds: 2 }],
      {
        textOverlays: [{
          id: 'caption-one',
          text: 'RUNWAY',
          startSeconds: 0.5,
          endSeconds: 1.5,
          position: 'bottom',
          fontSize: 18
        }],
        imageOverlays: [{
          id: 'logo-overlay',
          sourcePostId: 'fashion-image-123',
          startSeconds: 0.5,
          endSeconds: 1.5,
          position: 'center',
          sizePercent: 40
        }],
        imageOverlayPathsByPostId: new Map([['fashion-image-123', imagePath]])
      }
    );
    const readPixel = async (time: number) => {
      const { stdout } = await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-ss', String(time),
        '-i', rendered.videoPath,
        '-vf', 'crop=1:1:160:120,format=rgb24',
        '-frames:v', '1', '-f', 'rawvideo', '-'
      ], { timeout: 15_000, maxBuffer: 512, encoding: 'buffer' });
      return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
    };
    const beforeOverlay = await readPixel(0.3);
    const duringOverlay = await readPixel(1);
    const afterOverlay = await readPixel(1.8);
    assert.ok(beforeOverlay[2] > beforeOverlay[1], 'the source frame should remain visible before the overlay starts');
    assert.ok(duringOverlay[1] > duringOverlay[2], 'the imported image should be composited during its selected time range');
    assert.ok(afterOverlay[2] > afterOverlay[1], 'the source frame should be visible again after the overlay ends');
    assert.ok(Math.abs(rendered.durationSeconds - 2) < 0.1);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
