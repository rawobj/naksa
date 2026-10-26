import type { SVGProps } from "react";

// The icon set. Every icon is drawn on a 24 unit grid with one stroke weight
// and round joins, so they read as a single family.
const PATHS = {
  select: "M5 3l14 7.5-6.2 1.9L10.6 19z",
  pan: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3",
  wall: "M3 8.5h18v7H3zM7.5 8.5l-3 7M12.5 8.5l-3 7M17.5 8.5l-3 7",
  door: "M3 20h4M7 20V6M7 6A14 14 0 0 1 21 20",
  window: "M2 12h5M17 12h5M7 9h10v6H7zM7 12h10",
  dimension:
    "M4 7v10M20 7v10M4 12h16M7 9.5L4.5 12 7 14.5M17 9.5l2.5 2.5-2.5 2.5",
  text: "M5 6.5V4h14v2.5M12 4v16M9 20h6",
  undo: "M8 5L3.5 9.5 8 14M3.5 9.5h11a5.5 5.5 0 0 1 0 11H11",
  redo: "M16 5l4.5 4.5L16 14M20.5 9.5h-11a5.5 5.5 0 0 0 0 11H13",
  generate: "M4 4h16v16H4zM4 11h9M13 4v16M13 15h7",
  open: "M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  save: "M12 4v11M7.5 10.5L12 15l4.5-4.5M4 19h16",
  image:
    "M4 5h16v14H4zM4 15l4.5-4.5 4 4 2.5-2.5L20 17M15.5 7.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3",
  file: "M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  fit: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
  rotate: "M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5",
  flip: "M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z",
  snap: "M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 8h4M14 8h4",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 4l9 16H3zM12 10v4.5M12 17.5v.01",
  close: "M6 6l12 12M18 6L6 18",
  cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9",
  plan: "M4 4h16v16H4zM4 12h7M11 4v10M15 20v-6h5",
  ruler: "M3 16L16 3l5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2",
  sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4",
  panel: "M4 5h16v14H4zM9 5v14",
  eye: "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5",
  layers: "M12 4l9 4.5-9 4.5-9-4.5zM3 13l9 4.5 9-4.5",
} as const;

export type IconName = keyof typeof PATHS;

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
