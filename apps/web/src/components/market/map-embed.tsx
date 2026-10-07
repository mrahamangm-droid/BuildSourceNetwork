/**
 * Keyless Google Maps embed. Lazy-loaded so it never competes with the LCP image,
 * with a fixed aspect ratio to avoid layout shift.
 */
export function mapEmbedSrc(query: string, zoom = 11) {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;
}

export function mapLinkHref(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function MapEmbed({
  query,
  title,
  zoom = 11,
  className = "",
}: {
  query: string;
  title: string;
  zoom?: number;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-surface ${className}`}>
      <iframe
        title={title}
        src={mapEmbedSrc(query, zoom)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="aspect-[4/3] w-full border-0 sm:aspect-[16/9]"
      />
    </div>
  );
}
