"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

type SubpageRuntimeProps = {
  children: ReactNode;
  className?: string;
};

function addAutoplay(source: string): string {
  const hashIndex = source.indexOf("#");
  const hash = hashIndex === -1 ? "" : source.slice(hashIndex);
  const base = hashIndex === -1 ? source : source.slice(0, hashIndex);
  const existing = base.match(/[?&]autoplay=[^&]*/);

  if (existing?.index !== undefined) {
    return `${base.slice(0, existing.index)}${existing[0].split("=")[0]}=1${base.slice(existing.index + existing[0].length)}${hash}`;
  }

  return `${base}${base.includes("?") ? "&" : "?"}autoplay=1${hash}`;
}

function toggleRoadmap(toggle: Element): void {
  const item = toggle.closest<HTMLElement>(".roadmap-item");
  if (!item) return;

  const active = item.classList.toggle("active");
  const content = item.querySelector<HTMLElement>(".roadmap-item-content");
  if (content) content.style.display = active ? "block" : "none";

  toggle.setAttribute("aria-expanded", String(active));
  content?.setAttribute("aria-hidden", String(!active));
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

      const roadmapToggle = target.closest(".roadmap-item .item-toggle");
      if (roadmapToggle && root.contains(roadmapToggle)) {
        toggleRoadmap(roadmapToggle);
        return;
      }

      const faqTitle = target.closest(".accordion-title");
      if (faqTitle && root.contains(faqTitle)) {
        toggleFaq(faqTitle);
        return;
      }

      const videoPlay = target.closest(".video .play");
      if (videoPlay && root.contains(videoPlay)) {
        playVideo(videoPlay);
        return;
      }

      const shareButton = target.closest(".tip-share-btn");
      if (shareButton && root.contains(shareButton)) toggleShare(shareButton);
    };

    root.addEventListener("click", handleClick);
    return () => {
      root.removeEventListener("click", handleClick);
      window.removeEventListener("resize", relayout);
    };
  }, []);

  return (
    <div ref={rootRef} data-learning-seo className={className}>
      {children}
    </div>
  );
}
