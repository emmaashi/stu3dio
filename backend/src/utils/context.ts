import { getCharactersByProject, getScenesByProject, getFramesByProject, getObjectsByProject, getProject } from './database.js';
import type { Character, Scene, Object, Frame } from '../models/schemas.js';

export interface ProjectContext {
  project_id: string;
  characters: Character[];
  scenes: Scene[];
  objects: Object[];
  frames: Frame[];
}

export interface HierarchicalContext {
  project_summary: string;
  plot: string;
  references?: Array<{
    id: string;
    name: string;
    url: string;
    mime_type?: string;
  }>;
  characters: Array<{
    id: string;
    name: string;
    description: string;
    personality: string;
    media_url?: string;
  }>;
  objects: Array<{
    id: string;
    type: string;
    description: string;
    environmental_context: string;
    media_url?: string;
  }>;
  scenes?: Array<{
    id: string;
    detailed_plot: string;
    concise_plot: string;
  }>;
}

export async function buildProjectContext(projectId: string): Promise<ProjectContext> {
  const [characters, scenes, objects, frames] = await Promise.all([
    getCharactersByProject(projectId),
    getScenesByProject(projectId),
    getObjectsByProject(projectId),
    getFramesByProject(projectId)
  ]);

  return {
    project_id: projectId,
    characters,
    scenes,
    objects,
    frames
  };
}

export async function buildCharacterContext(projectId: string): Promise<HierarchicalContext> {
  const project = await getProject(projectId);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  return {
    project_summary: project.summary || '',
    plot: project.plot || '',
    characters: [],
    objects: []
  };
}

// Objects know: project summary + characters (inherit from characters level)
export async function buildObjectContext(projectId: string): Promise<HierarchicalContext> {
  const [project, characters] = await Promise.all([
    getProject(projectId),
    getCharactersByProject(projectId)
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  return {
    project_summary: project.summary || '',
    plot: project.plot || '',
    characters: characters.map(c => ({
      id: c.id,
      name: c.metadata.name,
      description: c.metadata.description,
      personality: c.metadata.personality,
      media_url: c.media_url
    })),
    objects: []
  };
}

// Scenes know: all characters + project plot
export async function buildSceneContext(projectId: string): Promise<HierarchicalContext> {
  const [project, characters, objects] = await Promise.all([
    getProject(projectId),
    getCharactersByProject(projectId),
    getObjectsByProject(projectId)
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  return {
    project_summary: project.summary || '',
    plot: project.plot || '',
    characters: characters.map(c => ({
      id: c.id,
      name: c.metadata.name,
      description: c.metadata.description,
      personality: c.metadata.personality,
      media_url: c.media_url
    })),
    objects: objects.map(o => ({
      id: o.id,
      type: o.metadata.type,
      description: o.metadata.description,
      environmental_context: o.metadata.environmental_context,
      media_url: o.media_url
    }))
  };
}

// Frames know: characters + current scene + objects
export async function buildFrameContext(
  projectId: string,
  currentScene: Scene
): Promise<HierarchicalContext> {
  const [project, characters, objects] = await Promise.all([
    getProject(projectId),
    getCharactersByProject(projectId),
    getObjectsByProject(projectId)
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  return {
    project_summary: project.summary || '',
    plot: project.plot || '',
    characters: characters.map(c => ({
      id: c.id,
      name: c.metadata.name,
      description: c.metadata.description,
      personality: c.metadata.personality,
      media_url: c.media_url
    })),
    objects: objects.map(o => ({
      id: o.id,
      type: o.metadata.type,
      description: o.metadata.description,
      environmental_context: o.metadata.environmental_context,
      media_url: o.media_url
    })),
    scenes: [{
      id: currentScene.id,
      detailed_plot: currentScene.metadata.detailed_plot,
      concise_plot: currentScene.metadata.concise_plot
    }]
  };
}

export function parseReferencedIds(text: string): {
  characterIds: string[];
  objectIds: string[];
} {
  const characterMatches = text.match(/<\|character_([a-f0-9-]+)\|>/g) || [];
  const objectMatches = text.match(/<\|object_([a-f0-9-]+)\|>/g) || [];

  const characterIds = characterMatches
    .map(match => match.match(/<\|character_([a-f0-9-]+)\|>/)?.[1])
    .filter(Boolean) as string[];

  const objectIds = objectMatches
    .map(match => match.match(/<\|object_([a-f0-9-]+)\|>/)?.[1])
    .filter(Boolean) as string[];

  return { characterIds, objectIds };
}

export function injectReferencedContext(
  text: string,
  characters: Character[],
  objects: Object[]
): string {
  const { characterIds, objectIds } = parseReferencedIds(text);

  let contextualText = text;

  characterIds.forEach(charId => {
    const character = characters.find(c => c.id === charId);
    if (character) {
      const token = `<|character_${charId}|>`;
      const replacement = `${character.metadata.name} (${character.metadata.description})`;
      contextualText = contextualText.replace(new RegExp(token, 'g'), replacement);
    }
  });

  objectIds.forEach(objId => {
    const object = objects.find(o => o.id === objId);
    if (object) {
      const token = `<|object_${objId}|>`;
      const replacement = `${object.metadata.type} (${object.metadata.description})`;
      contextualText = contextualText.replace(new RegExp(token, 'g'), replacement);
    }
  });

  return contextualText;
}

/** The subset of a canvas selection that is allowed to shape a prompt. */
type CanvasAssetContext = {
  kind?: unknown;
  label?: unknown;
  description?: unknown;
};

/**
 * Treat canvas selections as routing hints while rebuilding authoritative
 * story context from the database. This keeps prompts useful without trusting
 * the browser to supply the project's inherited state.
 */
export function formatCanvasSelectionForPrompt(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const assets = (value as { selected_assets?: unknown }).selected_assets;
  if (!Array.isArray(assets) || assets.length === 0) return '';

  const lines = assets.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const asset = candidate as CanvasAssetContext;
    const label = typeof asset.label === 'string' ? asset.label.trim() : '';
    const kind = typeof asset.kind === 'string' ? asset.kind.trim() : '';
    if (!label) return [];
    const description = typeof asset.description === 'string'
      ? asset.description.trim()
      : '';
    return [`- ${kind ? `${kind}: ` : ''}${label}${description ? ` — ${description}` : ''}`];
  });

  return lines.length ? `Canvas focus:
${lines.join('\n')}` : '';
}

/**
 * Resolve the context an image edit should inherit from its canvas node.
 *
 * Scene and shot edits are scoped to their scene so the edit sees the current
 * beat; everything else (characters, objects, loose selections) falls back to
 * project-level context. Throws if the project does not exist, so callers that
 * treat context as optional should handle that.
 */
export async function buildAssetEditContext(
  projectId: string,
  metadata: unknown
): Promise<HierarchicalContext> {
  const base = await buildSceneContext(projectId);
  if (!metadata || typeof metadata !== 'object') return base;

  const { node, refId } = metadata as { node?: unknown; refId?: unknown };
  if (typeof refId !== 'string') return base;

  let sceneId: string | undefined;
  if (typeof node === 'string' && node.startsWith('scene-')) {
    sceneId = refId;
  } else if (typeof node === 'string' && node.startsWith('clip-')) {
    const frames = await getFramesByProject(projectId);
    sceneId = frames.find(frame => frame.id === refId)?.scene_id;
  }

  if (!sceneId) return base;
  const scenes = await getScenesByProject(projectId);
  const scene = scenes.find(candidate => candidate.id === sceneId);
  return scene ? buildFrameContext(projectId, scene) : base;
}

export function formatContextForPrompt(context: HierarchicalContext): string {
  let prompt = `Project: ${context.project_summary}\nPlot: ${context.plot}\n\n`;

  if (context.characters.length > 0) {
    prompt += `Characters:\n`;
    context.characters.forEach(char => {
      prompt += `- <|character_${char.id}|> ${char.name}: ${char.description} (${char.personality})\n`;
    });
    prompt += `\n`;
  }

  if (context.objects.length > 0) {
    prompt += `Objects/Environment:\n`;
    context.objects.forEach(obj => {
      prompt += `- <|object_${obj.id}|> ${obj.type}: ${obj.description} (${obj.environmental_context})\n`;
    });
    prompt += `\n`;
  }

  if (context.scenes && context.scenes.length > 0) {
    prompt += `Current Scene:\n`;
    context.scenes.forEach(scene => {
      prompt += `- Scene: ${scene.concise_plot}\n  Details: ${scene.detailed_plot}\n`;
    });
    prompt += `\n`;
  }

  if (context.references && context.references.length > 0) {
    prompt += `Attached Visual References:\n`;
    context.references.forEach(reference => {
      prompt += `- ${reference.name}\n`;
    });
    prompt += `\n`;
  }

  return prompt;
}
