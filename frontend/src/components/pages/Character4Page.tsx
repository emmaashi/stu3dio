"use client";

import { useState, useEffect } from "react";
import { useSceneStore } from "@/store/useSceneStore";
import { useDirector, useProject } from "@/hooks/useBackendIntegration";
import { getCurrentProject, updateCurrentProject } from "@/data/projectData";
import { CREW } from "@/data/crewData";
import CinematicWorkerPanel from "@/components/CinematicWorkerPanel";
import LoadingClapBoard from "@/components/common/ClapboardLoading3D";

const worker = CREW[2]; // director

type DirectorResult = {
  response: string;
  scene_descriptions: string[];
  characters: string[];
};

function parseCharacterReferences(text: string): React.ReactNode[] {
  return text.split(/(<\|[^|]+\|>)/).map((part, index) => {
    const match = part.match(/^<\|([^|]+)\|>$/);
    if (match) {
      return (
        <span key={index} style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', color: 'var(--writer)', fontWeight: 500 }}>
          {match[1]}
        </span>
      );
    }
    return part;
  });
}

export default function Character4Page({ onClose }: { onClose?: () => void }) {
  const reset = useSceneStore((s) => s.resetSelectionAndCamera);
  const project = useProject();
  const director = useDirector();

  const [input, setInput] = useState("");
  const [result, setResult] = useState<DirectorResult | null>({
    response: "Welcome! I'm your AI director. Let's create something amazing together. Tell me about your film idea and I'll help develop the story, characters, and scenes.",
    scene_descriptions: ["Start a conversation to develop scenes..."],
    characters: ["Characters will appear as we develop the story..."],
  });

  const handleClose = () => {
    if (onClose) onClose();
    else reset();
  };

  useEffect(() => {
    const initializeProject = async () => {
      const currentProject = getCurrentProject();
      if (!currentProject) {
        try {
          await project.createProject();
        } catch (error) {
          console.error('Failed to create project:', error);
        }
      }
    };
    initializeProject();
  }, [project.createProject]);

  useEffect(() => {
    if (director.messages.length > 0) {
      const lastMessage = director.messages[director.messages.length - 1];
      if (lastMessage.type === 'director') {
        const plotPoints = director.status.plot.length > 0
          ? director.status.plot.map((plot, idx) => `Scene ${idx + 1}: ${plot}`)
          : ["Scenes will appear as we develop the story..."];
        const characterList = director.status.characters.length > 0
          ? director.status.characters.map(char => `${char.name}: ${char.description}`)
          : ["Characters will appear as we develop the story..."];
        setResult({ response: lastMessage.content, scene_descriptions: plotPoints, characters: characterList });

        if (director.status.plot.length > 0 && project.currentProject) {
          const savePlotToProject = async () => {
            try {
              const plotSummary = director.status.plot.join('\n\n');
              const characterSummary = director.status.characters.length > 0
                ? director.status.characters.map(char => `${char.name} (${char.role}): ${char.description}`).join('\n')
                : '';
              const fullPlot = characterSummary ? `Plot:\n${plotSummary}\n\nCharacters:\n${characterSummary}` : plotSummary;
              await updateCurrentProject({ plot: fullPlot, summary: director.status.plot[0] || 'Film project in development' });
            } catch (error) {
              console.error('Failed to auto-save plot to project:', error);
            }
          };
          savePlotToProject();
        }
      }
    }
  }, [director.messages, director.status, project.currentProject]);

  async function handleSend() {
    const prompt = input.trim();
    if (!prompt || director.isLoading) return;
    setInput("");
    try {
      const response = await director.sendMessage(prompt);
      const plotPoints = response.plot_points.length > 0
        ? response.plot_points.map((plot, idx) => `Scene ${idx + 1}: ${plot}`)
        : ["Scenes will appear as we develop the story..."];
      const characterList = response.characters.length > 0
        ? response.characters.map(char => `${char.name}: ${char.description}`)
        : ["Characters will appear as we develop the story..."];
      setResult({ response: response.response, scene_descriptions: plotPoints, characters: characterList });

      if (response.plot_points.length > 0 && project.currentProject) {
        try {
          const plotSummary = response.plot_points.join('\n\n');
          const characterSummary = response.characters.length > 0
            ? response.characters.map(char => `${char.name} (${char.role}): ${char.description}`).join('\n')
            : '';
          const fullPlot = characterSummary ? `Plot:\n${plotSummary}\n\nCharacters:\n${characterSummary}` : plotSummary;
          await updateCurrentProject({ plot: fullPlot, summary: response.plot_points[0] || 'Film project in development' });
        } catch (error) {
          console.error('Failed to save plot to project:', error);
        }
      }

      if (response.is_complete) {
        try {
          useSceneStore.getState().setCompleted("character_4", true);
          await director.generateCharacters();
        } catch (error) {
          console.error('Failed to complete workflow:', error);
        }
      }
    } catch (error) {
      console.error('Failed to send message to director:', error);
      setResult({
        response: "Sorry, I'm having trouble connecting right now. Please try again.",
        scene_descriptions: ["Connection error - please retry"],
        characters: ["Connection error - please retry"],
      });
    }
  }

  return (
    <CinematicWorkerPanel worker={worker} onClose={handleClose}>
      <div className="wc wc--idle" style={{ overflowY: 'auto' }}>
        {/* Input dock */}
        <div className="wc-dock">
          <div className="wc-field-wrap">
            <label className="wc-label slate">Director note</label>
            <textarea
              className="field"
              rows={3}
              value={input}
              placeholder={worker.placeholder}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
            />
            <span className="wc-hint slate">↵ to send</span>
          </div>
          <div className="wc-actions">
            <span className="wc-meta2 slate">{worker.meta}</span>
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={!input.trim() || director.isLoading}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: '<path d="m4 11 16-3"/><path d="M4 11v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8Z"/><path d="m4.5 7.5 15-3 .8 3.5-15 3Z"/><path d="m8 6.5 1.5 3M12 5.8l1.5 3"/>' }} />
              <span>{director.isLoading ? 'Working…' : worker.cta}</span>
            </button>
          </div>
        </div>

        {director.status.isComplete && (
          <div style={{ padding: '12px 16px', background: 'rgba(70,217,140,.08)', border: '1px solid rgba(70,217,140,.2)', borderRadius: 'var(--r-md)', color: 'var(--ok)', fontSize: 14 }}>
            ✓ Conversation complete! Characters are being generated automatically.
          </div>
        )}
      </div>
    </CinematicWorkerPanel>
  );
}
