export type BackgroundImage = { key: string; width: number; height: number };
export type Preferences = {
  background?: string;
  motion?: boolean;
  volume?: number;
  backgroundImage?: BackgroundImage | null;
  cloakTitle?: string;
  cloakIcon?: string;
  cloakEnabled?: boolean;
  panicEnabled?: boolean;
  panicKey?: string;
  startupCover?: boolean;
};
