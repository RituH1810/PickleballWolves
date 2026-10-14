export function Avatar({ name, photoUrl, className }: { name: string; photoUrl?: string | null; className: string }) {
  if (photoUrl) return <img src={photoUrl} alt={name} className={`${className} object-cover`} />;
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <span className={`grid place-items-center ${className}`}>{initials}</span>;
}
