export type FashionStudioTimelineRange = {
  startSeconds: number;
  endSeconds: number;
};

export type FashionStudioTimelinePosition = {
  clipIndex: number;
  timelineSeconds: number;
  sourceSeconds: number;
};

export function resolveFashionStudioTimelinePosition(
  clips: readonly FashionStudioTimelineRange[],
  targetSeconds: number
): FashionStudioTimelinePosition | null {
  if (!clips.length || !Number.isFinite(targetSeconds)) return null;

  let durationSeconds = 0;
  for (const clip of clips) {
    const duration = clip.endSeconds - clip.startSeconds;
    if (!Number.isFinite(clip.startSeconds)
      || !Number.isFinite(clip.endSeconds)
      || clip.startSeconds < 0
      || duration <= 0) return null;
    durationSeconds += duration;
  }

  const timelineSeconds = Math.min(Math.max(targetSeconds, 0), durationSeconds);
  let elapsedSeconds = 0;
  for (const [clipIndex, clip] of clips.entries()) {
    const clipDuration = clip.endSeconds - clip.startSeconds;
    const clipTimelineEnd = elapsedSeconds + clipDuration;
    if (timelineSeconds < clipTimelineEnd || clipIndex === clips.length - 1) {
      const offsetSeconds = Math.min(timelineSeconds - elapsedSeconds, clipDuration);
      return {
        clipIndex,
        timelineSeconds,
        sourceSeconds: clip.startSeconds + Math.max(offsetSeconds, 0)
      };
    }
    elapsedSeconds = clipTimelineEnd;
  }
  return null;
}
