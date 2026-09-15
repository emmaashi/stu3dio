import { describe, expect, test } from 'bun:test';
import { formatCanvasSelectionForPrompt, formatContextForPrompt } from './context.js';

describe('canvas context inheritance', () => {
  test('formats selected canvas assets as prompt focus', () => {
    expect(formatCanvasSelectionForPrompt({
      selected_assets: [
        { kind: 'character', label: 'Mara', description: 'A quiet investigator', context: { ignored: true } },
        { kind: 'scene', label: 'Scene 2', description: 'The signal returns' }
      ]
    })).toBe('Canvas focus:\n- character: Mara — A quiet investigator\n- scene: Scene 2 — The signal returns');
  });

  test('ignores malformed or empty browser context', () => {
    expect(formatCanvasSelectionForPrompt(undefined)).toBe('');
    expect(formatCanvasSelectionForPrompt({ selected_assets: [{ label: 4 }, null] })).toBe('');
  });

  test('keeps hierarchical context and references available to prompts', () => {
    const prompt = formatContextForPrompt({
      project_summary: 'A mystery',
      plot: 'Mara follows a signal.',
      characters: [{ id: 'lead', name: 'Mara', description: 'Investigator', personality: 'Observant', media_url: '/mara.png' }],
      objects: [{ id: 'radio', type: 'Receiver', description: 'An old radio', environmental_context: 'Station', media_url: '/radio.png' }],
      scenes: [{ id: 'scene', concise_plot: 'The signal returns', detailed_plot: 'Mara enters the station.' }],
      references: [{ id: 'ref', name: 'Lighting reference', url: '/look.png' }]
    });
    expect(prompt).toContain('Project: A mystery');
    expect(prompt).toContain('<|character_lead|> Mara');
    expect(prompt).toContain('<|object_radio|> Receiver');
    expect(prompt).toContain('Current Scene:');
    expect(prompt).toContain('Lighting reference');
  });
});
