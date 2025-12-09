import * as vscode from "vscode";
import * as path from "path";
import { AsciidocLink, Graph, EdgeType } from "./types";
import { TextDecoder } from "util";
import {
  findAsciidocTitle,
  findAsciidocLinks,
  id,
  getFileTypesSetting,
  getConfiguration,
  getTitleMaxLength,
} from "./utils";
import { basename } from "path";

let idToPath: Record<string, string> = {};

export const idResolver = (targetId: string): string | undefined => {
  return idToPath[targetId];
};

export const parseFile = async (graph: Graph, filePath: string) => {
  filePath = path.normalize(filePath);
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  const content = new TextDecoder("utf-8").decode(buffer);

  let title: string | null = findAsciidocTitle(content);

  const index = graph.nodes.findIndex((node) => node.path === filePath);

  if (!title) {
    if (index !== -1) {
      graph.nodes.splice(index, 1);
    }
    return;
  }

  if (index !== -1) {
    graph.nodes[index].label = title;
  } else {
    graph.nodes.push({ id: id(filePath), path: filePath, label: title });
  }

  // Remove edges based on an old version of this file.
  graph.edges = graph.edges.filter((edge) => edge.source !== id(filePath));

  // Find all Asciidoc links and includes
  const links = findAsciidocLinks(content);
  const parentDirectory = filePath.split(path.sep).slice(0, -1).join(path.sep);

  for (const link of links) {
    let target = path.normalize(link.target);
    if (!path.isAbsolute(link.target)) {
      target = path.normalize(`${parentDirectory}/${link.target}`);
    }

    graph.edges.push({
      source: id(filePath),
      target: id(target),
      type: link.type,
    });
  }
};

export const learnFileId = async (_graph: Graph, filePath: string) => {
  const fileName = basename(filePath);
  idToPath[fileName] = filePath;

  const fileNameWithoutExt = fileName.split(".").slice(0, -1).join(".");
  idToPath[fileNameWithoutExt] = filePath;
};

export const parseDirectory = async (
  graph: Graph,
  fileCallback: (graph: Graph, path: string) => Promise<void>
) => {
  const files = await vscode.workspace.findFiles(
    `**/*{${(getFileTypesSetting() as string[]).map((f) => `.${f}`).join(",")}}`
  );

  const promises: Promise<void>[] = [];

  for (const file of files) {
    const hiddenFile = path.basename(file.path).startsWith(".");
    if (!hiddenFile) {
      promises.push(fileCallback(graph, file.path));
    }
  }

  await Promise.all(promises);
};