const paths = {
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  arrow: "M9 7l5 5-5 5",
  account: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0",
  copy: "M9 9h10v10H9zM5 15V5h10",
  check: "M5 12.5l4.5 4.5L19 7.5",
  plus: "M12 5v14M5 12h14",
  send: "M5 12h13M13 6l6 6-6 6",
  stop: "M7 7h10v10H7z",
  key: "M14.5 9.5a4 4 0 11-1.2-2.8M13.3 6.7L20 13.4M17.5 11l-2 2M19.5 13l-1.5 1.5",
  chart: "M4 19h16M7 16v-5M12 16V7M17 16v-8",
  folder: "M3.5 7.5a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2h-13a2 2 0 01-2-2z",
  spark: "M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M6.5 17.5L9 15M15 9l2.5-2.5",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12",
  euro: "M17.5 6.5a7 7 0 100 11M5 10.5h9M5 13.5h9",
  rocket: "M12 15l-3-3c1.5-4.5 4.5-7 9-8-1 4.5-3.5 7.5-8 9zM9 12l-3 .5L5 15l3 1M12 15l-.5 3L15 19l-1-3",
} as const;

export type IconName = keyof typeof paths;

export default function Icon({ name, size = 24, title }: { name: IconName; size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={paths[name]} />
    </svg>
  );
}
