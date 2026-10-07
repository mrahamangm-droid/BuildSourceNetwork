import { preload } from "react-dom";
import { HOME_IMAGES, homeImagePath, type HomeImageKey } from "@/lib/home-images";

/**
 * Responsive <picture> for the pre-optimised homepage WebP set.
 * Uses intrinsic width/height (no layout shift), srcset for DPR/viewport selection,
 * and lazy loading unless `priority` marks it as the LCP image.
 */
export function HomePicture({
  name,
  sizes,
  priority = false,
  className = "",
  alt,
}: {
  name: HomeImageKey;
  sizes: string;
  priority?: boolean;
  className?: string;
  alt?: string;
}) {
  const img = HOME_IMAGES[name];
  const variants = [...img.variants].sort((a, b) => a.w - b.w);
  const largest = variants[variants.length - 1];
  const srcSet = variants.map((v) => `${homeImagePath(name, v.w)} ${v.w}w`).join(", ");
  if (priority) {
    // Start fetching the LCP image early, in parallel with CSS and JS.
    preload(homeImagePath(name, largest.w), {
      as: "image",
      imageSrcSet: srcSet,
      imageSizes: sizes,
      fetchPriority: "high",
      type: "image/webp",
    });
  }
  return (
    <picture>
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      <img
        src={homeImagePath(name, largest.w)}
        alt={alt ?? img.alt}
        width={largest.w}
        height={largest.h}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={`h-auto w-full ${className}`}
      />
    </picture>
  );
}
