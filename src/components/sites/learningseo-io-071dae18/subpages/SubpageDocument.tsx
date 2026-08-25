import { HeaderNavigation } from "../root-8a5edab2/HeaderNavigation";
import { SubpageFooter } from "./SubpageFooter";
import { SubpageRuntime } from "./SubpageRuntime";

export type SubpageDocumentProps = Readonly<{
  bodyClass: string;
  mainClass: string;
  html: string;
}>;

export function SubpageDocument({ bodyClass, mainClass, html }: SubpageDocumentProps) {
  const pageContent = (
    <main
      id="content"
      className={mainClass}
      role="main"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );

  return (
    <SubpageRuntime className={["learningseo-subpage", bodyClass].filter(Boolean).join(" ")}>
      <div className="gradient-header" aria-hidden="true" />
      <HeaderNavigation />
      {pageContent}
      <SubpageFooter />
    </SubpageRuntime>
  );
}
