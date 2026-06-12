"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSceneStore } from "@/store/useSceneStore";
import ScribbleEditor, { type ScribbleExport } from "@/components/ScribbleEditor";
import {
  getScribblesForImage, setScribblesForImage,
  getCurrentCharacterGallaryIndex, setCurrentCharacterGallaryIndex,
  characterGallaryData, updateCharacterGalleryData,
  setEntryLoading, initializeAllLoadingFalse,
  type GalleryCategory,
} from "@/data/characterData";
import { useBackendStore } from "@/store/backendStore";
import { useProject, useProjectData, useImageEditing } from "@/hooks/useBackendIntegration";
import type { BackendCharacter, BackendScene } from "@/data/characterData";
import { CREW } from "@/data/crewData";
import CinematicWorkerPanel from "@/components/CinematicWorkerPanel";

const worker = CREW[1]; // casting/visual designer

export default function Character3Page({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const reset = useSceneStore((s) => s.resetSelectionAndCamera);
  const project = useProject();
  const projectData = useProjectData();
  const imageEditing = useImageEditing();

  const [activeTab, setActiveTab] = useState<GalleryCategory>("characters");
  const [backendCharacters, setBackendCharacters] = useState<BackendCharacter[]>([]);
  const [backendScenes, setBackendScenes] = useState<BackendScene[]>([]);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [imagesLoadingStatus, setImagesLoadingStatus] = useState<Record<string, boolean>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef({ characters: 0, scenes: 0 });
  const lastFetchTime = useRef(0);

  const hasBackendData = project?.currentProject && (backendCharacters.length > 0 || backendScenes.length > 0);
  const entries = hasBackendData
    ? (activeTab === "characters"
        ? backendCharacters.map(char => ({
            image: char.media_url || "/images/placeholder.jpg",
            description: `${char.metadata?.name || 'Unnamed'}\nRole: ${char.metadata?.role || 'Unknown'}\nAge: ${char.metadata?.age || 'Unknown'}\nDescription: ${char.metadata?.description || 'No description'}\nPersonality: ${char.metadata?.personality || 'No personality info'}\nBackstory: ${char.metadata?.backstory || 'No backstory'}`,
            loading: imagesLoadingStatus[char.media_url || ''] ?? true,
            id: char.id,
          }))
        : backendScenes.map(scene => ({
            image: scene.media_url || "/images/placeholder.jpg",
            description: `Concise Plot: ${scene.metadata?.concise_plot || 'No plot'}\nDetailed Plot: ${scene.metadata?.detailed_plot || 'No detailed plot'}\nDialogue: ${scene.metadata?.dialogue || 'No dialogue'}`,
            loading: imagesLoadingStatus[scene.media_url || ''] ?? true,
            id: scene.id,
          })))
    : characterGallaryData[activeTab];
  const hasEntries = entries && entries.length > 0;

  const [index, setIndex] = useState(getCurrentCharacterGallaryIndex());
  const [scribblesByIndex, setScribblesByIndex] = useState<Record<number, any[]>>({});
  const scribbleExportRef = useRef<ScribbleExport | null>(null);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const current = hasEntries ? (entries[index] ?? entries[0]) : undefined;
  const projectId = useBackendStore((s) => s.projectId);

  const handleClose = () => {
    if (onClose) onClose();
    else reset();
  };

  const handleRefreshImage = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const getImageUrl = useCallback((url: string) => {
    if (!url || url === '/images/placeholder.jpg') return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${refreshKey}`;
  }, [refreshKey]);

  useEffect(() => {
    initializeAllLoadingFalse();
  }, []);

  const pollData = useCallback(async () => {
    if (!project?.currentProject) return;
    const now = Date.now();
    if (now - lastFetchTime.current < 5000) return;
    lastFetchTime.current = now;
    try {
      const [characters, scenes] = await Promise.all([
        projectData.refreshCharacters(),
        projectData.refreshScenes(),
      ]);
      const currentCount = { characters: characters.length, scenes: scenes.length };
      const lastCount = lastDataRef.current;
      if (currentCount.characters !== lastCount.characters || currentCount.scenes !== lastCount.scenes) {
        setBackendCharacters(characters);
        setBackendScenes(scenes);
        lastDataRef.current = currentCount;
      }
    } catch (error) {
      console.error('Error polling data:', error);
    }
  }, [project?.currentProject, projectData]);

  useEffect(() => {
    if (!project?.currentProject) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setBackendCharacters([]); setBackendScenes([]);
      lastDataRef.current = { characters: 0, scenes: 0 };
      lastFetchTime.current = 0;
      return;
    }
    pollData();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(pollData, 10000);
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [project?.currentProject?.id]);

  const goPrev = useCallback(() => {
    if (!hasEntries || !entries) return;
    setIndex((i) => {
      const next = (i - 1 + entries.length) % entries.length;
      if (!hasBackendData) setCurrentCharacterGallaryIndex(next);
      return next;
    });
  }, [hasEntries, entries, hasBackendData]);

  const goNext = useCallback(() => {
    if (!hasEntries || !entries) return;
    setIndex((i) => {
      const next = (i + 1) % entries.length;
      if (!hasBackendData) setCurrentCharacterGallaryIndex(next);
      return next;
    });
  }, [hasEntries, entries, hasBackendData]);

  async function handleSubmitCurrent() {
    const prompt = input.trim();
    const hasScribbles = (scribblesByIndex[index]?.length || 0) > 0;
    // allow submitting with a drawing alone (e.g. draw a hat) or with text
    if (!prompt && !hasScribbles) return;
    setInput("");
    setIsProcessing(true);
    setEntryLoading(activeTab, index, true);
    try {
      // When the user has drawn on the image, burn the strokes into the source so the
      // model actually sees the annotation (e.g. a drawn hat). Falls back to the raw
      // image URL if compositing fails (e.g. a tainted cross-origin canvas).
      const composite = hasScribbles ? scribbleExportRef.current?.toDataURL() ?? null : null;
      const editPrompt = prompt || 'Incorporate the drawn annotations into the image, blending them naturally.';
      let resp: { file_path: string; description: string };
      if (project?.currentProject && current?.image && hasBackendData) {
        const jobId = await imageEditing.editImage({
          projectId: project.currentProject.id,
          sourceUrl: composite || current.image,
          editPrompt,
          metadata: { source: 'character_gallery', tab: activeTab, index, annotated: !!composite },
        });
        console.log('Image editing job started:', jobId);
        resp = { file_path: current.image, description: current.description + "\n\nEditing in progress..." };
      } else if (projectId) {
        const { sendImageWithScribbles } = await import("@/lib/imageAgent");
        const payload = { prompt: editPrompt, imageSrc: composite || current?.image || "", lines: scribblesByIndex[index] || [], projectId };
        resp = await sendImageWithScribbles(payload);
      } else {
        await new Promise((r) => setTimeout(r, 600));
        resp = { file_path: current?.image || "", description: (current?.description ? current.description + "\n\n" : "") + `Applied change: ${editPrompt}` };
      }
      useSceneStore.getState().setCompleted("character_3", true);
      if (!hasBackendData) updateCharacterGalleryData(activeTab, index, resp.file_path, resp.description);
      setScribblesByIndex((prev) => ({ ...prev, [index]: [] }));
      setScribblesForImage(resp.file_path, []);
    } finally {
      setIsProcessing(false);
      setEntryLoading(activeTab, index, false);
    }
  }

  const handleGenerateScenes = async () => {
    if (!project?.currentProject || isGeneratingScenes) return;
    try {
      setIsGeneratingScenes(true);
      const result = await projectData.generateScenes();
      if (result.success) {
        console.log('Scene generation started:', result.jobIds);
        setActiveTab("scenes");
      } else {
        alert('Error generating scenes: ' + result.message);
      }
    } catch (error) {
      console.error('Error generating scenes:', error);
      alert('Error generating scenes: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!project?.currentProject || isGeneratingVideo) return;
    try {
      setIsGeneratingVideo(true);
      const result = await projectData.generateVideo();
      if (result.success) {
        handleClose();
        router.push('/timeline');
      } else {
        alert('Error generating video: ' + result.message);
      }
    } catch (error) {
      console.error('Error generating video:', error);
      alert('Error generating video: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    if (entries && entries.length > 0 && entries[index]) {
      const imgSrc = entries[index].image;
      if (imgSrc && loadedKey !== imgSrc && !hasBackendData) {
        const persisted = getScribblesForImage(imgSrc);
        if (persisted && persisted.length > 0) {
          setScribblesByIndex((prev) => ({ ...prev, [index]: persisted }));
        }
        setLoadedKey(imgSrc);
      }
    }
  }, [entries, index, loadedKey, hasBackendData]);

  useEffect(() => {
    setIndex(0);
    setImagesLoadingStatus({});
  }, [activeTab]);

  useEffect(() => {
    if (entries && entries.length > 0) {
      entries.forEach((entry: any) => {
        if (entry.image && entry.image !== '/images/placeholder.jpg') {
          if (!(entry.image in imagesLoadingStatus)) {
            setImagesLoadingStatus(prev => ({ ...prev, [entry.image]: true }));
            const img = new Image();
            img.onload = () => setImagesLoadingStatus(prev => ({ ...prev, [entry.image]: false }));
            img.onerror = () => setImagesLoadingStatus(prev => ({ ...prev, [entry.image]: false }));
            img.src = entry.image;
          }
        }
      });
    }
  }, [entries, imagesLoadingStatus]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, []);

  return (
    <CinematicWorkerPanel worker={worker} onClose={handleClose}>
      <div className="wc" style={{ flex: 1, overflowY: 'auto' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {(["characters", "scenes"] as GalleryCategory[]).map((tab) => (
            <button
              key={tab}
              className="chip"
              data-on={String(activeTab === tab)}
              style={{ '--accent': worker.accent } as React.CSSProperties}
              onClick={() => { setActiveTab(tab); setIndex(0); }}
            >
              {tab}
            </button>
          ))}
          <span className="slate" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            {hasEntries ? `${index + 1}/${entries.length}` : '0/0'}
          </span>
        </div>

        {/* Gallery area */}
        <div className="wc-out glass" style={{ position: 'relative', minHeight: 280, flex: 1 }}>
          {!hasEntries ? (
            <div className="wc-working"><span className="slate">No images available.</span></div>
          ) : isProcessing || current?.loading ? (
            <div className="wc-working">
              <div className="clap-load">
                <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: '<path d="m4 11 16-3"/><path d="M4 11v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8Z"/><path d="m4.5 7.5 15-3 .8 3.5-15 3Z"/>' }} />
              </div>
              <div className="slate">Rendering…</div>
            </div>
          ) : (
            <>
              <ScribbleEditor
                src={getImageUrl(current?.image || '')}
                exportRef={scribbleExportRef}
                lines={scribblesByIndex[index] || []}
                onChangeLines={(l) => {
                  setScribblesByIndex((prev) => ({ ...prev, [index]: l }));
                  if (current?.image) setScribblesForImage(current.image, l);
                }}
              />
              <button
                onClick={handleRefreshImage}
                style={{ position: 'absolute', top: 12, right: 12, background: 'var(--glass)', border: '1px solid var(--hair)', borderRadius: 'var(--r-sm)', padding: '6px 10px', color: 'var(--ink-2)', fontSize: 13 }}
                title="Refresh image"
              >🔄</button>
              {current?.image && (
                <img src={getImageUrl(current.image)} style={{ display: 'none' }}
                  onLoad={() => setImagesLoadingStatus(prev => ({ ...prev, [current.image]: false }))}
                  onError={() => setImagesLoadingStatus(prev => ({ ...prev, [current.image]: false }))}
                  alt=""
                />
              )}
              {/* Nav arrows */}
              <button onClick={goPrev} aria-label="Previous"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'var(--glass)', border: '1px solid var(--hair)', borderRadius: 'var(--r-sm)', padding: '8px 12px', color: 'var(--ink)' }}>
                ←
              </button>
              <button onClick={goNext} aria-label="Next"
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'var(--glass)', border: '1px solid var(--hair)', borderRadius: 'var(--r-sm)', padding: '8px 12px', color: 'var(--ink)' }}>
                →
              </button>
            </>
          )}
        </div>

        {/* Description + input */}
        <div className="wc-dock">
          {current?.description && (
            <div className="scroll" style={{ maxHeight: 100, overflowY: 'auto', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{current.description}</pre>
            </div>
          )}

          <div className="wc-field-wrap">
            <label className="wc-label slate">Describe changes</label>
            <textarea
              className="field"
              rows={3}
              value={input}
              placeholder="e.g. Make the lighting moodier, add rain, change outfit to red…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitCurrent(); }
              }}
            />
          </div>

          <div className="wc-actions">
            <div style={{ display: 'flex', gap: 8 }}>
              {activeTab === "characters" ? (
                <button className="btn btn-ghost btn-sm" onClick={handleGenerateScenes} disabled={isGeneratingScenes}>
                  <span>{isGeneratingScenes ? 'Generating…' : 'Generate Scenes'}</span>
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={handleGenerateVideo} disabled={isGeneratingVideo || backendScenes.length === 0}
                  style={{ '--accent': '#f59e0b' } as React.CSSProperties}>
                  <span>{isGeneratingVideo ? 'Generating…' : 'Generate Video'}</span>
                </button>
              )}
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSubmitCurrent}
              disabled={isProcessing || !input.trim()}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: '<path d="m12 3 1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6Z"/><path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>' }} />
              <span>{worker.cta}</span>
            </button>
          </div>
        </div>
      </div>
    </CinematicWorkerPanel>
  );
}
