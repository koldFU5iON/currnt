import clsx from "clsx";

type HeadingSize = 1 | 2 | 3 | 4;

type HeadingProps = {
  size: HeadingSize,
  className?: string,
  children: React.ReactNode
}

const sizeClass: Record<HeadingSize, string> = {
  1: "text-3xl my-2 font-bold",
  2: "text-2xl my-1 font-bold",
  3: "text-xl font-semibold",
  4: "text-lg font-semibold",
};

export function H({ size, className, children }: HeadingProps) {
  const Tag = `h${size}` as "h1" | "h2" | "h3" | "h4";
  return (
    <Tag className={clsx("flex items-center space-x-2", sizeClass[size], className)}>
      {children}
    </Tag>
  )
}
