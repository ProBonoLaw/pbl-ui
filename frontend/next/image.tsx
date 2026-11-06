import type { ImgHTMLAttributes } from 'react';

export type StaticImageData = { src: string; width: number; height: number };
type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | StaticImageData;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
  placeholder?: string;
  blurDataURL?: string;
};

export default function Image({ src, fill, priority, quality, unoptimized, placeholder, blurDataURL, style, alt, ...props }: Props) {
  void quality; void unoptimized; void placeholder; void blurDataURL;
  // Vite emits imported images as URLs; public images retain their root URLs.
  return <img {...props} alt={alt ?? ''} src={typeof src === 'string' ? src : src.src}
    loading={priority ? 'eager' : (props.loading ?? 'lazy')}
    style={fill ? { position: 'absolute', width: '100%', height: '100%', inset: 0, ...style } : style} />;
}
