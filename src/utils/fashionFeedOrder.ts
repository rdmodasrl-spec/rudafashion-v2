type FashionMediaItem = {
  mediaType: 'image' | 'video';
  videoUrl: string | null;
};

type FashionGalleryItem = FashionMediaItem & {
  id: string;
};

export const alternateFashionMedia = <T extends FashionMediaItem>(items: readonly T[]): T[] => {
  const videos = items.filter(item => item.mediaType === 'video' && item.videoUrl);
  const images = items.filter(item => item.mediaType !== 'video' || !item.videoUrl);
  if (!videos.length) return [...items];

  const ordered: T[] = [];
  for (let index = 0; index < Math.max(videos.length, images.length); index += 1) {
    if (videos[index]) ordered.push(videos[index]);
    if (images[index]) ordered.push(images[index]);
  }
  return ordered;
};

export const buildFashionGalleryLayout = <T extends FashionGalleryItem>(items: readonly T[]) => {
  const videos = items.filter(item => item.mediaType === 'video' && item.videoUrl);
  const images = items.filter(item => item.mediaType !== 'video' || !item.videoUrl);
  const layout: Array<{ item: T; size: 'medium' | 'feature' }> = [];
  let imageIndex = 0;
  let videoIndex = 0;

  while (imageIndex < images.length || videoIndex < videos.length) {
    for (let count = 0; count < 6 && imageIndex < images.length; count += 1) {
      layout.push({ item: images[imageIndex++], size: 'medium' });
    }
    for (let count = 0; count < 2 && imageIndex < images.length; count += 1) {
      layout.push({ item: images[imageIndex++], size: 'feature' });
    }
    if (videoIndex < videos.length) {
      layout.push({ item: videos[videoIndex++], size: 'feature' });
    }
  }

  return layout;
};
