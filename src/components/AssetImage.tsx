import type { ImageAsset } from '../lib/images';

interface Props {
  asset: ImageAsset;
  className?: string;
  /** Rendered width hint for picking a srcset candidate. */
  sizes: string;
  /** Override the asset's alt text; pass '' when nearby text already names the image. */
  alt?: string;
  /** Above-the-fold images load eagerly; everything else waits until needed. */
  priority?: boolean;
}

export function AssetImage({ asset, className, sizes, alt, priority = false }: Props) {
  return (
    <img
      className={className}
      src={asset.src}
      srcSet={asset.srcSet}
      sizes={sizes}
      width={asset.width}
      height={asset.height}
      alt={alt ?? asset.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      // React 18 doesn't know the camel-case prop yet, so pass the plain attribute.
      {...(priority ? { fetchpriority: 'high' } : {})}
      draggable={false}
    />
  );
}
