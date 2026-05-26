import { useEffect, useState } from "react";
import { clsx } from "clsx";

type Size = "sm" | "md" | "lg";

interface UserAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: Size;
  className?: string;
  alt?: string;
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: "w-8 h-8 text-[11px]",
  md: "w-10 h-10 text-[13px]",
  lg: "w-14 h-14 text-[16px]",
};

const GRADIENT_BG =
  "linear-gradient(135deg, oklch(0.7 0.13 60), oklch(0.55 0.17 25))";

function getInitials(
  displayName?: string | null,
  email?: string | null,
): string {
  const source = displayName?.trim() || email?.trim() || "U";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("") || "U";
}

export default function UserAvatar({
  photoURL,
  displayName,
  email,
  size = "sm",
  className,
  alt = "Profile",
}: UserAvatarProps) {
  const trimmedUrl = photoURL?.trim() || "";
  const [errored, setErrored] = useState(false);

  // Reset the error flag when the URL changes so a new avatar gets a fresh try.
  useEffect(() => {
    setErrored(false);
  }, [trimmedUrl]);

  const sizeClass = SIZE_CLASSES[size];
  const initials = getInitials(displayName, email);

  if (trimmedUrl && !errored) {
    return (
      <img
        src={trimmedUrl}
        alt={alt}
        onError={() => setErrored(true)}
        className={clsx(
          "rounded-full object-cover shrink-0",
          sizeClass,
          className,
        )}
      />
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0",
        sizeClass,
        className,
      )}
      style={{ background: GRADIENT_BG }}
      aria-label={alt}
    >
      {initials}
    </span>
  );
}
