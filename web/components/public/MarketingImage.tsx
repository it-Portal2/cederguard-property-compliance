
interface MarketingImageProps {
  base: string;
  alt: string;
  /** Intrinsic pixel dimensions (of the 1600 variant) — reserve space to prevent CLS. */
  width: number;
  height: number;
  sizes?: string;
  className?: string;
  /** true for an above-the-fold/LCP image (eager + high priority). Defaults to lazy. */
  priority?: boolean;
}

const BASE = import.meta.env.BASE_URL;

export default function MarketingImage({
  base,
  alt,
  width,
  height,
  sizes = "(min-width: 1152px) 1100px, 100vw",
  className,
  priority = false,
}: MarketingImageProps) {
  const url = (w: number, ext: string) => `${BASE}${base}-${w}.${ext}`;
  const srcSet = (ext: string) => `${url(960, ext)} 960w, ${url(1600, ext)} 1600w`;

  return (
    <picture>
      <source type="image/avif" srcSet={srcSet("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet("webp")} sizes={sizes} />
      <img
        src={url(1600, "jpg")}
        srcSet={srcSet("jpg")}
        sizes={sizes}
        width={width}
        height={height}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        className={className}
      />
    </picture>
  );
}
