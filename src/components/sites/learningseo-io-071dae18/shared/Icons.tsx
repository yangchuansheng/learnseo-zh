import type { SVGProps } from "react";

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="9" height="8" viewBox="0 0 9 8" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8.354 4.354a.5.5 0 0 0 0-.708L5.172.464a.5.5 0 0 0-.708.708L7.293 4 4.464 6.828a.5.5 0 1 0 .708.708l3.182-3.182ZM0 4.5h8v-1H0v1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 46" fill="none" aria-hidden="true" {...props}>
      <path d="M40 23 0 46V0l40 23Z" fill="currentColor" />
    </svg>
  );
}

export function PlaneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 26" fill="none" aria-hidden="true" {...props}>
      <path d="m2 3 20 10-20 10 3-8 10-2-10-2-3-8Z" fill="currentColor" />
    </svg>
  );
}

export function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 13" fill="none" aria-hidden="true" {...props}>
      <path d="M.239 3.154C1.879-1.204 7.211.745 7.698 2.923c.667-2.307 5.87-4.024 7.46.231C16.926 7.896 8.313 12.151 7.698 12.844 7.083 12.28-1.53 7.819.238 3.154Z" fill="currentColor" />
    </svg>
  );
}
