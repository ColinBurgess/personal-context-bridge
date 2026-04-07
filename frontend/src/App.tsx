import React, { useState, useEffect } from 'react';
import {
  Save,
  Search,
  Database,
  Tag,
  Clock,
  Cpu,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  History,
  Terminal,
  Home,
  Share2,
  Copy,
  Trash2,
  X,
  ExternalLink,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as d3 from 'd3';
import {APP_VERSION} from './version';

// --- Types ---
interface MemoryMetadata {
  timestamp: string;
  model_used: string;
  topic_tags: string[];
  priority: string;
}

interface KeyEntities {
  concepts: string[];
  tools: string[];
  decisions: string[];
  pending_actions: string[];
}

interface Memory {
  id: string;
  metadata: MemoryMetadata;
  summary: string;
  key_entities: KeyEntities;
  context_reference: string;
}

interface ClientLog {
  timestamp: string;
  level: 'info' | 'success' | 'error';
  message: string;
}

interface BackupPayload {
  version: number;
  created_at: string;
  count: number;
  memories: Memory[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const API_TIMEOUT_MS = 15000;

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
      return [value];
    } catch {
      return [value];
    }
  }
  return [];
};

const normalizeMemory = (raw: unknown): Memory | null => {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  const metadata = (data.metadata && typeof data.metadata === 'object')
    ? (data.metadata as Record<string, unknown>)
    : {};
  const keyEntities = (data.key_entities && typeof data.key_entities === 'object')
    ? (data.key_entities as Record<string, unknown>)
    : ((metadata.key_entities && typeof metadata.key_entities === 'object')
      ? (metadata.key_entities as Record<string, unknown>)
      : {});

  const id = typeof data.id === 'string' ? data.id : `legacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const summary = typeof data.summary === 'string' ? data.summary : 'Legacy memory entry';
  const contextReference = typeof data.context_reference === 'string'
    ? data.context_reference
    : (typeof metadata.context_reference === 'string' ? metadata.context_reference : 'Legacy Memory');

  return {
    id,
    metadata: {
      timestamp: typeof metadata.timestamp === 'string' ? metadata.timestamp : new Date().toISOString(),
      model_used: typeof metadata.model_used === 'string' ? metadata.model_used : 'unknown',
      topic_tags: normalizeStringArray(metadata.topic_tags),
      priority: typeof metadata.priority === 'string' ? metadata.priority : 'Medium',
    },
    summary,
    key_entities: {
      concepts: normalizeStringArray(keyEntities.concepts),
      tools: normalizeStringArray(keyEntities.tools),
      decisions: normalizeStringArray(keyEntities.decisions),
      pending_actions: normalizeStringArray(keyEntities.pending_actions),
    },
    context_reference: contextReference,
  };
};

export default function App() {
  const [jsonInput, setJsonInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [activeTab, setActiveTab] = useState<'home' | 'memories' | 'graph'>('home');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null);
  const [showLlmInstructions, setShowLlmInstructions] = useState(false);
  const [systemTime, setSystemTime] = useState(new Date().toISOString());
  const [logs, setLogs] = useState<ClientLog[]>([]);
  const [dbImportMode, setDbImportMode] = useState<'append' | 'replace'>('append');
  const isJsonInputEmpty = !jsonInput.trim();
  const dbImportInputRef = React.useRef<HTMLInputElement>(null);
  const noteImportInputRef = React.useRef<HTMLInputElement>(null);

  const addLog = (message: string, level: ClientLog['level'] = 'info') => {
    const entry: ClientLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    setLogs(prev => [entry, ...prev].slice(0, 40));
  };

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'Request timed out while contacting backend API.';
    }
    if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
      return 'Cannot reach backend API. Ensure PCB backend is running.';
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return fallback;
  };

  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = API_TIMEOUT_MS): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const downloadJsonFile = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const readJsonFile = async (file: File): Promise<unknown> => {
    const text = await file.text();
    return JSON.parse(text);
  };

  const buildBackupPayload = (items: Memory[]): BackupPayload => ({
    version: 1,
    created_at: new Date().toISOString(),
    count: items.length,
    memories: items,
  });

  const timestampForFilename = () => new Date().toISOString().replace(/[:.]/g, '-');

  const loadMemoriesFromBackend = async () => {
    addLog('Loading memories from backend...', 'info');
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/get_all_memories`);
      if (!response.ok) {
        throw new Error('Failed to load memories from backend');
      }

      const data = await response.json();
      const normalized = Array.isArray(data)
        ? data.map(normalizeMemory).filter((item): item is Memory => item !== null)
        : [];
      setMemories(normalized);
      addLog(`Loaded ${normalized.length} memories from backend.`, 'success');
    } catch (error) {
      addLog(getErrorMessage(error, 'Could not load memories from local backend.'), 'error');
      setStatus({ type: 'error', message: getErrorMessage(error, 'Could not load memories from local backend.') });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    }
  };

  const exportDatabaseBackup = async () => {
    addLog('Preparing full database backup...', 'info');
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/get_all_memories`);
      if (!response.ok) {
        throw new Error('Failed to fetch database for backup');
      }
      const data = await response.json();
      const normalized = Array.isArray(data)
        ? data.map(normalizeMemory).filter((item): item is Memory => item !== null)
        : [];
      const payload = buildBackupPayload(normalized);
      downloadJsonFile(`pcb_db_backup_${timestampForFilename()}.json`, payload);
      addLog(`Database backup exported (${payload.count} memories).`, 'success');
      setStatus({ type: 'success', message: `Database backup exported (${payload.count} memories).` });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to export database backup.');
      addLog(message, 'error');
      setStatus({ type: 'error', message });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    }
  };

  const triggerDatabaseImport = (mode: 'append' | 'replace') => {
    setDbImportMode(mode);
    dbImportInputRef.current?.click();
  };

  const importDatabaseBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';
    addLog(`Importing database backup (${dbImportMode}) from ${file.name}...`, 'info');
    try {
      const parsed = await readJsonFile(file);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Backup file must contain a JSON object payload.');
      }

      const response = await fetchWithTimeout(`${API_BASE_URL}/restore_memories_payload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: dbImportMode,
          payload: parsed,
        }),
      });

      if (!response.ok) {
        let detail = 'Database import failed';
        try {
          const errorPayload = await response.json();
          if (errorPayload?.detail && typeof errorPayload.detail === 'string') {
            detail = errorPayload.detail;
          }
        } catch (_parseError) {
          // Ignore non-JSON error payloads.
        }
        throw new Error(detail);
      }

      const result = await response.json().catch(() => ({} as Record<string, unknown>));
      const importedCount = typeof result.imported === 'number' ? result.imported : 0;

      await loadMemoriesFromBackend();
      addLog(`Database import completed (${importedCount} memories).`, 'success');
      setStatus({ type: 'success', message: `Database import completed (${importedCount} memories).` });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to import database backup.');
      addLog(message, 'error');
      setStatus({ type: 'error', message });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    }
  };

  const exportMemoryBackup = (memory: Memory) => {
    const payload = {
      version: 1,
      created_at: new Date().toISOString(),
      count: 1,
      memories: [memory],
    };
    downloadJsonFile(`pcb_memory_${memory.id}_${timestampForFilename()}.json`, payload);
    addLog(`Memory ${memory.id} exported.`, 'success');
    setStatus({ type: 'success', message: `Memory ${memory.id} exported.` });
    setTimeout(() => setStatus({ type: null, message: '' }), 3000);
  };

  const triggerNoteImport = () => {
    noteImportInputRef.current?.click();
  };

  const importNoteBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';
    addLog(`Importing note backup from ${file.name}...`, 'info');

    try {
      const parsed = await readJsonFile(file);
      let items: unknown[] = [];

      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && typeof parsed === 'object') {
        const asObject = parsed as Record<string, unknown>;
        if (Array.isArray(asObject.memories)) {
          items = asObject.memories;
        } else {
          items = [parsed];
        }
      }

      const normalizedItems = items
        .map(normalizeMemory)
        .filter((item): item is Memory => item !== null);

      if (normalizedItems.length === 0) {
        throw new Error('No valid memory entries found in selected file.');
      }

      for (const item of normalizedItems) {
        const payload = {
          metadata: item.metadata,
          summary: item.summary,
          key_entities: item.key_entities,
          context_reference: item.context_reference,
        };

        const response = await fetchWithTimeout(`${API_BASE_URL}/save_memory`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed importing memory: ${item.summary}`);
        }
      }

      await loadMemoriesFromBackend();
      addLog(`Imported ${normalizedItems.length} memory entries from note file.`, 'success');
      setStatus({ type: 'success', message: `Imported ${normalizedItems.length} memory entries.` });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to import note backup file.');
      addLog(message, 'error');
      setStatus({ type: 'error', message });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    }
  };

  const exampleJsonPlaceholder = `{
  "metadata": {
    "timestamp": "2026-04-01T00:00:00Z",
    "model_used": "gpt-5.3-codex",
    "topic_tags": ["Project Setup", "Best Practices"],
    "priority": "High"
  },
  "summary": "Example memory summary.",
  "key_entities": {
    "concepts": ["Testing", "Versioning"],
    "tools": ["pytest", "vitest"],
    "decisions": ["Define clear folder structure"],
    "pending_actions": ["Create initial CI pipeline"]
  },
  "context_reference": "Example Context"
}`;

  const llmInstructions = `Generate exactly one valid JSON object for the memory system.

Return only JSON. Do not include markdown fences, explanations, or extra text.

Required schema:
{
  "metadata": {
    "timestamp": "ISO-8601 datetime string",
    "model_used": "string",
    "topic_tags": ["string", "string"],
    "priority": "High | Medium | Low"
  },
  "summary": "string",
  "key_entities": {
    "concepts": ["string"],
    "tools": ["string"],
    "decisions": ["string"],
    "pending_actions": ["string"]
  },
  "context_reference": "string"
}

Rules:
- Keep arrays non-empty when information exists.
- Keep summary concise but specific.
- Use plain strings only.
- Ensure JSON is syntactically valid.`;

  useEffect(() => {
    const timer = setInterval(() => setSystemTime(new Date().toISOString()), 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    void loadMemoriesFromBackend();
  }, []);

  const parseMemoryInput = (rawInput: string): Record<string, unknown> => {
    const firstPass = JSON.parse(rawInput);

    // Allow quoted JSON payloads pasted as a string (double-encoded JSON).
    if (typeof firstPass === 'string') {
      const secondPass = JSON.parse(firstPass);
      if (!secondPass || typeof secondPass !== 'object' || Array.isArray(secondPass)) {
        throw new Error('Input must be a JSON object');
      }
      return secondPass as Record<string, unknown>;
    }

    if (!firstPass || typeof firstPass !== 'object' || Array.isArray(firstPass)) {
      throw new Error('Input must be a JSON object');
    }

    return firstPass as Record<string, unknown>;
  };

  const handleSave = async () => {
    if (!jsonInput.trim()) {
      setStatus({ type: 'error', message: 'Write your own JSON memory before saving.' });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
      return;
    }

    try {
      const parsed = parseMemoryInput(jsonInput);
      const payload = { ...parsed };
      delete (payload as { id?: unknown }).id;
      addLog('Sending save request to backend...', 'info');

      const response = await fetchWithTimeout(`${API_BASE_URL}/save_memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let detail = 'Save request failed';
        try {
          const errorPayload = await response.json();
          if (errorPayload?.detail && typeof errorPayload.detail === 'string') {
            detail = errorPayload.detail;
          }
        } catch (_parseError) {
          // Ignore non-JSON error payloads.
        }
        throw new Error(detail);
      }

      const saveResult = await response.json().catch(() => ({} as Record<string, unknown>));
      const savedId = typeof saveResult.id === 'string' ? saveResult.id : 'unknown_id';
      addLog(`Memory saved successfully (id: ${savedId}).`, 'success');
      setStatus({ type: 'success', message: 'Memory saved to local filesystem database.' });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);

      // Refresh list in the background so a slow list endpoint does not block save feedback.
      void loadMemoriesFromBackend();
    } catch (error) {
      const message = getErrorMessage(error, 'Save failed. Verify JSON and backend availability.');
      addLog(`Save failed: ${message}`, 'error');
      setStatus({ type: 'error', message });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    }
  };

  const requestDelete = (memory: Memory, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDelete(memory);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      addLog(`Deleting memory ${pendingDelete.id}...`, 'info');
      const response = await fetchWithTimeout(`${API_BASE_URL}/delete_memory/${encodeURIComponent(pendingDelete.id)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        let detail = 'Delete request failed';
        try {
          const errorPayload = await response.json();
          if (errorPayload?.detail && typeof errorPayload.detail === 'string') {
            detail = errorPayload.detail;
          }
        } catch (_parseError) {
          // Ignore non-JSON error payloads.
        }
        throw new Error(detail);
      }

      await loadMemoriesFromBackend();
      if (selectedMemory?.id === pendingDelete.id) setSelectedMemory(null);
      setPendingDelete(null);
      addLog('Memory deleted successfully.', 'success');
      setStatus({ type: 'success', message: 'Memory deleted.' });
      setTimeout(() => setStatus({ type: null, message: '' }), 2000);
    } catch (error) {
      setPendingDelete(null);
      const message = getErrorMessage(error, 'Delete failed. Backend may be unavailable.');
      addLog(`Delete failed: ${message}`, 'error');
      setStatus({ type: 'error', message });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setStatus({ type: 'success', message: 'Copied to clipboard!' });
    setTimeout(() => setStatus({ type: null, message: '' }), 2000);
  };

  const copyLLMContext = (m: Memory) => {
    const prompt = `
[PERSONAL CONTEXT BRIDGE - MEMORY REFERENCE]
ID: ${m.id}
CONTEXT: ${m.context_reference}
DATE: ${new Date(m.metadata.timestamp).toLocaleString()}

SUMMARY:
${m.summary}

KEY CONCEPTS:
${m.key_entities.concepts.join(', ')}

DECISIONS MADE:
${m.key_entities.decisions.join(', ')}

PENDING ACTIONS:
${m.key_entities.pending_actions.join(', ')}

TOOLS USED:
${m.key_entities.tools.join(', ')}

INSTRUCTION: Please use this context to maintain consistency in our current session.
`.trim();
    copyToClipboard(prompt);
  };

  const filteredMemories = memories.filter(m => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const topicTags = m.metadata?.topic_tags ?? [];
    const concepts = m.key_entities?.concepts ?? [];
    return (
      m.summary.toLowerCase().includes(query) ||
      topicTags.some(t => t.toLowerCase().includes(query)) ||
      concepts.some(c => c.toLowerCase().includes(query)) ||
      m.context_reference.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[#05070a] text-zinc-400 font-mono selection:bg-emerald-500/30 overflow-x-hidden relative">
      <div className="scanline" />
      <div className="crt-overlay" />
      <div className="noise" />

      {/* Header */}
      <header className="border-b border-emerald-500/10 bg-black/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-none px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Database className="text-emerald-500 w-6 h-6 glow-text" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-white font-bold tracking-tighter text-xl glow-text flicker">PCB_BRIDGE <span className="text-emerald-500">v{APP_VERSION}</span></h1>
              <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-bold">
                <span>Personal Context Bridge</span>
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-500/60">System Active</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-8 px-6 border-x border-emerald-500/10 h-full">
            <div className="flex flex-col">
              <span className="text-[8px] text-zinc-600 uppercase tracking-widest">System Time</span>
              <span className="text-xs text-emerald-500/80 font-bold">{systemTime}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Encryption</span>
              <span className="text-xs text-zinc-400 font-bold">AES-256-GCM</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Uplink</span>
              <span className="text-xs text-emerald-500/60 font-bold">STABLE // 42ms</span>
            </div>
          </div>

          <nav className="flex gap-1 bg-black/40 p-1 rounded border border-emerald-500/10 overflow-x-auto max-w-[62vw] sm:max-w-none">
            {[
              { id: 'home', icon: Home, label: 'Terminal' },
              { id: 'memories', icon: Database, label: 'Database' },
              { id: 'graph', icon: Share2, label: 'Network' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-2.5 sm:px-4 py-1.5 rounded text-[9px] sm:text-[10px] uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className={`transition-all duration-500 py-4 sm:py-6 lg:py-8 min-h-[calc(100dvh-4rem)] ${
        activeTab === 'graph' ? 'max-w-none px-2 sm:px-4' : 'max-w-[1700px] mx-auto px-3 sm:px-6'
      }`}>
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 xl:gap-8 xl:min-h-[calc(100dvh-9rem)]"
            >
              <div className="xl:col-span-8 space-y-4 sm:space-y-6 xl:h-full xl:flex xl:flex-col">
                <div className="bg-black/40 border border-emerald-500/10 rounded overflow-hidden tactical-border xl:flex-1 xl:min-h-0 flex flex-col">
                  <div className="bg-emerald-500/5 px-4 py-2 border-b border-emerald-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
                        <div className="w-2 h-2 rounded-full bg-emerald-500/20" />
                        <div className="w-2 h-2 rounded-full bg-emerald-500/10" />
                      </div>
                      <span className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-[0.2em]">Input_Buffer // memory_stream.log</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-zinc-600 uppercase font-bold">Status: Ready</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    </div>
                  </div>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder={exampleJsonPlaceholder}
                    className="w-full h-[clamp(300px,50vh,640px)] xl:h-full bg-transparent p-3 sm:p-6 font-mono text-[12px] sm:text-sm text-emerald-500/80 placeholder:text-zinc-500/70 focus:outline-none resize-none leading-relaxed custom-scrollbar"
                    spellCheck={false}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 xl:mt-auto">
                  <div className="flex items-center gap-3">
                    {status.type === 'success' && (
                      <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-2 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
                        <CheckCircle2 size={14} /> {status.message}
                      </motion.div>
                    )}
                    {status.type === 'error' && (
                      <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase tracking-widest">
                        <AlertCircle size={14} /> {status.message}
                      </motion.div>
                    )}
                  </div>
                  <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setShowLlmInstructions(true)}
                      className="w-full sm:w-auto bg-black/40 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold px-6 py-3 rounded uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all"
                    >
                      <Terminal size={16} />
                      LLM_Instructions
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isJsonInputEmpty}
                      className="w-full sm:w-auto bg-emerald-500/10 hover:bg-emerald-500/20 disabled:hover:bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 disabled:text-zinc-600 disabled:border-zinc-800 disabled:cursor-not-allowed font-bold px-6 sm:px-8 py-3 rounded uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all active:scale-95 disabled:active:scale-100 shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                    >
                      <Save size={16} />
                      Commit_Memory
                    </button>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-4 space-y-4 sm:space-y-6 xl:h-full xl:flex xl:flex-col">
                <div className="bg-black/40 border border-emerald-500/10 rounded p-6 tactical-border xl:flex-1 xl:min-h-[240px]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-emerald-500 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                      <History size={14} />
                      Recent_Logs
                    </h3>
                    <div className="text-[8px] text-zinc-600 font-bold">COUNT: {memories.length}</div>
                  </div>
                  <div className="space-y-4">
                    {memories.length === 0 ? (
                      <p className="text-zinc-700 text-[10px] uppercase tracking-widest italic">No active logs found.</p>
                    ) : (
                      memories.slice(0, 5).map((m) => (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMemory(m)}
                          className="p-3 bg-emerald-500/[0.02] border border-emerald-500/5 rounded hover:border-emerald-500/30 hover:bg-emerald-500/[0.05] transition-all cursor-pointer group flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-zinc-500 line-clamp-1 mb-1 group-hover:text-emerald-500/80 transition-colors uppercase tracking-wider">{m.summary}</p>
                            <div className="flex items-center gap-3">
                              <span className="text-[8px] text-zinc-700 font-bold">{new Date(m.metadata.timestamp).toLocaleDateString()}</span>
                              <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/5 border border-emerald-500/10 rounded text-emerald-500/40 group-hover:text-emerald-500/60 transition-colors uppercase">{m.metadata.priority}</span>
                            </div>
                          </div>
                          <ChevronRight size={12} className="text-zinc-800 group-hover:text-emerald-500 transition-colors shrink-0" />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded p-6 xl:flex-1 xl:min-h-[260px]">
                  <h4 className="text-emerald-500/60 font-bold text-[10px] uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <Terminal size={14} />
                    System_Notice
                  </h4>
                  <p className="text-[10px] text-zinc-600 leading-relaxed uppercase tracking-wider mb-4">
                    Persistence layer active. Memories are stored in local filesystem via backend vector database.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-6 border-y border-emerald-500/10 py-4">
                    <div className="flex flex-col">
                      <span className="text-[7px] text-zinc-600 uppercase tracking-widest mb-1">CPU_LOAD</span>
                      <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: ["20%", "45%", "30%", "60%", "40%"] }}
                          transition={{ duration: 5, repeat: Infinity }}
                          className="h-full bg-emerald-500/40"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] text-zinc-600 uppercase tracking-widest mb-1">NET_TRAFFIC</span>
                      <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: ["10%", "80%", "40%", "90%", "20%"] }}
                          transition={{ duration: 3, repeat: Infinity }}
                          className="h-full bg-blue-500/40"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-emerald-500/10 pt-4">
                    {logs.length === 0 ? (
                      <div className="text-[8px] text-zinc-700 uppercase tracking-widest">No operation logs yet.</div>
                    ) : logs.map((log, i) => (
                      <div key={`${log.timestamp}-${i}`} className={`text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                        log.level === 'error' ? 'text-red-500/90' : log.level === 'success' ? 'text-emerald-500' : 'text-zinc-500'
                      }`}>
                        <span className="text-[6px] opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className={i === 0 ? 'animate-pulse' : ''}>{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'memories' && (
            <motion.div
              key="memories"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {status.type && (
                <div className={`max-w-2xl mx-auto border rounded px-4 py-3 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 ${
                  status.type === 'success'
                    ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5'
                    : 'text-red-500 border-red-500/30 bg-red-500/5'
                }`}>
                  {status.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {status.message}
                </div>
              )}

              <div className="max-w-2xl mx-auto">
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <button
                    onClick={exportDatabaseBackup}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 font-bold py-2.5 rounded uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-2 transition-all"
                  >
                    <Download size={13} />
                    Backup_DB
                  </button>
                  <button
                    onClick={() => triggerDatabaseImport('append')}
                    className="bg-black/40 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold py-2.5 rounded uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-2 transition-all"
                  >
                    <Upload size={13} />
                    Import_DB_Append
                  </button>
                  <button
                    onClick={() => triggerDatabaseImport('replace')}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold py-2.5 rounded uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-2 transition-all"
                  >
                    <Upload size={13} />
                    Import_DB_Replace
                  </button>
                  <button
                    onClick={triggerNoteImport}
                    className="bg-black/40 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold py-2.5 rounded uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-2 transition-all"
                  >
                    <Upload size={13} />
                    Import_Note
                  </button>
                </div>

                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/40 group-focus-within:text-emerald-500 transition-colors" size={18} />
                  <input
                    type="text"
                    placeholder="SEARCH_DATABASE // ENTER_QUERY..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-emerald-500/10 rounded py-4 pl-12 pr-4 text-emerald-500/80 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/40 transition-all tactical-border uppercase text-[10px] tracking-widest font-bold"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-emerald-500 transition-colors text-[8px] font-bold uppercase tracking-widest"
                    >
                      Clear_Filter
                    </button>
                  )}
                </div>
              </div>

              <input
                ref={dbImportInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={importDatabaseBackup}
              />

              <input
                ref={noteImportInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={importNoteBackup}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMemories.length > 0 ? (
                  filteredMemories.map((res) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ y: -2 }}
                      onClick={() => setSelectedMemory(res)}
                      className="bg-black/40 border border-emerald-500/10 rounded p-6 hover:border-emerald-500/40 transition-all group flex flex-col h-full cursor-pointer relative overflow-hidden tactical-border"
                      key={res.id}
                    >
                      <div className="absolute top-0 left-0 w-full h-[1px] bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                      <button
                        onClick={(e) => requestDelete(res, e)}
                        className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10 bg-black/60 rounded border border-zinc-700/60"
                        title="Purge_Record"
                      >
                        <Trash2 size={12} />
                      </button>

                      <div className="flex items-start justify-between mb-4 pr-8">
                        <div className="flex flex-wrap gap-1">
                          {res.metadata.topic_tags.map(tag => (
                            <span key={tag} className="text-[8px] px-1.5 py-0.5 bg-emerald-500/5 text-emerald-500/60 rounded border border-emerald-500/10 uppercase font-bold">{tag}</span>
                          ))}
                        </div>
                        <span className="text-[8px] text-zinc-700 font-bold shrink-0">{res.id}</span>
                      </div>

                      <h4 className="text-zinc-300 text-[11px] font-bold mb-4 group-hover:text-emerald-500 transition-colors line-clamp-2 uppercase tracking-wider">{res.summary}</h4>

                      <div className="space-y-3 flex-grow">
                        <div className="bg-emerald-500/[0.02] p-3 rounded border border-emerald-500/5">
                          <span className="text-[7px] uppercase text-zinc-600 block mb-1 font-bold tracking-widest">Concepts_Index</span>
                          <p className="text-[9px] text-zinc-500 line-clamp-2 uppercase tracking-tight">{res.key_entities.concepts.join(', ')}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-emerald-500/5">
                        <div className="flex items-center gap-3 text-[8px] text-zinc-700 font-bold uppercase">
                          <span className="flex items-center gap-1"><Cpu size={10} /> {res.metadata.model_used}</span>
                          <span className="flex items-center gap-1"><Clock size={10} /> {new Date(res.metadata.timestamp).toLocaleDateString()}</span>
                        </div>
                        <span className={`text-[8px] px-2 py-0.5 rounded font-bold uppercase ${
                          res.metadata.priority === 'High' ? 'bg-red-500/10 text-red-500/60 border border-red-500/20' : 'bg-zinc-900 text-zinc-700 border border-zinc-800'
                        }`}>
                          {res.metadata.priority}
                        </span>
                      </div>

                      <div className="mt-4 pt-4 border-t border-emerald-500/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <span className="text-[8px] text-emerald-500 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
                          Access_Record <ChevronRight size={10} />
                        </span>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-20 bg-black/20 border border-dashed border-emerald-500/10 rounded tactical-border">
                    <Database className="mx-auto text-zinc-800 mb-4" size={32} />
                    <p className="text-zinc-600 text-[10px] uppercase tracking-[0.2em] font-bold">
                      {memories.length === 0
                        ? "Database_Empty // No_Records_Found"
                        : `Query_Null // No_Matches_For "${searchQuery}"`}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full"
            >
              <div className="bg-black/40 border border-emerald-500/10 rounded p-3 sm:p-6 relative h-[72vh] min-h-[420px] max-h-[900px] overflow-hidden flex flex-col tactical-border">
                <div className="mb-4 sm:mb-6 px-1 sm:px-2 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold text-white mb-1 tracking-tighter glow-text uppercase">Network_Topology</h2>
                    <p className="text-emerald-500/40 text-[8px] sm:text-[10px] uppercase tracking-[0.2em] font-bold">Visualizing node relationships // Real-time mapping active</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] text-zinc-600 uppercase font-bold">Signal Strength</span>
                      <div className="flex gap-0.5 mt-1">
                        {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-2 rounded-full ${i < 5 ? 'bg-emerald-500' : 'bg-zinc-800'}`} />)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-grow relative bg-black/40 rounded border border-emerald-500/5">
                  <GraphVisualization memories={memories} />
                </div>

                <div className="mt-4 sm:mt-6 px-1 sm:px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex gap-4 sm:gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <span className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-bold">Context_Node</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                      <span className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-bold">Entity_Tag</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Active_Nodes: {new Set([...memories.map(m => m.context_reference), ...memories.flatMap(m => m.metadata.topic_tags)]).size}</p>
                    <div className="w-px h-3 bg-zinc-800" />
                    <p className="text-[9px] text-emerald-500/60 font-bold uppercase tracking-widest animate-pulse">Scanning...</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* LLM Instructions Modal */}
      <AnimatePresence>
        {showLlmInstructions && (
          <div className="fixed inset-0 z-[108] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLlmInstructions(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-[#05070a] border border-emerald-500/20 rounded shadow-2xl overflow-hidden flex flex-col max-h-[90vh] tactical-border"
            >
              <div className="flex items-center justify-between p-5 border-b border-emerald-500/10 bg-emerald-500/5 shrink-0">
                <div className="flex items-center gap-3">
                  <Terminal size={16} className="text-emerald-500" />
                  <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-[0.2em]">LLM_Instructions</h3>
                </div>
                <button
                  onClick={() => setShowLlmInstructions(false)}
                  className="p-2 hover:bg-emerald-500/10 rounded text-zinc-600 hover:text-emerald-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-grow">
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] mb-4">
                  Copy this prompt and paste it into your LLM to generate valid memory JSON.
                </p>
                <pre className="text-[11px] sm:text-xs text-emerald-500/80 bg-black/40 border border-emerald-500/10 rounded p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {llmInstructions}
                </pre>
              </div>

              <div className="p-5 border-t border-emerald-500/10 flex flex-col sm:flex-row gap-3 shrink-0">
                <button
                  onClick={() => setShowLlmInstructions(false)}
                  className="flex-1 bg-black/40 hover:bg-zinc-800 text-zinc-400 border border-zinc-700 font-bold py-2.5 rounded uppercase tracking-[0.2em] text-[10px] transition-all"
                >
                  Close
                </button>
                <button
                  onClick={() => copyToClipboard(llmInstructions)}
                  className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 font-bold py-2.5 rounded uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 active:translate-y-px"
                >
                  <Copy size={14} />
                  Copy_Instructions
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {pendingDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPendingDelete(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#05070a] border border-red-500/30 rounded shadow-2xl overflow-hidden tactical-border"
            >
              <div className="flex items-center gap-3 p-5 border-b border-red-500/20 bg-red-500/[0.04]">
                <Trash2 size={16} className="text-red-400" />
                <h3 className="text-sm font-bold text-red-300 uppercase tracking-[0.2em]">Confirm_Delete</h3>
              </div>

              <div className="p-5 space-y-3">
                <p className="text-[11px] text-zinc-400 uppercase tracking-wide">
                  You are about to remove this memory entry permanently.
                </p>
                <p className="text-[10px] text-zinc-500 break-all">
                  ID: {pendingDelete.id}
                </p>
                <p className="text-[10px] text-zinc-500 line-clamp-2">
                  {pendingDelete.summary}
                </p>
              </div>

              <div className="p-5 border-t border-zinc-800 flex gap-3">
                <button
                  onClick={() => setPendingDelete(null)}
                  className="flex-1 bg-black/40 hover:bg-zinc-800 text-zinc-400 border border-zinc-700 font-bold py-2.5 rounded uppercase tracking-[0.2em] text-[10px] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/40 font-bold py-2.5 rounded uppercase tracking-[0.2em] text-[10px] transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Memory Detail Modal */}
      <AnimatePresence>
        {selectedMemory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMemory(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#05070a] border border-emerald-500/20 rounded shadow-2xl overflow-hidden flex flex-col max-h-[90vh] tactical-border"
            >
              <div className="flex items-center justify-between p-6 border-b border-emerald-500/10 bg-emerald-500/5 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20 text-emerald-500">
                    <Database size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em] glow-text">Record_Details</h2>
                    <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-[0.3em]">{selectedMemory.id} // SECURE_ACCESS</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMemory(null)}
                  className="p-2 hover:bg-emerald-500/10 rounded text-zinc-600 hover:text-emerald-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-8 overflow-y-auto custom-scrollbar flex-grow">
                <section>
                  <h3 className="text-[8px] uppercase tracking-[0.3em] text-emerald-500/40 font-bold mb-4">Summary_Data</h3>
                  <p className="text-zinc-300 text-sm leading-relaxed uppercase tracking-wide">{selectedMemory.summary}</p>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <section>
                    <h3 className="text-[8px] uppercase tracking-[0.3em] text-emerald-500/40 font-bold mb-4">Concepts_Index</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedMemory.key_entities.concepts.map(c => (
                        <span key={c} className="px-2 py-1 bg-emerald-500/5 text-emerald-500/60 rounded text-[9px] border border-emerald-500/10 uppercase font-bold">{c}</span>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h3 className="text-[8px] uppercase tracking-[0.3em] text-emerald-500/40 font-bold mb-4">Action_Items</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedMemory.key_entities.pending_actions.map(d => (
                        <span key={d} className="px-2 py-1 bg-emerald-500/5 text-emerald-500/60 rounded text-[9px] border border-emerald-500/10 uppercase font-bold">{d}</span>
                      ))}
                    </div>
                  </section>
                </div>

                <section className="bg-emerald-500/[0.02] p-6 rounded border border-emerald-500/10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[8px] uppercase tracking-[0.3em] text-emerald-500/40 font-bold">System_Metadata</h3>
                    <span className="text-[8px] px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20 uppercase font-bold">{selectedMemory.context_reference}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 text-[10px] uppercase tracking-widest font-bold">
                    <div className="flex items-center gap-3 text-zinc-600">
                      <Clock size={12} className="text-emerald-500/40" /> <span>{new Date(selectedMemory.metadata.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-600">
                      <Cpu size={12} className="text-emerald-500/40" /> <span>{selectedMemory.metadata.model_used}</span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-600">
                      <Tag size={12} className="text-emerald-500/40" /> <span>{selectedMemory.metadata.topic_tags.join(' // ')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-600">
                      <AlertCircle size={12} className="text-emerald-500/40" /> <span>Priority: {selectedMemory.metadata.priority}</span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-6 bg-emerald-500/[0.02] border-t border-emerald-500/10 flex flex-col sm:flex-row gap-3 shrink-0">
                <button
                  onClick={() => copyLLMContext(selectedMemory)}
                  className="flex-[2] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 font-bold py-3 rounded uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  <Share2 size={14} />
                  Export_Context
                </button>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(selectedMemory, null, 2))}
                  className="flex-1 bg-black/40 hover:bg-zinc-800 text-zinc-500 border border-zinc-800 font-bold py-3 rounded uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  <Copy size={14} />
                  JSON
                </button>
                <button
                  onClick={() => exportMemoryBackup(selectedMemory)}
                  className="flex-1 bg-black/40 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold py-3 rounded uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  <Download size={14} />
                  Backup_Note
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GraphVisualization({ memories }: { memories: Memory[] }) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const zoomRef = React.useRef<any>(null);
  const simulationRef = React.useRef<any>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || memories.length === 0) return;

    let width = containerRef.current.clientWidth || 900;
    let height = containerRef.current.clientHeight || 500;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Set viewBox to match actual dimensions
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const nodes: any[] = [];
    const links: any[] = [];
    const nodeSet = new Set();

    memories.forEach(m => {
      const context = m.context_reference;
      if (!nodeSet.has(context)) {
        nodes.push({ id: context, type: 'context' });
        nodeSet.add(context);
      }

      m.metadata.topic_tags.forEach(tag => {
        if (!nodeSet.has(tag)) {
          nodes.push({ id: tag, type: 'tag' });
          nodeSet.add(tag);
        }
        links.push({ source: context, target: tag });
      });
    });

    const g = svg.append("g");

    // Add tactical grid to the graph background
    const gridG = g.append("g").attr("class", "grid-lines").attr("opacity", 0.05);
    for (let i = -2000; i <= 2000; i += 100) {
      gridG.append("line").attr("x1", i).attr("y1", -2000).attr("x2", i).attr("y2", 2000).attr("stroke", "#10b981").attr("stroke-width", 0.5);
      gridG.append("line").attr("x1", -2000).attr("y1", i).attr("x2", 2000).attr("y2", i).attr("stroke", "#10b981").attr("stroke-width", 0.5);
    }

    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom as any);

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(140))
      .force("charge", d3.forceManyBody().strength(-600))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(80));

    simulationRef.current = simulation;

    const link = g.append("g")
      .attr("stroke", "#10b981")
      .attr("stroke-opacity", 0.15)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1);

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "cursor-grab active:cursor-grabbing")
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.append("circle")
      .attr("r", (d: any) => d.type === 'context' ? 8 : 4)
      .attr("fill", "transparent")
      .attr("stroke", (d: any) => d.type === 'context' ? "#10b981" : "#3b82f6")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", (d: any) => d.type === 'context' ? "none" : "2,2");

    node.append("circle")
      .attr("r", (d: any) => d.type === 'context' ? 3 : 1.5)
      .attr("fill", (d: any) => d.type === 'context' ? "#10b981" : "#3b82f6")
      .attr("class", (d: any) => d.type === 'context' ? "animate-pulse" : "");

    // Add tactical crosshair lines for context nodes
    const contextNodes = node.filter((d: any) => d.type === 'context');

    contextNodes.append("line")
      .attr("x1", -12).attr("y1", 0).attr("x2", 12).attr("y2", 0)
      .attr("stroke", "#10b981").attr("stroke-width", 0.5).attr("opacity", 0.3);

    contextNodes.append("line")
      .attr("x1", 0).attr("y1", -12).attr("x2", 0).attr("y2", 12)
      .attr("stroke", "#10b981").attr("stroke-width", 0.5).attr("opacity", 0.3);

    node.append("text")
      .text((d: any) => d.id)
      .attr("x", 12)
      .attr("y", 4)
      .attr("fill", (d: any) => d.type === 'context' ? "#10b981" : "#3b82f6")
      .style("font-size", "9px")
      .style("font-family", "monospace")
      .style("font-weight", "bold")
      .style("text-transform", "uppercase")
      .style("letter-spacing", "1px")
      .style("pointer-events", "none")
      .style("opacity", 0.7);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Initial fit after a short delay to ensure dimensions are correct
    requestAnimationFrame(() => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        svg.attr("viewBox", `0 0 ${w} ${h}`);
        simulation.force("center", d3.forceCenter(w / 2, h / 2));
        simulation.alpha(0.3).restart();
      }
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        svg.attr("viewBox", `0 0 ${w} ${h}`);
        simulation.force("center", d3.forceCenter(w / 2, h / 2));
        simulation.alpha(0.2).restart();
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      simulation.stop();
      resizeObserver.disconnect();
    };
  }, [memories]);

  const handleReset = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  const handleZoom = (delta: number) => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, delta);
    }
  };

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600">
        <Share2 size={48} className="mb-4 opacity-20" />
        <p className="italic">Add some memories to see the knowledge graph.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative group">
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 flex flex-col gap-2 z-20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => handleZoom(1.2)}
          className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => handleZoom(0.8)}
          className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={handleReset}
          className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
          title="Reset View"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full"
      />
    </div>
  );
}

