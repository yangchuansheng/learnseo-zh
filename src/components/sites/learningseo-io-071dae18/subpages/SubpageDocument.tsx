import { HeaderNavigation } from "../root-8a5edab2/HeaderNavigation";
import { RoadmapSection } from "../root-8a5edab2/RoadmapSection";
import content from "../root-8a5edab2/content.json";
import { SubpageFooter } from "./SubpageFooter";
import { SubpageRuntime } from "./SubpageRuntime";

export type SubpageDocumentProps = Readonly<{
  bodyClass: string;
  hasRoadmap: boolean;
  mainClass: string;
  html: string;
  roadmapItemCurrent: boolean;
  roadmapItemHref: string | null;
  roadmapLinkHref: string | null;
}>;

export function SubpageDocument({
  bodyClass,
  hasRoadmap,
  mainClass,
  html,
  roadmapItemCurrent,
  roadmapItemHref,
  roadmapLinkHref,
}: SubpageDocumentProps) {
  const legacyClassName = ["learningseo-subpage", bodyClass]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <SubpageRuntime className={legacyClassName}>
        <div className="gradient-header" aria-hidden="true" />
        <HeaderNavigation header={content.header} />
        <main
          id="content"
          className={mainClass}
          role="main"
          // Generated HTML is sanitized and validated before it reaches this boundary.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </SubpageRuntime>
      {hasRoadmap ? (
        <div data-learning-seo>
          <div className="mx-auto w-[calc(100%-40px)] max-w-[1224px] md:w-[88%]">
            <RoadmapSection
              activeItemCurrent={roadmapItemCurrent}
              activeItemHref={roadmapItemHref}
              activeLinkHref={roadmapLinkHref}
            />
          </div>
        </div>
      ) : null}
      <div className={legacyClassName}>
        <SubpageFooter />
      </div>
    </>
  );
}
