import type { Project } from "@/types/backend";
import {
  DEMO_PROJECT_ID,
  DEMO_PROJECT,
  DEMO_POSTER,
  DEMO_FINAL_FILM_SRC,
  DEMO_COMPLETE_STATUS,
} from "./tears-of-steel";
import {
  ECHO_PROJECT_ID,
  ECHO_PROJECT,
  ECHO_POSTER,
  ECHO_FINAL_FILM_SRC,
  ECHO_COMPLETE_STATUS,
} from "./echo-hunter";

export type DemoStatus = {
  scenes: any[];
  characters: any[];
  objects: any[];
  frames: any[];
  completion_status: string;
};

export type DemoFilm = {
  id: string;
  project: Project;
  poster: string;
  // For "video" the final film plays in the native player; for "youtube" it
  // plays via an embedded iframe (the source URL is a youtube.com/embed/ link).
  finalVideo: string;
  finalVideoKind: "video" | "youtube";
  completeStatus: DemoStatus;
};

export const DEMOS: Record<string, DemoFilm> = {
  [DEMO_PROJECT_ID]: {
    id: DEMO_PROJECT_ID,
    project: DEMO_PROJECT,
    poster: DEMO_POSTER,
    finalVideo: DEMO_FINAL_FILM_SRC,
    finalVideoKind: "video",
    completeStatus: DEMO_COMPLETE_STATUS,
  },
  [ECHO_PROJECT_ID]: {
    id: ECHO_PROJECT_ID,
    project: ECHO_PROJECT,
    poster: ECHO_POSTER,
    finalVideo: ECHO_FINAL_FILM_SRC,
    finalVideoKind: "video",
    completeStatus: ECHO_COMPLETE_STATUS,
  },
};

export const isDemoId = (id?: string | null): boolean => !!id && id in DEMOS;
export const getDemo = (id: string): DemoFilm | undefined => DEMOS[id];
export const listDemos = (): DemoFilm[] => Object.values(DEMOS);
