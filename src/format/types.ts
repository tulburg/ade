// Types for an ADE document. The JSON Schema in schema/ade.schema.json is the contract;
// these mirror it for the reader and the kit.

export type SourceKind = "doc" | "pdf" | "paper" | "video" | "page";

export interface Source {
  title: string;
  kind: SourceKind;
  url: string;
}

export interface Term {
  term: string;
  definition: string;
  part?: string;
  sources: number[];
}

export interface Connect {
  tag: string;
  text: string;
}

export interface Explainer {
  name: string;
  what: string;
  connects: Connect[];
  sources: number[];
}

export interface Motion {
  order: number;
  description: string;
}

export interface Part {
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  props?: Record<string, unknown>;
  tag?: string;
  corner?: "tl" | "tr";
  caption?: string;
  explainer?: Explainer;
  motion?: Motion;
}

export interface Connection {
  from: string;
  to: string;
  points: [number, number][];
  flow?: boolean;
  note?: string;
  noteAt?: [number, number];
}

export interface Figure {
  width: 1000;
  height: number;
  label: string;
  parts: Part[];
  connections: Connection[];
}

export interface Main {
  title: string;
  paragraph: string;
  terms: Term[];
  sources: Source[];
  figure: Figure;
}

export interface Level extends Main {
  id: "L1" | "L2";
  question: string;
}

export interface AdeDocument {
  ade: 1;
  main: Main;
  levels: Level[];
}

export interface Issue {
  path: string;
  message: string;
}
