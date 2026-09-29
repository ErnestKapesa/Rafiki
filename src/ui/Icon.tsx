/**
 * 3D icons: Microsoft Fluent Emoji 3D (MIT) — see public/icons/LICENSE-fluentui-emoji.txt.
 * `float` adds a gentle idle bob so the UI always feels alive.
 */
export function Icon({ name, size = 24, float, className = "", alt = "" }: { name: string; size?: number; float?: boolean; className?: string; alt?: string }) {
  return (
    <img
      src={`/icons/${name}.png`}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={`icon3d ${float ? "float" : ""} ${className}`}
      style={float ? { animationDelay: `${(name.length % 7) * -0.37}s` } : undefined}
    />
  );
}
