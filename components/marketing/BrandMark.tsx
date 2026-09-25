import Image from "next/image";

export default function BrandMark({ size = 26, withName = true }: { size?: number; withName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/logo-eco-v2.png"
        alt=""
        width={size}
        height={size}
        className="rounded-full"
        style={{ width: size, height: size }}
        priority
      />
      {withName && (
        <span className="text-[17px] font-semibold tracking-[-0.01em]" style={{ color: "var(--mk-text, #EDECE8)" }}>
          ECO
        </span>
      )}
    </span>
  );
}
