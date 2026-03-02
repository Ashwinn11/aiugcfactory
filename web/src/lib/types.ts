export type AppMode = "restyle" | "paint";

export type ElementFilter = "walls" | "floor" | "furniture" | null;

export interface MoodBoardData {
  colors: { hex: string; name: string }[];
  materials: string[];
  furnitureStyles: string[];
  summary: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ConversationTurn = any;

export interface Snapshot {
  image: string;
  messages: ChatMessage[];
  history: ConversationTurn[];
}
