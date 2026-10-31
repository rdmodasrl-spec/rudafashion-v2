/**
 * 滚动触发的 3D 商品舞台：页面滚动进度驱动相机推进与商品位移。
 * 只在进入视口后渲染，滚动使用 passive 监听，不阻塞主线程。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from './Premium3DScene';
import { loadTextureWithFallback, RUDA_3D_PALETTE, type Premium3DQuality } from './capability';

export type ScrollProductStage3DProps = {
  images: string[];
  titles?: string[];
  label?: string;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
};

export const ScrollProductStage3D: React.FC<ScrollProductStage3DProps> = ({
  images,
  titles = [],
  label = '滚动商品舞台',
  quality = 'high',
  enabled = true,
  ratio = '16 / 9',
  className = ''
}) => {
  const setup = useCallback(async (ctx: SceneSetupContext): Promise<SceneHandle> => {
    const { THREE, renderer, scene, camera } = ctx;
    renderer.setClearColor(0x000000, 0);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2, 3, 4);
    scene.add(key);

        const load = (url: string) => new Promise<import('three').Texture | null>(resolve => {
      loadTextureWithFallback(THREE, url).then(resolve, () => resolve(null));
    });
    const urls = images.filter(Boolean).slice(0, 5);
    const textures = await Promise.all(urls.map(load));

    const group = new THREE.Group();
    scene.add(group);
    const meshes: Array<import('three').Mesh> = [];
    textures.forEach((texture, index) => {
      const geometry = new THREE.PlaneGeometry(2.3, 2.9, 1, 1);
      const material = texture
        ? new THREE.MeshBasicMaterial({ map: texture })
        : new THREE.MeshBasicMaterial({ color: new THREE.Color(RUDA_3D_PALETTE.paperDeep) });
      const mesh = new THREE.Mesh(geometry, material);
      const offset = (index - (textures.length - 1) / 2) * 2.55;
      mesh.position.set(offset, 0, -index * 0.9);
      mesh.rotation.y = offset * -0.045;
      group.add(mesh);
      meshes.push(mesh);
    });

    let progress = 0;
    const host = renderer.domElement.closest('section, div');
    const readProgress = () => {
      const element = host || renderer.domElement;
      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const raw = 1 - (rect.top + rect.height) / (viewport + rect.height);
      progress = Math.min(1, Math.max(0, raw));
    };
    readProgress();
    window.addEventListener('scroll', readProgress, { passive: true });
    window.addEventListener('resize', readProgress);

    let smoothed = 0;
    return {
      update: (dt) => {
        smoothed += (progress - smoothed) * Math.min(1, dt * 4);
        camera.position.z = 8 - smoothed * 3.2;
        group.position.x = -smoothed * 2.4;
        group.rotation.y = (smoothed - 0.5) * 0.22;
        meshes.forEach((mesh, index) => {
          mesh.position.y = Math.sin(smoothed * 3 + index) * 0.08;
        });
        camera.lookAt(0, 0, 0);
      },
      dispose: () => {
        window.removeEventListener('scroll', readProgress);
        window.removeEventListener('resize', readProgress);
        meshes.forEach(mesh => {
          mesh.geometry.dispose();
          const material = mesh.material as import('three').Material & { map?: import('three').Texture };
          material.map?.dispose();
          material.dispose();
        });
      }
    };
  }, [images.join('|'), quality]);

  return (
    <figure className={className}>
      <Premium3DScene
        label={label}
        ratio={ratio}
        enabled={enabled}
        quality={quality}
        className="!bg-[#f7f5f1]"
        placeholderClassName="bg-[#f2eee8]"
        setup={setup}
      />
      {titles.length > 0 && (
        <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
          {titles.slice(0, 5).map(title => <span key={title}>{title}</span>)}
        </figcaption>
      )}
    </figure>
  );
};
