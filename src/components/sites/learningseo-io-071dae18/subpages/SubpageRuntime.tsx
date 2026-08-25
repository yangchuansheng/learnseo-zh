"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

type SubpageRuntimeProps = {
  children: ReactNode;
  className?: string;
};

function addAutoplay(source: string): string {
  const url = new URL(source, window.location.href);
  url.searchParams.set("autoplay", "1");
  return url.href;
}

function toggleFaq(title: Element): void {
  const item = title.closest<HTMLElement>(".accordion-item");
  const answer = item?.querySelector<HTMLElement>(".accordion-text");
  if (!item || !answer) return;

  const active = title.classList.toggle("active");
  answer.style.display = active ? "block" : "none";
  title.setAttribute("aria-expanded", String(active));
  answer.setAttribute("aria-hidden", String(!active));
}

function playVideo(play: Element): void {
  const video = play.closest<HTMLElement>(".video");
  if (!video) return;

  video.classList.add("playing");
  const iframe = video.querySelector<HTMLIFrameElement>("iframe");
  if (!iframe) return;

  const source =
    iframe.getAttribute("src") ||
    iframe.getAttribute("data-cookieblock-src") ||
    iframe.getAttribute("data-src");
  if (source) iframe.setAttribute("src", addAutoplay(source));
}

function toggleShare(button: Element): void {
  const share = button.closest<HTMLElement>(".tip-share");
  const popover = share?.querySelector<HTMLElement>(".tip-share-content");
  if (!popover) return;

  const active = popover.classList.toggle("active");
  button.setAttribute("aria-expanded", String(active));
  popover.setAttribute("aria-hidden", String(!active));
}

function toggleSidebar(button: Element): void {
  const wrapper = button.closest<HTMLElement>(".resources-with-sidebar");
  const sidebar = wrapper?.querySelector<HTMLElement>(".resources-sidebar");
  if (!sidebar) return;

  const active = button.classList.toggle("active");
  sidebar.style.display = active ? "block" : "none";
  button.setAttribute("aria-expanded", String(active));
}

function layoutFullwidthTips(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(".tips-wrapper.fullwidth .tips.grid").forEach((grid) => {
    const items = Array.from(grid.querySelectorAll<HTMLElement>(":scope > .grid-item"));
    if (!items.length) return;

    grid.style.display = "block";
    grid.style.position = "relative";
    grid.style.height = "auto";
    items.forEach((item) => {
      item.style.position = "";
      item.style.left = "";
      item.style.top = "";
    });

    const sizer = grid.querySelector<HTMLElement>(":scope > .grid-sizer");
    const columnWidth = sizer?.getBoundingClientRect().width || grid.clientWidth;
    const gutter = 20;
    const columns = Math.max(1, Math.round((grid.clientWidth + gutter) / (columnWidth + gutter)));
    const heights = Array.from({ length: columns }, () => 0);
    sizer?.style.setProperty("position", "absolute");

    items.forEach((item) => {
      const column = heights.indexOf(Math.min(...heights));
      item.style.position = "absolute";
      item.style.left = `${column * (columnWidth + gutter)}px`;
      item.style.top = `${heights[column]}px`;
      heights[column] += item.getBoundingClientRect().height + gutter;
    });

    grid.style.height = `${Math.max(0, Math.max(...heights))}px`;
  });
}

export function SubpageRuntime({
  children,
  className,
}: SubpageRuntimeProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const relayout = () => layoutFullwidthTips(root);
    relayout();
    document.fonts?.ready.then(relayout);
    window.addEventListener("resize", relayout, { passive: true });

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const control = target.closest<HTMLElement>("[data-subpage-action]");
      if (!control || !root.contains(control)) return;

      switch (control.dataset.subpageAction) {
        case "faq":
          toggleFaq(control);
          break;
        case "share":
          toggleShare(control);
          break;
        case "sidebar":
          toggleSidebar(control);
          break;
        case "video":
          playVideo(control);
          break;
      }
    };

    root.addEventListener("click", handleClick);
    return () => {
      root.removeEventListener("click", handleClick);
      window.removeEventListener("resize", relayout);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-learning-seo
      data-subpage-runtime
      className={className}
    >
      {children}
    </div>
  );
}
