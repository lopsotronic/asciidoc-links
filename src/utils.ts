import * as vscode from "vscode";
import { createHash } from "crypto";
import { extname } from "path";
import { AsciidocLink, Graph, EdgeType } from "./types";

/**
 * Find all links in Asciidoc content.
 * Supports:
 * - xref:file.adoc[] or xref:file.adoc[label] - cross-references
 * - <<file.adoc>> or <<file.adoc,label>> - inline anchors/xrefs
 * - include::file.adoc[] - full file includes
 * - include::file.adoc[tag=...] or [lines=...] - partial includes
 */
export const findAsciidocLinks = (content: string): AsciidocLink[] => {
  const links: AsciidocLink[] = [];

  // Pattern for xref: links - xref:path/to/file.adoc[] or xref:path/to/file.adoc[label]
  const xrefPattern = /xref:([^\[]+\.adoc)\[[^\]]*\]/g;

  // Pattern for <<>> style cross-references - <<file.adoc>> or <<file.adoc,label>>
  const anchorXrefPattern = /<<([^,>]+\.adoc)(?:,[^>]*)?>>?/g;

  // Pattern for include directives - include::path/to/file.adoc[...]
  // Captures the path and the attributes inside []
  const includePattern = /include::([^\[]+\.adoc)\[([^\]]*)\]/g;

  // Pattern for simple link macros - link:file.adoc[label]
  const linkPattern = /(?<!\w)link:([^\[]+\.adoc)\[[^\]]*\]/g;

  let match;

  // Find xref: links (regular gray links)
  while ((match = xrefPattern.exec(content)) !== null) {
    const target = match[1].trim();
    if (!isExternalUrl(target)) {
      links.push({ target, type: "link" });
    }
  }

  // Find <<>> style links (regular gray links)
  while ((match = anchorXrefPattern.exec(content)) !== null) {
    const target = match[1].trim();
    if (!isExternalUrl(target) && target.endsWith(".adoc")) {
      links.push({ target, type: "link" });
    }
  }

  // Find link: macros (regular gray links)
  while ((match = linkPattern.exec(content)) !== null) {
    const target = match[1].trim();
    if (!isExternalUrl(target)) {
      links.push({ target, type: "link" });
    }
  }

  // Find include directives
  while ((match = includePattern.exec(content)) !== null) {
    const target = match[1].trim();
    const attributes = match[2].trim();

    if (!isExternalUrl(target)) {
      // Check if it's a partial include (has tag=, tags=, lines=, or leveloffset with tag)
      const isPartial = hasPartialIncludeAttributes(attributes);
      links.push({
        target,
        type: isPartial ? "include-partial" : "include",
      });
    }
  }

  return links;
};

/**
 * Check if include attributes indicate a partial include
 */
const hasPartialIncludeAttributes = (attributes: string): boolean => {
  if (!attributes) return false;

  // Patterns that indicate partial includes
  const partialPatterns = [
    /\btag=/,      // tag=tagname
    /\btags=/,     // tags=tag1;tag2
    /\blines=/,    // lines=1..10 or lines=5;10;15
  ];

  return partialPatterns.some((pattern) => pattern.test(attributes));
};

/**
 * Check if a URL is external (http/https)
 */
const isExternalUrl = (url: string): boolean => {
  return url.startsWith("http://") || url.startsWith("https://");
};

/**
 * Find the document title in Asciidoc content.
 * Asciidoc titles start with = (single equals sign with space)
 */
export const findAsciidocTitle = (content: string): string | null => {
  // Match document title: = Title (level 0 heading)
  // Must be at the start of a line
  const titlePattern = /^= +(.+)$/m;
  const match = content.match(titlePattern);

  if (match) {
    let title = match[1].trim();

    const titleMaxLength = getTitleMaxLength();
    if (titleMaxLength > 0 && title.length > titleMaxLength) {
      title = title.substring(0, titleMaxLength).concat("...");
    }

    return title;
  }

  return null;
};

export const id = (path: string): string => {
  const pathWithoutExt = path.substring(0, path.length - extname(path).length);
  return createHash("md5").update(pathWithoutExt).digest("hex");
};

export const getConfiguration = (key: string) =>
  vscode.workspace.getConfiguration("asciidoc-links")[key];

const settingToValue: { [key: string]: vscode.ViewColumn | undefined } = {
  active: -1,
  beside: -2,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

export const getTitleMaxLength = () => {
  return getConfiguration("titleMaxLength");
};

export const getColumnSetting = (key: string) => {
  const column = getConfiguration(key);
  return settingToValue[column] || vscode.ViewColumn.One;
};

export const getFileTypesSetting = () => {
  const DEFAULT_VALUE = ["adoc", "asciidoc"];
  return getConfiguration("fileTypes") || DEFAULT_VALUE;
};

export const getDot = (graph: Graph) => `digraph g {
  ${graph.nodes
    .map((node) => `  ${node.id} [label="${node.label}"];`)
    .join("\n")}
  ${graph.edges.map((edge) => `  ${edge.source} -> ${edge.target}`).join("\n")}
  }`;

export const exists = (graph: Graph, id: string) =>
  !!graph.nodes.find((node) => node.id === id);

export const filterNonExistingEdges = (graph: Graph) => {
  graph.edges = graph.edges.filter(
    (edge) => exists(graph, edge.source) && exists(graph, edge.target)
  );
};