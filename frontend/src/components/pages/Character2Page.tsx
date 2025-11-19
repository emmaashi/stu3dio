"use client";

import { useCallback, useEffect, useState } from "react";
import { useSceneStore } from "@/store/useSceneStore";
import Typewriter from "@/components/common/Typewriter";
import { setScriptDataValue, setShouldAnimateScriptData } from "@/data/scriptData";
import { CREW } from "@/data/crewData";
import CinematicWorkerPanel from "@/components/CinematicWorkerPanel";
import { useScript, useProject, useProjectData } from "@/hooks/useBackendIntegration";

const worker = CREW[0]; // writer

export default function Character2Page({ onClose }: { onClose?: () => void }) {
  const reset = useSceneStore((s) => s.resetSelectionAndCamera);
  const project = useProject();
  const script = useScript();
  const projectData = useProjectData();

  const initialTopMessage =
    "Welcome to Script Enhancement! Enter a base plot and I'll enhance it with better pacing, character development, and cinematic structure.";

  const [scriptData, setTopScript] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [typeKey, setTypeKey] = useState<number>(0);
  const [shouldAnimate, setShouldAnimate] = useState<boolean>(false);
  const [targetScenes] = useState<number>(3);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [enhancementContext, setEnhancementContext] = useState<{
    base_plot: string;
    characters_context: { name: string; description: string; role: string; age: number; personality: string; backstory: string }[];
  } | null>(null);
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle');

  const handleClose = () => {
    if (onClose) onClose();
    else reset();
  };

  const handleTypewriterDone = useCallback(() => {
    setShouldAnimate(false);
  }, []);

  useEffect(() => {
    if (shouldAnimate) {
      setShouldAnimateScriptData(false);
    }
  }, [shouldAnimate]);

  useEffect(() => {
    const initializeScript = async () => {
      if (project?.currentProject && !isInitialized) {
        try {
          if (project.currentProject.plot && project.currentProject.plot.trim()) {
            const currentPlot = project.currentProject.plot;
            setTopScript(currentPlot);
            setScriptDataValue(currentPlot);
          } else {
            setTopScript(initialTopMessage);
          }
          setIsInitialized(true);
        } catch (error) {
          console.error('Error initializing script:', error);
          setTopScript(initialTopMessage);
          setIsInitialized(true);
        }
      } else if (!project?.currentProject) {
        setTopScript(initialTopMessage);
        setIsInitialized(true);
      }
    };
    initializeScript();
  }, [project?.currentProject, isInitialized, initialTopMessage]);

  useEffect(() => {
    if (script.enhancedPlot && isInitialized) {
      setTopScript(script.enhancedPlot);
      setScriptDataValue(script.enhancedPlot);
    }
  }, [script.enhancedPlot, script.enhancedSummary, isInitialized]);

  async function handleSubmit() {
    if (!prompt.trim() || script.isEnhancing || !project?.currentProject) return;
    const basePlot = prompt.trim();
    setPrompt("");
    setPhase('working');
    setTopScript("Enhancing your script...");
    setTypeKey((k) => k + 1);

    try {
      const characters = projectData.characters.map(char => ({
        name: char.metadata?.name || 'Unknown',
        description: char.metadata?.description || 'No description',
        role: char.metadata?.role || 'Unknown',
        age: char.metadata?.age || 30,
        personality: char.metadata?.personality || 'No personality info',
        backstory: char.metadata?.backstory || 'No backstory',
      }));

      const result = await script.enhance(basePlot, characters);
      if (result.success) {
        setEnhancementContext({ base_plot: basePlot, characters_context: characters });
        setTopScript(result.enhanced_plot);
        setScriptDataValue(result.enhanced_plot);
        useSceneStore.getState().setCompleted("character_2", true);
        setShouldAnimate(true);
        setShouldAnimateScriptData(true);
        setTypeKey((k) => k + 1);
        setPhase('done');
      } else {
        setTopScript(`Sorry, there was an error enhancing your script. Please try again.`);
        setPhase('idle');
      }
    } catch (error) {
      console.error('Script enhancement error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTopScript(`Connection error: ${errorMessage}. Please check your connection and try again.`);
      setPhase('idle');
    }
  }

  const isLoading = script.isEnhancing;
  const hasProjectWithCharacters = project?.currentProject && projectData.characters.length > 0;

  const renderOutput = () => {
    if (isLoading || phase === 'working') {
      return (
        <div className="wc-working">
          <div className="clap-load">
            <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: '<path d="m4 11 16-3"/><path d="M4 11v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8Z"/><path d="m4.5 7.5 15-3 .8 3.5-15 3Z"/>' }} />
          </div>
          <div className="slate">Rewriting…</div>
        </div>
      );
    }
    if (shouldAnimate && scriptData) {
      return (
        <Typewriter
          key={typeKey}
          text={scriptData}
          speed={2}
          startDelay={0}
          cursor={true}
          onDone={handleTypewriterDone}
          className="wo-script"
        />
      );
    }
    if (scriptData && phase === 'done') {
      // Parse script into wo-script format
      return (
        <div className="wo-script">
          <div className="slate" style={{ marginBottom: 10 }}>Enhanced screenplay</div>
          <div className="sx-row">
            <div className="sx-l" style={{ whiteSpace: 'pre-wrap' }}>{scriptData}</div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <CinematicWorkerPanel worker={worker} onClose={handleClose}>
      <div className={`wc wc--${phase}`} style={{ overflowY: 'auto' }}>
        {phase !== 'idle' && (
          <div className="wc-out glass scroll">
            {renderOutput()}
          </div>
        )}

        <div className="wc-dock">
          {phase === 'idle' && (
            <div className="wc-brief">
              <p>{worker.intro}</p>
            </div>
          )}

          {!project?.currentProject && (
            <div style={{ padding: '12px 14px', background: 'rgba(255,93,93,.06)', border: '1px solid rgba(255,93,93,.18)', borderRadius: 'var(--r-sm)', color: 'var(--danger)', fontSize: 13 }}>
              No project selected. Please create or select a project first.
            </div>
          )}

          <div className="wc-field-wrap">
            <label className="wc-label slate">{phase === 'done' ? 'Refine your prompt' : 'Your prompt'}</label>
            <textarea
              className="field"
              rows={phase === 'idle' ? 5 : 3}
              value={prompt}
              placeholder={worker.placeholder}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
            />
            <span className="wc-hint slate">⌘↵ to run</span>
          </div>

          <div className="wc-actions">
            {phase === 'done' ? (
              <button className="btn btn-ghost btn-sm" onClick={() => { setPhase('idle'); setPrompt(''); }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: '<path d="M12 5v14M5 12h14"/>' }} />
                <span>New take</span>
              </button>
            ) : (
              <span className="wc-meta2 slate">Target · {targetScenes} scenes (3-2-3 frame structure)</span>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!prompt.trim() || isLoading || !project?.currentProject}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: '<path d="m15 4 1 2.5L18.5 8 16 9l-1 2.5L14 9l-2.5-1L14 6.5Z"/><path d="M13 11 4 20"/>' }} />
              <span>{isLoading ? 'Enhancing Script…' : worker.cta}</span>
            </button>
          </div>
        </div>
      </div>
    </CinematicWorkerPanel>
  );
}
