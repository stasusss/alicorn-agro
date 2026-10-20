import { serviceArtwork } from "@/lib/site";

type ServiceGlyphProps = {
  index: number;
  className?: string;
};

export function ServiceGlyph({ index, className = "h-16 w-16" }: ServiceGlyphProps) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full bg-cream ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={serviceArtwork[index]}
        alt=""
        className="h-full w-full object-contain"
      />
    </span>
  );
}
