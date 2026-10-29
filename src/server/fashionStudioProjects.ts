import { randomUUID } from 'node:crypto';
import {
  parseFashionVideoTimeline,
  parseFashionVideoTrimInput,
  type FashionVideoTimelineClip,
  type FashionVideoTimelineInput,
  type FashionVideoCanvasPreset,
  type FashionVideoImageOverlay,
  type FashionVideoTextOverlay
} from './fashionVideoEditor';

export const maximumFashionStudioProjectTitleLength = 120;
export const maximumFashionStudioProjectVersions = 20;

export type FashionStudioProjectVersion = {
  id: string;
  createdAt: string;
  title: string;
  document: FashionVideoTimelineInput;
};

export type FashionStudioProjectDocument = FashionVideoTimelineInput & {
  version: 9;
  mode: 'video.timeline';
  history: FashionStudioProjectVersion[];
};

export type FashionStudioProjectInput = {
  title: string;
  document: FashionStudioProjectDocument;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function projectDocument(
  sourcePostId: string,
  clips: FashionVideoTimelineClip[],
  audioVolume = 1,
  audioTrack: FashionVideoTimelineInput['audioTrack'] = null,
  textOverlays: FashionVideoTextOverlay[] = [],
  imageOverlays: FashionVideoImageOverlay[] = [],
  history: FashionStudioProjectVersion[] = [],
  canvasPreset: FashionVideoCanvasPreset = 'source'
): FashionStudioProjectDocument {
  return { version: 9, mode: 'video.timeline', sourcePostId, clips, canvasPreset, audioVolume, audioTrack, textOverlays, imageOverlays, history };
}

function parseProjectHistory(value: unknown): FashionStudioProjectVersion[] | null {
  if (!Array.isArray(value) || value.length > maximumFashionStudioProjectVersions) return null;
  const ids = new Set<string>();
  const versions: FashionStudioProjectVersion[] = [];
  for (const version of value) {
    if (!isRecord(version)
      || Object.keys(version).length !== 4
      || typeof version.id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(version.id)
      || ids.has(version.id)
      || typeof version.createdAt !== 'string'
      || !Number.isFinite(Date.parse(version.createdAt))
      || typeof version.title !== 'string'
      || !version.title.trim()
      || Array.from(version.title).length > maximumFashionStudioProjectTitleLength
      || !isRecord(version.document)
      || ![5, 6, 7].includes(Object.keys(version.document).length)) return null;
    const timeline = parseFashionVideoTimeline(version.document);
    if (!timeline) return null;
    ids.add(version.id);
    versions.push({
      id: version.id,
      createdAt: new Date(version.createdAt).toISOString(),
      title: version.title.trim(),
      document: timeline
    });
  }
  return versions;
}

export function parseFashionStudioProjectInput(value: unknown): FashionStudioProjectInput | null {
  if (!isRecord(value)
    || typeof value.title !== 'string'
    || (Object.keys(value).length < 3 || Object.keys(value).length > 8)) return null;

  const title = value.title.trim();
  if (!title || Array.from(title).length > maximumFashionStudioProjectTitleLength) return null;

  const timeline = Array.isArray(value.clips)
    ? parseFashionVideoTimeline({
      sourcePostId: value.sourcePostId,
      clips: value.clips,
      ...(value.canvasPreset === undefined ? {} : { canvasPreset: value.canvasPreset }),
      ...(value.audioVolume === undefined ? {} : { audioVolume: value.audioVolume }),
      ...(value.audioTrack === undefined ? {} : { audioTrack: value.audioTrack }),
      ...(value.textOverlays === undefined ? {} : { textOverlays: value.textOverlays }),
      ...(value.imageOverlays === undefined ? {} : { imageOverlays: value.imageOverlays })
    })
    : null;
  if (timeline
    && Object.keys(value).every(key => ['title', 'sourcePostId', 'clips', 'canvasPreset', 'audioVolume', 'audioTrack', 'textOverlays', 'imageOverlays'].includes(key))) {
    return {
      title,
      document: projectDocument(
        timeline.sourcePostId,
        timeline.clips,
        timeline.audioVolume,
        timeline.audioTrack,
        timeline.textOverlays,
        timeline.imageOverlays,
        [],
        timeline.canvasPreset
      )
    };
  }

  const trim = parseFashionVideoTrimInput({
    sourcePostId: value.sourcePostId,
    startSeconds: value.startSeconds,
    endSeconds: value.endSeconds
  });
  if (!trim || Object.keys(value).length !== 4) return null;
  return {
    title,
    document: projectDocument(trim.sourcePostId, [{
      id: 'clip-1',
      startSeconds: trim.startSeconds,
      endSeconds: trim.endSeconds
    }])
  };
}

export function parseFashionStudioProjectDocument(value: unknown): FashionStudioProjectDocument | null {
  if (!isRecord(value)) return null;
  if (value.version === 1
    && value.mode === 'video.trim'
    && Object.keys(value).length === 5) {
    const trim = parseFashionVideoTrimInput({
      sourcePostId: value.sourcePostId,
      startSeconds: value.startSeconds,
      endSeconds: value.endSeconds
    });
    return trim ? projectDocument(trim.sourcePostId, [{
      id: 'clip-1',
      startSeconds: trim.startSeconds,
      endSeconds: trim.endSeconds
    }]) : null;
  }
  if (typeof value.version !== 'number'
    || ![2, 3, 4, 5, 6, 7, 8, 9].includes(value.version)
    || value.mode !== 'video.timeline'
    || (value.version === 2 && Object.keys(value).length !== 4)
    || (value.version === 3 && Object.keys(value).length !== 5)
    || (value.version === 4 && Object.keys(value).length !== 6)
    || (value.version === 5 && Object.keys(value).length !== 7)
    || ((value.version === 6 || value.version === 7) && Object.keys(value).length !== 8)
    || (value.version === 8 && Object.keys(value).length !== 9)
    || (value.version === 9 && Object.keys(value).length !== 10)) return null;
  const timeline = parseFashionVideoTimeline({
    sourcePostId: value.sourcePostId,
    clips: value.clips,
    ...(value.canvasPreset === undefined ? {} : { canvasPreset: value.canvasPreset }),
    ...(value.audioVolume === undefined ? {} : { audioVolume: value.audioVolume }),
    ...(value.audioTrack === undefined ? {} : { audioTrack: value.audioTrack }),
    ...(value.textOverlays === undefined ? {} : { textOverlays: value.textOverlays }),
    ...(value.imageOverlays === undefined ? {} : { imageOverlays: value.imageOverlays })
  });
  const history = value.version >= 6 ? parseProjectHistory(value.history) : [];
  if (!history) return null;
  return timeline
    ? projectDocument(
      timeline.sourcePostId,
      timeline.clips,
      timeline.audioVolume,
      timeline.audioTrack,
      timeline.textOverlays,
      timeline.imageOverlays,
      history,
      timeline.canvasPreset
    )
    : null;
}

export function createFashionStudioProjectUpdateDocument(
  currentTitle: string,
  currentDocument: FashionStudioProjectDocument,
  nextTitle: string,
  nextDocument: FashionStudioProjectDocument,
  createdAt = new Date()
): FashionStudioProjectDocument {
  const currentSnapshot = {
    title: currentTitle,
    document: {
      sourcePostId: currentDocument.sourcePostId,
      clips: currentDocument.clips,
      audioVolume: currentDocument.audioVolume,
      audioTrack: currentDocument.audioTrack,
      textOverlays: currentDocument.textOverlays,
      imageOverlays: currentDocument.imageOverlays,
      canvasPreset: currentDocument.canvasPreset
    }
  };
  const nextSnapshot = {
    title: nextTitle,
    document: {
      sourcePostId: nextDocument.sourcePostId,
      clips: nextDocument.clips,
      audioVolume: nextDocument.audioVolume,
      audioTrack: nextDocument.audioTrack,
      textOverlays: nextDocument.textOverlays,
      imageOverlays: nextDocument.imageOverlays,
      canvasPreset: nextDocument.canvasPreset
    }
  };
  const history = JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)
    ? currentDocument.history
    : [...currentDocument.history, {
      id: randomUUID(),
      createdAt: createdAt.toISOString(),
      title: currentTitle,
      document: currentSnapshot.document
    }].slice(-maximumFashionStudioProjectVersions);
  return projectDocument(
    nextDocument.sourcePostId,
    nextDocument.clips,
    nextDocument.audioVolume,
    nextDocument.audioTrack,
    nextDocument.textOverlays,
    nextDocument.imageOverlays,
    history,
    nextDocument.canvasPreset
  );
}

export function parseFashionStudioProjectId(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
