"use client";

import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  FileText,
  FolderPlus,
  ListTodo,
  LogOut,
  Menu,
  Monitor,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Settings2,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { MarkdownPreview } from "@/components/markdown-preview";
import {
  insertNotebookPageBlock,
  parseNotebookContent,
  serializeNotebookContent,
  splitNotebookTextBlock,
} from "@/lib/notebook-content.mjs";
import type { NotebookContentBlock } from "@/lib/notebook-content.mjs";
import { canStartWorkspaceSync, mergeWorkspaceSnapshots } from "@/lib/workspace-sync.mjs";
import { syncWorkspaceRequest } from "@/lib/workspace-sync-request.mjs";
import type { NotebookPage, Note, Priority, Task, TaskGroup, Workspace } from "@/lib/maxhub-types";
import { bucketForDate, capitalize, dateFromOffset, formatDate, remainingWeekdays, todayInSaoPaulo, weekdayForDate } from "@/lib/task-date";

type ViewMode = "today" | "tasks" | "calendar" | "notebook" | "trash" | "archive" | "settings";
type ThemePreference = "system" | "light" | "dark";
type Bucket = { id: string; label: string; date?: string };

const COLORS = ["#47b8ec", "#f0a36d", "#8e85e8", "#75b88b", "#e77e93", "#e4bd5c"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const THEME_STORAGE_KEY = "maxhub-theme";
const NOTEBOOK_ROOT_ID = "notebook-root";
const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
];
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function matchesNotebookPageCommand(text: string) {
  const query = text.trim().toLocaleLowerCase("pt-BR");
  return query.startsWith("/") && ["/page", "/pagina", "/página"].some((command) =>
    command.startsWith(query) || query.startsWith(`${command} `)
  );
}

function uid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function newGroup(name: string, order: number): TaskGroup {
  const stamp = now();
  return { id: uid(), name, color: COLORS[order % COLORS.length], archived: false, order, createdAt: stamp, updatedAt: stamp, deletedAt: null };
}

function newTask(groupId: string): Task {
  const stamp = now();
  return {
    id: uid(),
    title: "",
    groupId,
    dueDate: null,
    priority: "normal",
    color: COLORS[0],
    completed: false,
    archived: false,
    subtasks: [],
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
}

function currentBuckets(today: string): Bucket[] {
  return [
    { id: "today", label: "Hoje", date: today },
    { id: "tomorrow", label: "Amanhã", date: dateFromOffset(today, 1) },
    ...remainingWeekdays(today),
    { id: "later", label: "Depois" },
    { id: "overdue", label: "Atrasadas" },
  ];
}

function monthWithOffset(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function datesInMonth(month: string) {
  const firstDay = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return [
    ...Array.from({ length: weekdayForDate(firstDay) }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => dateFromOffset(firstDay, index)),
  ];
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return capitalize(new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 15))));
}

function liveItems<T extends { deletedAt: string | null }>(items: T[], nowMs: number) {
  const cutoff = nowMs - RETENTION_MS;
  return items.filter((item) => !item.deletedAt || Date.parse(item.deletedAt) > cutoff);
}

function MarkdownEditor({
  value,
  onChange,
  ariaLabel = "Conteúdo Markdown",
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Markdown</span>
        <button className="text-xs font-medium text-primary" onClick={() => setPreview(!preview)} type="button">
          {preview ? "Editar" : "Visualizar"}
        </button>
      </div>
      {preview ? (
        <div className="min-h-32 p-3"><MarkdownPreview source={value} /></div>
      ) : (
        <textarea
          aria-label={ariaLabel}
          className="min-h-32 w-full resize-y border-0 bg-transparent p-3 text-sm leading-6 outline-none"
          onChange={(event) => onChange(event.target.value)}
          placeholder={"Escreva em Markdown…\n\nUse ## para títulos, - para listas e **negrito**."}
          value={value}
        />
      )}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (password: string) => Promise<string | null> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-screen">
      <form
        className="login-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const message = await onLogin(password);
          if (message) setError(message);
          setBusy(false);
        }}
      >
        <div className="brand-mark">m</div>
        <p className="eyebrow">SEU ESPAÇO DE FOCO</p>
        <h1>Que bom ter você aqui.</h1>
        <p className="text-sm text-muted-foreground">Entre com sua senha para acessar o MaxHub.</p>
        <label className="field-label mt-7" htmlFor="password">Senha</label>
        <input
          autoComplete="current-password"
          className="text-field"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button className="primary-button mt-5 w-full" disabled={busy} type="submit">
          {busy ? "Verificando…" : "Entrar"} <ArrowRight size={16} />
        </button>
      </form>
    </main>
  );
}

export function MaxhubApp() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<"saved" | "pending" | "syncing" | "error" | "conflict">("saved");
  const [storageMode, setStorageMode] = useState<"blob" | "local-dev">("blob");
  const [mode, setMode] = useState<ViewMode>("today");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState(NOTEBOOK_ROOT_ID);
  const [isEditingNotebookPage, setIsEditingNotebookPage] = useState(false);
  const [calendarMonthOverride, setCalendarMonthOverride] = useState<string | null>(null);
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [mobileDetail, setMobileDetail] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [today, setToday] = useState("2000-01-01");
  const [nowMs, setNowMs] = useState(0);
  const [notebookBlockMenuIndex, setNotebookBlockMenuIndex] = useState<number | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const themePreferenceInitializedRef = useRef(false);
  const versionRef = useRef<string | null>(null);
  const stateRef = useRef<Workspace | null>(null);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const initialWorkspaceRequestRef = useRef<ReturnType<typeof requestWorkspace> | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    let preference = themePreference;
    if (!themePreferenceInitializedRef.current) {
      themePreferenceInitializedRef.current = true;
      const initialPreference = root.dataset.themePreference;
      if (initialPreference === "system" || initialPreference === "light" || initialPreference === "dark") {
        preference = initialPreference;
      }
    }
    const applyTheme = () => {
      const resolvedTheme = preference === "system"
        ? systemTheme.matches ? "dark" : "light"
        : preference;
      root.dataset.theme = resolvedTheme;
      root.dataset.themePreference = preference;
    };
    const handleSystemThemeChange = () => {
      if (preference === "system") applyTheme();
    };

    applyTheme();
    systemTheme.addEventListener("change", handleSystemThemeChange);
    return () => systemTheme.removeEventListener("change", handleSystemThemeChange);
  }, [themePreference]);

  const chooseTheme = (preference: ThemePreference) => {
    setThemePreference(preference);
    const resolvedTheme = preference === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : preference;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = preference;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      setError("O tema foi aplicado, mas não pôde ser salvo neste navegador.");
    }
  };

  const acceptSnapshot = useCallback((data: { workspace: Workspace; version: string | null; storageMode: "blob" | "local-dev" }) => {
    versionRef.current = data.version;
    dirtyRef.current = false;
    setStorageMode(data.storageMode);
    setSyncStatus("saved");
    setError("");
    setWorkspace((current) => current ? mergeWorkspaceSnapshots(current, data.workspace) : data.workspace);
  }, []);

  const requestWorkspace = useCallback(async () => {
    const response = await fetch("/api/data", { cache: "no-store" });
    if (response.status === 401) return null;
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os dados.");
    return data as { workspace: Workspace; version: string | null; storageMode: "blob" | "local-dev" };
  }, []);

  const loadWorkspace = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setError("");
    try {
      const data = await requestWorkspace();
      if (!data) {
        setWorkspace(null);
        return "A sessão expirou. Entre novamente.";
      }
      acceptSnapshot(data);
      return null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível carregar os dados.";
      setError(message);
      return message;
    } finally {
      setLoading(false);
    }
  }, [acceptSnapshot, requestWorkspace]);

  useEffect(() => {
    let active = true;
    const refreshClock = () => {
      setToday(todayInSaoPaulo());
      setNowMs(Date.now());
    };
    const todayTimeout = window.setTimeout(refreshClock, 0);
    initialWorkspaceRequestRef.current ??= requestWorkspace();
    initialWorkspaceRequestRef.current
      .then((data) => {
        if (active && data) acceptSnapshot(data);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar os dados.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    const interval = window.setInterval(refreshClock, 60_000);
    return () => {
      active = false;
      window.clearTimeout(todayTimeout);
      window.clearInterval(interval);
    };
  }, [acceptSnapshot, requestWorkspace]);

  useLayoutEffect(() => {
    stateRef.current = workspace;
  }, [workspace]);

  const activeGroups = useMemo(() => workspace?.groups
    .filter((group) => !group.deletedAt)
    .sort((left, right) => left.order - right.order) ?? [], [workspace]);
  const activeTasks = useMemo(() => workspace?.tasks.filter((task) => !task.deletedAt) ?? [], [workspace]);
  const buckets = useMemo(() => currentBuckets(today), [today]);
  const calendarMonth = calendarMonthOverride ?? today.slice(0, 7);
  const calendarDates = datesInMonth(calendarMonth);
  const selectedTask = activeTasks.find((task) => task.id === selectedTaskId) ?? null;
  const notebookPages = workspace?.pages.filter((page) => !page.deletedAt) ?? [];
  const selectedPage = notebookPages.find((page) => page.id === selectedPageId) ??
    notebookPages.find((page) => page.id === NOTEBOOK_ROOT_ID) ?? null;
  const selectedGroup = activeGroups.find((group) => group.id === groupId) ?? null;
  const groupTasks = (task: Task) => groupId === null || task.groupId === groupId;
  const taskGroup = (task: Task) => activeGroups.find((group) => group.id === task.groupId);

  const updateWorkspace = (updater: (state: Workspace) => Workspace) => {
    dirtyRef.current = true;
    setSyncStatus("pending");
    setWorkspace((current) => current ? updater(current) : current);
  };

  const syncWorkspace = async () => {
    const snapshot = stateRef.current;
    if (!snapshot || savingRef.current || !canStartWorkspaceSync(syncStatus)) return;
    const hasLocalChanges = dirtyRef.current;
    savingRef.current = true;
    setSyncStatus("syncing");
    setError("");
    try {
      const result = await syncWorkspaceRequest({
        workspace: snapshot,
        version: versionRef.current,
        hasLocalChanges,
      });
      if (result.status === "unauthorized") {
        setWorkspace(null);
        dirtyRef.current = false;
        setError("A sessão expirou. Entre novamente.");
        setSyncStatus("error");
        return;
      }
      if (result.status === "conflict") {
        versionRef.current = result.version;
        setStorageMode(result.storageMode);
        setWorkspace((current) => current ? mergeWorkspaceSnapshots(current, result.workspace) : current);
        setSyncStatus("conflict");
        setError("A versão remota mudou. Suas alterações foram mantidas e mescladas; toque em SYNC novamente para gravar a mesclagem.");
        return;
      }
      versionRef.current = result.version;
      setStorageMode(result.storageMode);
      if (result.status === "pulled") {
        setWorkspace((current) => current ? mergeWorkspaceSnapshots(current, result.workspace) : current);
        setSyncStatus(dirtyRef.current ? "pending" : "saved");
        return;
      }
      dirtyRef.current = stateRef.current !== snapshot;
      setSyncStatus(dirtyRef.current ? "pending" : "saved");
    } catch (caught) {
      setSyncStatus("error");
      setError(caught instanceof Error ? caught.message : "Falha na sincronização.");
    } finally {
      savingRef.current = false;
    }
  };

  const updateTask = (id: string, patch: Partial<Task>) => {
    const nextGroupId = patch.groupId;
    updateWorkspace((state) => ({
      ...state,
      tasks: state.tasks.map((task) => task.id === id ? { ...task, ...patch, updatedAt: now() } : task),
      notes: nextGroupId !== undefined
        ? state.notes.map((note) => note.taskId === id ? { ...note, groupId: nextGroupId, updatedAt: now() } : note)
        : state.notes,
    }));
  };

  const updateGroup = (id: string, patch: Partial<TaskGroup>) => {
    updateWorkspace((state) => ({
      ...state,
      groups: state.groups.map((group) => group.id === id ? { ...group, ...patch, updatedAt: now() } : group),
    }));
  };

  const updateNote = (id: string, patch: Partial<Note>) => {
    updateWorkspace((state) => ({
      ...state,
      notes: state.notes.map((note) => note.id === id ? { ...note, ...patch, updatedAt: now() } : note),
    }));
  };

  const login = async (password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) return result.error ?? "Não foi possível entrar.";
      return await loadWorkspace();
    } catch {
      return "Não foi possível conectar ao servidor.";
    }
  };

  const logout = async () => {
    await fetch("/api/auth/login", { method: "DELETE" });
    setWorkspace(null);
    dirtyRef.current = false;
    setSelectedTaskId(null);
  };

  const visibleTasks = useMemo(() => {
    const list = activeTasks.filter((task) => {
      if (task.archived || task.completed) return false;
      const match = task.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
      if (!match) return false;
      if (groupId !== null && task.groupId !== groupId) return false;
      return mode !== "today" || bucketForDate(task.dueDate, today) === "today";
    });
    return list.sort((a, b) => {
      if (a.dueDate !== b.dueDate) return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
      if (a.priority !== b.priority) return ["high", "normal", "low"].indexOf(a.priority) - ["high", "normal", "low"].indexOf(b.priority);
      return a.title.localeCompare(b.title, "pt-BR");
    });
  }, [activeTasks, groupId, mode, search, today]);

  const calendarTasks = activeTasks
    .filter((task) => task.dueDate?.startsWith(calendarMonth))
    .filter((task) => groupId === null || task.groupId === groupId)
    .filter((task) => task.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))
    .sort((left, right) => left.dueDate!.localeCompare(right.dueDate!) || left.title.localeCompare(right.title, "pt-BR"));
  const calendarTasksByDay = new Map<string, Task[]>();
  for (const task of calendarTasks) {
    const dueDate = task.dueDate!;
    const tasks = calendarTasksByDay.get(dueDate) ?? [];
    tasks.push(task);
    calendarTasksByDay.set(dueDate, tasks);
  }
  const displayedCalendarTasks = calendarSelectedDay
    ? calendarTasksByDay.get(calendarSelectedDay) ?? []
    : calendarTasks;

  const archivedTasks = activeTasks.filter((task) => (task.archived || task.completed) && groupTasks(task));
  const trashedTasks = liveItems(workspace?.tasks.filter((task) => task.deletedAt) ?? [], nowMs);
  const trashedGroups = liveItems(workspace?.groups.filter((group) => group.deletedAt) ?? [], nowMs);
  const trashedNotes = liveItems(workspace?.notes.filter((note) => note.deletedAt) ?? [], nowMs);
  const taskNotes = selectedTask ? workspace?.notes.filter((note) => !note.deletedAt && note.taskId === selectedTask.id) ?? [] : [];

  const notebookChildren = (parentId: string) => notebookPages
    .filter((page) => page.parentId === parentId)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const notebookDescendants = (pageId: string) => {
    const descendants = new Set<string>();
    const pending = [pageId];
    while (pending.length) {
      const currentId = pending.pop()!;
      for (const child of notebookChildren(currentId)) {
        if (!descendants.has(child.id)) {
          descendants.add(child.id);
          pending.push(child.id);
        }
      }
    }
    return descendants;
  };
  const notebookBlocks = selectedPage ? parseNotebookContent(selectedPage.body) : [];
  const linkedNotebookPageIds = new Set(notebookBlocks
    .filter((block) => block.type === "page" && notebookPages.some((page) => page.id === block.pageId && page.parentId === selectedPage?.id))
    .map((block) => block.type === "page" ? block.pageId : ""));
  const unlinkedNotebookChildren = selectedPage
    ? notebookChildren(selectedPage.id).filter((page) => !linkedNotebookPageIds.has(page.id))
    : [];
  const notebookPath = (page: NotebookPage) => {
    const ancestors = [page];
    let parentId = page.parentId;
    while (parentId) {
      const parent = notebookPages.find((item) => item.id === parentId);
      if (!parent) break;
      ancestors.unshift(parent);
      parentId = parent.parentId;
    }
    return ancestors;
  };

  const updateNotebookPage = (id: string, patch: Partial<NotebookPage>) => {
    updateWorkspace((state) => ({
      ...state,
      pages: state.pages.map((page) => page.id === id ? { ...page, ...patch, updatedAt: now() } : page),
    }));
  };

  const selectNotebookPage = (id: string) => {
    setSelectedPageId(id);
    setIsEditingNotebookPage(false);
    setNotebookBlockMenuIndex(null);
  };

  const focusNotebookBlock = (index: number, cursor?: number) => {
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLTextAreaElement>(`[data-notebook-block-index="${index}"]`);
      input?.focus();
      if (cursor !== undefined) input?.setSelectionRange(cursor, cursor);
    });
  };

  const saveNotebookBlocks = (blocks: NotebookContentBlock[]) => {
    if (!selectedPage) return;
    updateNotebookPage(selectedPage.id, { body: serializeNotebookContent(blocks) });
  };

  const addNotebookTextBlock = (afterIndex: number) => {
    if (!selectedPage) return;
    const blocks = parseNotebookContent(selectedPage.body);
    blocks.splice(afterIndex + 1, 0, { type: "text", text: "" });
    saveNotebookBlocks(blocks);
    setNotebookBlockMenuIndex(null);
    focusNotebookBlock(afterIndex + 1);
  };

  const addNotebookPage = (index: number, replaceCurrent: boolean) => {
    if (!selectedPage) return;
    const stamp = now();
    const page: NotebookPage = {
      id: uid(),
      name: "Nova página",
      icon: "📄",
      parentId: selectedPage.id,
      body: "",
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
    const blocks = parseNotebookContent(selectedPage.body);
    const body = serializeNotebookContent(insertNotebookPageBlock(blocks, index, page.id, replaceCurrent));
    updateWorkspace((current) => ({
      ...current,
      pages: [
        ...current.pages.map((item) => item.id === selectedPage.id ? { ...item, body, updatedAt: stamp } : item),
        page,
      ],
    }));
    setSelectedPageId(page.id);
    setIsEditingNotebookPage(false);
    setNotebookBlockMenuIndex(null);
    focusNotebookBlock(0);
  };

  const updateNotebookBlock = (index: number, text: string) => {
    const blocks = parseNotebookContent(selectedPage?.body ?? "");
    const newLines = text.split("\n").map((line) => ({ type: "text" as const, text: line }));
    blocks.splice(index, 1, ...newLines);
    saveNotebookBlocks(blocks);
    if (newLines.length > 1) focusNotebookBlock(index + newLines.length - 1, newLines.at(-1)?.text.length);
  };

  const handleNotebookBlockKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, index: number, text: string) => {
    const input = event.currentTarget;
    const blocks = parseNotebookContent(selectedPage?.body ?? "");
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (matchesNotebookPageCommand(text)) {
        addNotebookPage(index, true);
        return;
      }
      saveNotebookBlocks(splitNotebookTextBlock(blocks, index, input.selectionStart, input.selectionEnd));
      focusNotebookBlock(index + 1);
      return;
    }

    if (event.key === "Backspace" && input.selectionStart === 0 && input.selectionEnd === 0 && text === "" && index > 0) {
      event.preventDefault();
      blocks.splice(index, 1);
      saveNotebookBlocks(blocks);
      const previousTextIndex = blocks.slice(0, index).map((block) => block.type === "text").lastIndexOf(true);
      if (previousTextIndex >= 0) focusNotebookBlock(previousTextIndex);
      return;
    }

    if (event.key === "ArrowUp" && input.selectionStart === 0 && input.selectionEnd === 0) {
      const previousTextIndex = blocks.slice(0, index).map((block) => block.type === "text").lastIndexOf(true);
      if (previousTextIndex >= 0) {
        event.preventDefault();
        focusNotebookBlock(previousTextIndex);
      }
      return;
    }

    if (event.key === "ArrowDown" && input.selectionStart === text.length && input.selectionEnd === text.length) {
      const nextTextIndex = blocks.findIndex((block, blockIndex) => blockIndex > index && block.type === "text");
      if (nextTextIndex >= 0) {
        event.preventDefault();
        focusNotebookBlock(nextTextIndex);
      }
    }
  };

  const deleteNotebookPage = () => {
    if (!selectedPage || selectedPage.id === NOTEBOOK_ROOT_ID) return;
    const descendants = notebookDescendants(selectedPage.id);
    if (!window.confirm(`Excluir “${selectedPage.name}” e ${descendants.size} ${descendants.size === 1 ? "subpágina" : "subpáginas"}?`)) return;
    const deletedAt = now();
    updateWorkspace((current) => ({
      ...current,
      pages: current.pages.map((page) => {
        if (page.id === selectedPage.id || descendants.has(page.id)) {
          return { ...page, deletedAt, updatedAt: deletedAt };
        }
        if (page.id === selectedPage.parentId) {
          const blocks = parseNotebookContent(page.body).filter((block) => block.type !== "page" || block.pageId !== selectedPage.id);
          return { ...page, body: serializeNotebookContent(blocks), updatedAt: deletedAt };
        }
        return page;
      }),
    }));
    setSelectedPageId(selectedPage.parentId ?? NOTEBOOK_ROOT_ID);
    setIsEditingNotebookPage(false);
  };

  const renderNotebookTree = (page: NotebookPage, depth = 0): React.ReactNode => (
    <div className="notebook-tree-branch" key={page.id}>
      <button
        aria-current={selectedPage?.id === page.id ? "page" : undefined}
        className={`notebook-tree-page${selectedPage?.id === page.id ? " selected" : ""}`}
        onClick={() => selectNotebookPage(page.id)}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        type="button"
      >
        <span aria-hidden="true">{page.icon}</span>
        <span>{page.id === NOTEBOOK_ROOT_ID ? "/" : page.name}</span>
      </button>
      {notebookChildren(page.id).map((child) => renderNotebookTree(child, depth + 1))}
    </div>
  );

  const addTask = () => {
    const targetGroup = groupId ?? activeGroups.find((group) => !group.archived)?.id;
    if (!targetGroup) {
      setError("Crie um grupo antes de adicionar tarefas.");
      return;
    }
    const task = newTask(targetGroup);
    updateWorkspace((current) => ({ ...current, tasks: [...current.tasks, task] }));
    setSelectedTaskId(task.id);
    setMobileDetail(true);
  };

  const addGroup = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;
    const group = newGroup(name, activeGroups.length);
    updateWorkspace((current) => ({ ...current, groups: [...current.groups, group] }));
    setGroupId(group.id);
    setMode("tasks");
    setNewGroupName("");
    setShowNewGroup(false);
  };

  const deleteTask = (task: Task) => {
    const stamp = now();
    updateWorkspace((state) => ({
      ...state,
      tasks: state.tasks.map((item) => item.id === task.id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item),
      notes: state.notes.map((note) => note.taskId === task.id ? { ...note, deletedAt: stamp, updatedAt: stamp } : note),
    }));
    setSelectedTaskId(null);
    setMobileDetail(false);
  };

  const deleteGroup = (group: TaskGroup) => {
    if (!window.confirm(`Mover “${group.name}” e suas tarefas para a lixeira?`)) return;
    const stamp = now();
    updateWorkspace((state) => ({
      ...state,
      groups: state.groups.map((item) => item.id === group.id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item),
      tasks: state.tasks.map((task) => task.groupId === group.id ? { ...task, deletedAt: stamp, updatedAt: stamp } : task),
      notes: state.notes.map((note) => note.groupId === group.id ? { ...note, deletedAt: stamp, updatedAt: stamp } : note),
    }));
    setGroupId(null);
    setSelectedTaskId(null);
  };

  const restoreTask = (task: Task) => {
    const stamp = now();
    updateWorkspace((state) => ({
      ...state,
      tasks: state.tasks.map((item) => item.id === task.id ? { ...item, deletedAt: null, updatedAt: stamp } : item),
      notes: state.notes.map((note) => note.taskId === task.id ? { ...note, deletedAt: null, updatedAt: stamp } : note),
    }));
  };

  const restoreGroup = (group: TaskGroup) => {
    const stamp = now();
    updateWorkspace((state) => ({
      ...state,
      groups: state.groups.map((item) => item.id === group.id ? { ...item, deletedAt: null, updatedAt: stamp } : item),
      tasks: state.tasks.map((task) => task.groupId === group.id ? { ...task, deletedAt: null, updatedAt: stamp } : task),
      notes: state.notes.map((note) => note.groupId === group.id ? { ...note, deletedAt: null, updatedAt: stamp } : note),
    }));
  };

  const createTaskNote = () => {
    if (!selectedTask || !workspace) return;
    const stamp = now();
    const note: Note = {
      id: uid(), title: "Nova nota", body: "", groupId: selectedTask.groupId, taskId: selectedTask.id,
      createdAt: stamp, updatedAt: stamp, deletedAt: null,
    };
    updateWorkspace((current) => ({ ...current, notes: [...current.notes, note] }));
  };

  if (loading && !workspace) {
    return <main className="loading-screen"><div className="brand-mark">m</div><p>Preparando seu espaço…</p></main>;
  }
  if (!workspace) return <LoginScreen onLogin={login} />;

  const headerTitle = mode === "today"
    ? "Hoje"
    : mode === "tasks"
      ? "Tarefas"
      : mode === "calendar"
        ? "Calendário"
        : mode === "notebook"
          ? "Caderno"
          : mode === "trash"
            ? "Lixeira"
            : mode === "archive"
              ? "Arquivadas"
              : "Configurações";

  const reorderGroup = (group: TaskGroup, direction: -1 | 1) => {
    const sorted = [...activeGroups];
    const index = sorted.findIndex((item) => item.id === group.id);
    const neighbor = sorted[index + direction];
    if (!neighbor) return;
    updateWorkspace((state) => ({
      ...state,
      groups: state.groups.map((item) => {
        if (item.id === group.id) return { ...item, order: neighbor.order, updatedAt: now() };
        if (item.id === neighbor.id) return { ...item, order: group.order, updatedAt: now() };
        return item;
      }),
    }));
  };

  const renderNotebookBlockMenu = (index: number) => (
    <div className="notebook-block-menu" role="menu">
      <button onClick={() => addNotebookTextBlock(index)} role="menuitem" type="button">
        <span>Texto</span><small>Nova linha de texto</small>
      </button>
      <button onClick={() => addNotebookPage(index, false)} role="menuitem" type="button">
        <span>Página</span><small>Cria uma subpágina aqui</small>
      </button>
    </div>
  );

  const renderNotebookPageBlock = (page: NotebookPage, index: number, editable: boolean) => (
    <div className={`notebook-block-row notebook-page-block-row${editable ? " editable" : ""}`} key={`page-${page.id}-${index}`}>
      {editable && (
        <>
          <button
            aria-expanded={notebookBlockMenuIndex === index}
            aria-label={`Adicionar bloco após ${page.name}`}
            className="notebook-block-add"
            onClick={() => setNotebookBlockMenuIndex(notebookBlockMenuIndex === index ? null : index)}
            type="button"
          >
            <Plus size={16} />
          </button>
          {notebookBlockMenuIndex === index && renderNotebookBlockMenu(index)}
        </>
      )}
      <button className="notebook-page-block" onClick={() => selectNotebookPage(page.id)} type="button">
        <span aria-hidden="true">{page.icon}</span>
        <span>{page.name}</span>
        <ChevronRight aria-hidden="true" size={15} />
      </button>
    </div>
  );

  const selectedNav = (view: ViewMode) => {
    if (view === "settings") {
      const stored = document.documentElement.dataset.themePreference;
      if (stored === "system" || stored === "light" || stored === "dark") setThemePreference(stored);
    }
    setMode(view);
    setSelectedTaskId(null);
    setMobileDetail(false);
    setSidebarOpen(false);
  };

  return (
    <main className={`app-shell ${mobileDetail ? "show-detail" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark small">m</div>
          <span>MaxHub</span>
          <button className="icon-button sidebar-close" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <button className={`nav-item ${mode === "today" ? "active" : ""}`} onClick={() => { setGroupId(null); selectedNav("today"); }}>
          <CheckCircle2 size={17} /> Hoje <span className="nav-count">{activeTasks.filter((task) => !task.archived && !task.completed && bucketForDate(task.dueDate, today) === "today").length}</span>
        </button>
        <div className="sidebar-section">
          <div className="sidebar-heading"><span>PLANEJAMENTO</span></div>
          <button className={`nav-item ${mode === "tasks" && groupId === null ? "active" : ""}`} onClick={() => { setGroupId(null); selectedNav("tasks"); }}><ListTodo size={17} /> Tarefas</button>
          <button className={`nav-item ${mode === "calendar" ? "active" : ""}`} onClick={() => selectedNav("calendar")}><CalendarDays size={17} /> Calendário</button>
          <button className={`nav-item ${mode === "notebook" ? "active" : ""}`} onClick={() => selectedNav("notebook")}><BookOpen size={17} /> Caderno</button>
        </div>
        <div className="sidebar-section group-section">
          <div className="sidebar-heading">
            <span>GRUPOS</span>
            <button className="icon-button tiny" aria-label="Adicionar grupo" onClick={() => setShowNewGroup(!showNewGroup)}><Plus size={16} /></button>
          </div>
          <button className={`nav-item group-nav ${groupId === null && mode === "tasks" ? "active" : ""}`} onClick={() => { setGroupId(null); selectedNav("tasks"); }}>
            <span className="color-dot" style={{ backgroundColor: "#47b8ec" }} /> Geral
            <span className="nav-count">{activeTasks.filter((task) => !task.archived && !task.completed).length}</span>
          </button>
          {activeGroups.filter((group) => !group.archived).map((group) => (
            <div className="group-row" key={group.id}>
              <button
                className={`nav-item group-nav ${groupId === group.id ? "active" : ""}`}
                onClick={() => { setGroupId(group.id); selectedNav("tasks"); }}
              >
                <span className="color-dot" style={{ backgroundColor: group.color }} /> {group.name}
                <span className="nav-count">{activeTasks.filter((task) => task.groupId === group.id && !task.archived && !task.completed).length}</span>
              </button>
              <div className="group-actions">
                <button aria-label={`Subir ${group.name}`} title="Mover para cima" onClick={() => reorderGroup(group, -1)}><ArrowUp size={13} /></button>
                <button aria-label={`Descer ${group.name}`} title="Mover para baixo" onClick={() => reorderGroup(group, 1)}><ArrowDown size={13} /></button>
                <button aria-label={`Renomear ${group.name}`} title="Renomear" onClick={() => {
                  const name = window.prompt("Nome do grupo", group.name)?.trim();
                  if (name) updateGroup(group.id, { name });
                }}><Settings2 size={13} /></button>
                <button aria-label={`Arquivar ${group.name}`} title="Arquivar" onClick={() => updateGroup(group.id, { archived: true })}><Archive size={13} /></button>
                <button aria-label={`Excluir ${group.name}`} title="Mover para a lixeira" onClick={() => deleteGroup(group)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          {activeGroups.filter((group) => group.archived && !group.deletedAt).map((group) => (
            <button className={`nav-item group-nav archived-group ${groupId === group.id ? "active" : ""}`} key={group.id} onClick={() => { setGroupId(group.id); selectedNav("tasks"); }}>
              <Archive size={15} /> {group.name} <span className="nav-count">arquivado</span>
            </button>
          ))}
          {showNewGroup && (
            <form className="new-inline-form" onSubmit={addGroup}>
              <input autoFocus aria-label="Nome do grupo" onChange={(event) => setNewGroupName(event.target.value)} placeholder="Nome do grupo" value={newGroupName} />
              <button aria-label="Criar grupo" type="submit"><Check size={15} /></button>
            </form>
          )}
        </div>
        <div className="sidebar-spacer" />
        <button className={`nav-item ${mode === "archive" ? "active" : ""}`} onClick={() => selectedNav("archive")}><Archive size={17} /> Arquivadas</button>
        <button className={`nav-item ${mode === "trash" ? "active" : ""}`} onClick={() => selectedNav("trash")}><Trash2 size={17} /> Lixeira <span className="nav-count">{trashedTasks.length + trashedGroups.length + trashedNotes.length}</span></button>
        <button className={`nav-item ${mode === "settings" ? "active" : ""}`} onClick={() => selectedNav("settings")}><Settings size={17} /> Configurações</button>
        <div className="sidebar-footer">
          <button className="icon-button ml-auto" aria-label="Sair" title="Sair" onClick={() => void logout()}><LogOut size={16} /></button>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}

      <section className={`main-column ${mobileDetail ? "hide-mobile" : ""}`}>
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>
          <div className="crumb"><span>{groupId ? selectedGroup?.name ?? "Grupo" : "Seu espaço"}</span><span className="crumb-slash">/</span><strong>{headerTitle}</strong></div>
          <div className="topbar-actions">
            <div className={`sync-control ${syncStatus}`}>
              <button className="primary-button sync-button" disabled={syncStatus === "syncing"} onClick={() => void syncWorkspace()}>
                <RefreshCw size={14} className={syncStatus === "syncing" ? "sync-spinning" : ""} />
                SYNC
              </button>
              <span role="status" aria-live="polite">{syncStatus === "saved" ? storageMode === "local-dev" ? "Teste local" : "Sincronizado" :
                syncStatus === "pending" ? "Pendente" :
                  syncStatus === "syncing" ? "Enviando…" :
                    syncStatus === "conflict" ? "Conflito" : "Erro"}</span>
            </div>
            <label className="search-box">
              <Search size={16} />
              <input aria-label="Buscar tarefa" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" value={search} />
              <kbd>⌘ K</kbd>
            </label>
            <div className="avatar">M</div>
          </div>
        </header>
        {error && <div className="error-banner"><span>{error}</span><button aria-label="Fechar aviso" onClick={() => setError("")}><X size={16} /></button></div>}
        {storageMode === "local-dev" && (
          <div className="dev-storage-banner" role="status">
            Modo de teste local: os dados ficam neste worktree e não são sincronizados com a Vercel.
          </div>
        )}
        <div className={`view-content${mode === "notebook" ? " notebook-view-content" : ""}`}>
          {mode !== "notebook" && (
            <div className="page-heading">
              <div>
                <p className="eyebrow">{mode === "settings" ? "PREFERÊNCIAS" : new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`))}</p>
                <h1>{mode === "tasks" && groupId ? selectedGroup?.name : headerTitle}</h1>
                <p className="page-description">
                  {mode === "settings" ? "Personalize a aparência do seu espaço." :
                    mode === "today" ? "Tarefas de hoje e sem prazo." :
                    mode === "tasks" ? "Prazos de todas as tarefas organizados por período." :
                      mode === "calendar" ? "Consulte os prazos no calendário mensal." :
                        mode === "trash" ? "Itens excluídos ficam disponíveis por 30 dias." :
                          "Tarefas e grupos guardados para consultar depois."}
                </p>
              </div>
              {(mode === "today" || mode === "tasks") && <button className="primary-button" onClick={addTask}><Plus size={17} /> Nova tarefa</button>}
            </div>
          )}

          {mode === "settings" && (
            <section className="settings-panel" aria-labelledby="appearance-heading">
              <div className="settings-section-heading">
                <div>
                  <h2 id="appearance-heading">Aparência</h2>
                  <p>Escolha como o MaxHub deve aparecer neste dispositivo.</p>
                </div>
                <Settings size={19} aria-hidden="true" />
              </div>
              <fieldset className="theme-options">
                <legend>Tema</legend>
                <p id="theme-description">Sistema acompanha a preferência de aparência do seu dispositivo.</p>
                <div className="theme-option-list">
                  <label className={`theme-option${themePreference === "system" ? " selected" : ""}`}>
                    <input checked={themePreference === "system"} name="theme" onChange={() => chooseTheme("system")} type="radio" value="system" />
                    <Monitor size={18} aria-hidden="true" />
                    <span>Sistema</span>
                  </label>
                  <label className={`theme-option${themePreference === "light" ? " selected" : ""}`}>
                    <input checked={themePreference === "light"} name="theme" onChange={() => chooseTheme("light")} type="radio" value="light" />
                    <Sun size={18} aria-hidden="true" />
                    <span>Claro</span>
                  </label>
                  <label className={`theme-option${themePreference === "dark" ? " selected" : ""}`}>
                    <input checked={themePreference === "dark"} name="theme" onChange={() => chooseTheme("dark")} type="radio" value="dark" />
                    <Moon size={18} aria-hidden="true" />
                    <span>Escuro</span>
                  </label>
                </div>
              </fieldset>
            </section>
          )}

          {mode === "today" && (
            <>
              <div className="task-list">
                {visibleTasks.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-illustration"><ListTodo size={25} /></div>
                    <h2>{search ? "Nenhuma tarefa encontrada" : "Tudo tranquilo por aqui"}</h2>
                    <p>{search ? "Tente outra busca." : "Adicione uma tarefa e deixe o resto mais leve."}</p>
                    {!search && <button className="text-button" onClick={addTask}><Plus size={15} /> Criar primeira tarefa</button>}
                  </div>
                ) : visibleTasks.map((task) => (
                  <TaskRow
                    group={taskGroup(task)}
                    key={task.id}
                    onClick={() => { setSelectedTaskId(task.id); setMobileDetail(true); }}
                    onComplete={() => updateTask(task.id, { completed: true })}
                    selected={selectedTaskId === task.id}
                    task={task}
                    today={today}
                  />
                ))}
              </div>
              <button className="add-task-row" onClick={addTask}><Plus size={16} /> Adicionar tarefa</button>
            </>
          )}

          {mode === "tasks" && (
            <div className="calendar-lanes">
              {buckets.filter((item) => item.id !== "overdue").map((item) => {
                const tasks = activeTasks.filter((task) =>
                  !task.archived &&
                  !task.completed &&
                  groupTasks(task) &&
                  task.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) &&
                  bucketForDate(task.dueDate, today) === item.id
                );
                return (
                  <section className="calendar-lane" key={item.id}>
                    <div className="calendar-lane-heading">
                      <div><h2>{item.label}</h2><span>{item.date ? formatDate(item.date) : "Próximas semanas"}</span></div>
                      <span className="lane-count">{tasks.length}</span>
                    </div>
                    {tasks.length ? tasks.map((task) => <TaskRow group={taskGroup(task)} key={task.id} onClick={() => { setSelectedTaskId(task.id); setMobileDetail(true); }} onComplete={() => updateTask(task.id, { completed: true })} selected={selectedTaskId === task.id} task={task} today={today} />) : <p className="lane-empty">Sem prazos</p>}
                  </section>
                );
              })}
              {activeTasks.some((task) =>
                !task.archived &&
                !task.completed &&
                groupTasks(task) &&
                task.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) &&
                bucketForDate(task.dueDate, today) === "overdue"
              ) && (
                <section className="calendar-lane overdue-lane">
                  <div className="calendar-lane-heading"><div><h2>Atrasadas</h2><span>Continuam no grupo original</span></div></div>
                  {activeTasks.filter((task) =>
                    !task.archived &&
                    !task.completed &&
                    groupTasks(task) &&
                    task.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) &&
                    bucketForDate(task.dueDate, today) === "overdue"
                  ).map((task) => <TaskRow group={taskGroup(task)} key={task.id} onClick={() => { setSelectedTaskId(task.id); setMobileDetail(true); }} onComplete={() => updateTask(task.id, { completed: true })} selected={selectedTaskId === task.id} task={task} today={today} />)}
                </section>
              )}
            </div>
          )}

          {mode === "calendar" && (
            <div className="calendar-view">
              <section className="calendar-panel" aria-label={`Calendário de ${monthLabel(calendarMonth)}`}>
                <div className="calendar-toolbar">
                  <button className="icon-button" aria-label="Mês anterior" onClick={() => { setCalendarMonthOverride(monthWithOffset(calendarMonth, -1)); setCalendarSelectedDay(null); }}>
                    <ChevronLeft size={18} />
                  </button>
                  <h2>{monthLabel(calendarMonth)}</h2>
                  <button className="icon-button" aria-label="Próximo mês" onClick={() => { setCalendarMonthOverride(monthWithOffset(calendarMonth, 1)); setCalendarSelectedDay(null); }}>
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="calendar-weekdays" aria-hidden="true">
                  {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="calendar-grid">
                  {calendarDates.map((date, index) => {
                    if (!date) return <div aria-hidden="true" className="calendar-day-empty" key={`empty-${index}`} />;
                    const tasks = calendarTasksByDay.get(date) ?? [];
                    const isToday = date === today;
                    const isSelected = date === calendarSelectedDay;
                    return (
                      <button
                        aria-label={`${formatDate(date)}${tasks.length ? `, ${tasks.length} ${tasks.length === 1 ? "tarefa" : "tarefas"}` : ""}`}
                        aria-pressed={isSelected}
                        className={`calendar-day${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}${tasks.length ? " has-tasks" : ""}`}
                        key={date}
                        onClick={() => setCalendarSelectedDay(isSelected ? null : date)}
                        type="button"
                      >
                        <span className="calendar-day-number">{Number(date.slice(-2))}</span>
                        {tasks.length > 0 && (
                          <span className="calendar-day-markers">
                            <span className="calendar-day-dots" aria-hidden="true">
                              {tasks.slice(0, 3).map((task) => <span key={task.id} style={{ backgroundColor: task.color }} />)}
                            </span>
                            <span className="calendar-day-count">{tasks.length}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="calendar-events">
                <div className="calendar-events-heading">
                  <h2>{calendarSelectedDay ? `Prazos em ${formatDate(calendarSelectedDay)}` : `Prazos de ${monthLabel(calendarMonth)}`}</h2>
                  {calendarSelectedDay && <button className="text-button" onClick={() => setCalendarSelectedDay(null)}>Ver mês</button>}
                </div>
                {displayedCalendarTasks.length ? (
                  <div className="task-list">
                    {displayedCalendarTasks.map((task) => (
                      <TaskRow
                        archived={task.archived}
                        completed={task.completed}
                        group={taskGroup(task)}
                        key={task.id}
                        onClick={() => { setSelectedTaskId(task.id); setMobileDetail(true); }}
                        onComplete={() => updateTask(task.id, task.archived || task.completed ? { archived: false, completed: false } : { completed: true })}
                        selected={selectedTaskId === task.id}
                        task={task}
                        today={today}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="calendar-events-empty">{calendarSelectedDay ? "Nenhum prazo neste dia." : "Nenhum prazo neste mês."}</div>
                )}
              </section>
            </div>
          )}

          {mode === "notebook" && selectedPage && (
            <div className="notebook-workspace">
              <aside className="notebook-tree" aria-label="Páginas do Caderno">
                <div className="notebook-tree-heading">
                  <span>PÁGINAS</span>
                </div>
                {notebookPages.find((page) => page.id === NOTEBOOK_ROOT_ID) && renderNotebookTree(notebookPages.find((page) => page.id === NOTEBOOK_ROOT_ID)!)}
              </aside>
              <article className={`notebook-page${isEditingNotebookPage ? " is-editing" : ""}`}>
                <nav className="notebook-breadcrumbs" aria-label="Caminho da página">
                  {notebookPath(selectedPage).map((page, index) => (
                    <span key={page.id}>
                      {index > 0 && <span className="notebook-breadcrumb-separator">/</span>}
                      <button onClick={() => selectNotebookPage(page.id)} type="button">
                        {page.id === NOTEBOOK_ROOT_ID ? "/" : page.name}
                      </button>
                    </span>
                  ))}
                </nav>
                {isEditingNotebookPage ? (
                  <>
                    <div className="notebook-edit-heading">
                      <span>Editar propriedades</span>
                      <button className="secondary-button" onClick={() => setIsEditingNotebookPage(false)} type="button">Concluir</button>
                    </div>
                    <div className="notebook-page-fields">
                      <label className="notebook-icon-field">
                        <span>Ícone</span>
                        <input
                          aria-label="Ícone da página"
                          maxLength={32}
                          onChange={(event) => updateNotebookPage(selectedPage.id, { icon: event.target.value || "📄" })}
                          value={selectedPage.icon}
                        />
                      </label>
                      <label className="notebook-name-field">
                        <span>Nome</span>
                        <input
                          aria-label="Nome da página"
                          disabled={selectedPage.id === NOTEBOOK_ROOT_ID}
                          onChange={(event) => updateNotebookPage(selectedPage.id, { name: event.target.value || "Sem título" })}
                          value={selectedPage.id === NOTEBOOK_ROOT_ID ? "/" : selectedPage.name}
                        />
                      </label>
                      <label className="notebook-parent-field">
                        <span>Parente</span>
                        <select
                          aria-label="Página parente"
                          disabled={selectedPage.id === NOTEBOOK_ROOT_ID}
                          onChange={(event) => updateNotebookPage(selectedPage.id, { parentId: event.target.value })}
                          value={selectedPage.parentId ?? NOTEBOOK_ROOT_ID}
                        >
                          <option value={NOTEBOOK_ROOT_ID}>/</option>
                          {notebookPages
                            .filter((page) => page.id !== selectedPage.id && !notebookDescendants(selectedPage.id).has(page.id))
                            .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
                            .map((page) => (
                              <option key={page.id} value={page.id}>{notebookPath(page).map((item) => item.name).join(" / ")}</option>
                            ))}
                        </select>
                      </label>
                    </div>
                  </>
                ) : (
                  <header className="notebook-page-view-heading">
                    <div className="notebook-page-title">
                      <span aria-hidden="true">{selectedPage.icon}</span>
                      <h2>{selectedPage.name}</h2>
                    </div>
                    <div className="notebook-page-actions">
                      {selectedPage.id !== NOTEBOOK_ROOT_ID && (
                        <button className="icon-button notebook-delete-page" aria-label={`Excluir ${selectedPage.name} e suas subpáginas`} onClick={deleteNotebookPage} type="button">
                          <Trash2 size={16} />
                        </button>
                      )}
                      <button className="secondary-button notebook-edit-button" onClick={() => setIsEditingNotebookPage(true)} type="button">
                        <Pencil size={14} /> Editar propriedades
                      </button>
                    </div>
                  </header>
                )}
                <div className="notebook-block-editor" aria-label="Blocos de conteúdo da página">
                  {notebookBlocks.map((block, index) => {
                    if (block.type === "page") {
                      const page = notebookPages.find((item) => item.id === block.pageId && item.parentId === selectedPage.id);
                      return page ? renderNotebookPageBlock(page, index, true) : null;
                    }
                    const showPageCommand = matchesNotebookPageCommand(block.text);
                    return (
                      <div className="notebook-block-row" key={`text-${index}`}>
                        <button
                          aria-expanded={notebookBlockMenuIndex === index}
                          aria-label={`Adicionar bloco após linha ${index + 1}`}
                          className="notebook-block-add"
                          onClick={() => setNotebookBlockMenuIndex(notebookBlockMenuIndex === index ? null : index)}
                          type="button"
                        >
                          <Plus size={16} />
                        </button>
                        {notebookBlockMenuIndex === index && renderNotebookBlockMenu(index)}
                        <textarea
                          aria-label={`Linha ${index + 1}`}
                          className="notebook-block-input"
                          data-notebook-block-index={index}
                          onChange={(event) => updateNotebookBlock(index, event.target.value)}
                          onKeyDown={(event) => handleNotebookBlockKeyDown(event, index, block.text)}
                          placeholder={index === 0 ? "Escreva ou digite / para inserir um bloco" : ""}
                          rows={1}
                          value={block.text}
                        />
                        {showPageCommand && (
                          <div className="notebook-slash-menu" role="menu" aria-label="Comandos do Caderno">
                            <button onClick={() => addNotebookPage(index, true)} role="menuitem" type="button">
                              <span>📄 Página</span><small>Adicionar uma subpágina</small>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {unlinkedNotebookChildren.map((page, index) =>
                    renderNotebookPageBlock(page, notebookBlocks.length + index, false)
                  )}
                </div>
              </article>
            </div>
          )}

          {mode === "archive" && (
            <div className="task-list">
              {archivedTasks.length ? archivedTasks.map((task) => (
                <TaskRow archived={task.archived} completed={task.completed} group={taskGroup(task)} key={task.id} onClick={() => { setSelectedTaskId(task.id); setMobileDetail(true); }} onComplete={() => updateTask(task.id, { archived: false, completed: false })} selected={selectedTaskId === task.id} task={task} today={today} />
              )) : <div className="empty-state"><div className="empty-illustration"><Archive size={25} /></div><h2>Sem itens arquivados</h2><p>Arquive tarefas concluídas ou que quer guardar para depois.</p></div>}
              {activeGroups.filter((group) => group.archived && !group.deletedAt).map((group) => (
                <div className="trash-row" key={group.id}><span className="color-dot" style={{ backgroundColor: group.color }} /><strong>{group.name}</strong><span>Grupo arquivado</span><button className="text-button" onClick={() => updateGroup(group.id, { archived: false })}>Desarquivar</button></div>
              ))}
            </div>
          )}

          {mode === "trash" && (
            <div className="task-list">
              {trashedGroups.map((group) => (
                <div className="trash-row" key={group.id}><FolderPlus size={17} /><strong>{group.name}</strong><span>Grupo e tarefas</span><button className="text-button" onClick={() => restoreGroup(group)}>Restaurar</button></div>
              ))}
              {trashedTasks.filter((task) => !trashedGroups.some((group) => group.id === task.groupId)).map((task) => (
                <div className="trash-row" key={task.id}><ListTodo size={17} /><strong>{task.title || "Tarefa sem título"}</strong><span>{taskGroup(task)?.name ?? "Grupo"}</span><button className="text-button" onClick={() => restoreTask(task)}>Restaurar</button></div>
              ))}
              {trashedNotes.filter((note) =>
                !trashedGroups.some((group) => group.id === note.groupId) &&
                !trashedTasks.some((task) => task.id === note.taskId)
              ).map((note) => (
                <div className="trash-row" key={note.id}><FileText size={17} /><strong>{note.title || "Nota sem título"}</strong><span>Nota</span><button className="text-button" onClick={() => updateNote(note.id, { deletedAt: null })}>Restaurar</button></div>
              ))}
              {!trashedTasks.length && !trashedGroups.length && !trashedNotes.length && <div className="empty-state"><div className="empty-illustration"><Trash2 size={25} /></div><h2>A lixeira está vazia</h2><p>Itens removidos aparecem aqui por 30 dias.</p></div>}
            </div>
          )}
        </div>
      </section>

      <aside className={`detail-panel ${mobileDetail ? "detail-mobile-open" : ""}`}>
        {selectedTask ? (
          <>
            <div className="detail-top">
              <button className="icon-button detail-back" aria-label="Voltar para a lista" onClick={() => setMobileDetail(false)}><ArrowLeft size={18} /></button>
              <span>DETALHES</span>
              <button className="icon-button ml-auto" aria-label="Excluir tarefa" onClick={() => deleteTask(selectedTask)}><Trash2 size={17} /></button>
              <button className="icon-button" aria-label="Fechar detalhes" onClick={() => { setSelectedTaskId(null); setMobileDetail(false); }}><X size={17} /></button>
            </div>
            <div className="detail-body">
              <div className="task-title-editor">
                <button className={`check-circle ${selectedTask.completed ? "checked" : ""}`} aria-label={selectedTask.completed ? "Reabrir tarefa" : "Concluir tarefa"} onClick={() => updateTask(selectedTask.id, { completed: !selectedTask.completed })}>{selectedTask.completed && <Check size={14} />}</button>
                <textarea
                  aria-label="Título da tarefa"
                  className="task-title-input"
                  onChange={(event) => updateTask(selectedTask.id, { title: event.target.value })}
                  placeholder="Nome da tarefa"
                  rows={2}
                  value={selectedTask.title}
                />
              </div>
              <div className="detail-properties">
                <PropertyRow icon={<FolderPlus size={16} />} label="Grupo">
                  <select onChange={(event) => updateTask(selectedTask.id, { groupId: event.target.value })} value={selectedTask.groupId}>
                    {activeGroups.filter((group) => !group.deletedAt).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </PropertyRow>
                <PropertyRow icon={<CalendarDays size={16} />} label="Prazo">
                  <input aria-label="Prazo da tarefa" onChange={(event) => updateTask(selectedTask.id, { dueDate: event.target.value || null })} type="date" value={selectedTask.dueDate ?? ""} />
                </PropertyRow>
                <PropertyRow icon={<Settings2 size={16} />} label="Prioridade">
                  <select onChange={(event) => updateTask(selectedTask.id, { priority: event.target.value as Priority })} value={selectedTask.priority}>
                    {PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </PropertyRow>
                <PropertyRow icon={<span className="color-dot" style={{ backgroundColor: selectedTask.color }} />} label="Cor">
                  <div className="color-picker">{COLORS.map((color) => <button aria-label={`Cor ${color}`} className={selectedTask.color === color ? "chosen" : ""} key={color} onClick={() => updateTask(selectedTask.id, { color })} style={{ backgroundColor: color }} />)}</div>
                </PropertyRow>
                <PropertyRow icon={<CheckCircle2 size={16} />} label="Status">
                  <button className="status-select" onClick={() => updateTask(selectedTask.id, { completed: !selectedTask.completed })}>{selectedTask.completed ? "Concluída" : "Em andamento"} <ChevronDown size={14} /></button>
                </PropertyRow>
              </div>
              {selectedTask.dueDate && bucketForDate(selectedTask.dueDate, today) === "overdue" && !selectedTask.completed && <div className="overdue-message"><Clock3 size={15} /> Atrasada desde {formatDate(selectedTask.dueDate)}</div>}
              <section className="subtasks-section">
                <div className="section-title"><h3>Subtarefas</h3><span>{selectedTask.subtasks.filter((item) => item.completed).length}/{selectedTask.subtasks.length}</span></div>
                <div className="subtask-list">
                  {selectedTask.subtasks.map((subtask) => (
                    <div className="subtask-row" key={subtask.id}>
                      <button className={`mini-check ${subtask.completed ? "checked" : ""}`} aria-label="Alternar subtarefa" onClick={() => updateTask(selectedTask.id, { subtasks: selectedTask.subtasks.map((item) => item.id === subtask.id ? { ...item, completed: !item.completed } : item) })}>{subtask.completed && <Check size={11} />}</button>
                      <span className={subtask.completed ? "line-through text-muted-foreground" : ""}>{subtask.title}</span>
                      <button className="icon-button tiny ml-auto" aria-label="Excluir subtarefa" onClick={() => updateTask(selectedTask.id, { subtasks: selectedTask.subtasks.filter((item) => item.id !== subtask.id) })}><X size={13} /></button>
                    </div>
                  ))}
                </div>
                <form className="subtask-add" onSubmit={(event) => {
                  event.preventDefault();
                  const title = subtaskDraft.trim();
                  if (!title) return;
                  updateTask(selectedTask.id, { subtasks: [...selectedTask.subtasks, { id: uid(), title, completed: false }] });
                  setSubtaskDraft("");
                }}>
                  <Plus size={15} /><input aria-label="Adicionar subtarefa" onChange={(event) => setSubtaskDraft(event.target.value)} placeholder="Adicionar subtarefa" value={subtaskDraft} /><button aria-label="Salvar subtarefa" type="submit"><ArrowRight size={14} /></button>
                </form>
              </section>
              <section className="subtasks-section notes-section">
                <div className="section-title"><h3>Notas e contexto</h3><button className="text-button" onClick={createTaskNote}><Plus size={14} /> Nota</button></div>
                {taskNotes.map((note) => (
                  <div className="task-note" key={note.id}>
                    <div className="task-note-head"><input aria-label="Título da nota" onChange={(event) => updateNote(note.id, { title: event.target.value })} value={note.title} /><button className="icon-button tiny" aria-label="Excluir nota" onClick={() => updateNote(note.id, { deletedAt: now() })}><X size={13} /></button></div>
                    <MarkdownEditor ariaLabel={`Conteúdo Markdown da nota ${note.title}`} onChange={(body) => updateNote(note.id, { body })} value={note.body} />
                  </div>
                ))}
                {!taskNotes.length && <p className="helper-text">Adicione notas em Markdown para guardar contexto.</p>}
              </section>
              <div className="detail-actions">
                <button className="secondary-button" onClick={() => updateTask(selectedTask.id, { archived: !selectedTask.archived })}><Archive size={15} /> {selectedTask.archived ? "Desarquivar" : "Arquivar"}</button>
              </div>
            </div>
          </>
        ) : mode === "notebook" ? (
          <div className="detail-placeholder"><BookOpen size={25} /><h3>Caderno</h3><p>Suas páginas em Markdown ficam organizadas por páginas parentes e subpáginas.</p></div>
        ) : mode === "settings" ? (
          <div className="detail-placeholder"><Settings size={25} /><h3>Configurações</h3><p>As preferências de aparência ficam salvas neste dispositivo.</p></div>
        ) : (
          <div className="detail-placeholder"><div className="detail-empty-mark"><ListTodo size={24} /></div><h3>Seu espaço de trabalho</h3><p>Selecione uma tarefa para ver detalhes, subtarefas e notas.</p><button className="text-button" onClick={addTask}><Plus size={15} /> Criar tarefa</button></div>
        )}
      </aside>
      <nav className="mobile-bottom-nav">
        <button className={mode === "today" ? "active" : ""} onClick={() => { setGroupId(null); selectedNav("today"); }}><CheckCircle2 size={19} /><span>Hoje</span></button>
        <button className={mode === "tasks" ? "active" : ""} onClick={() => { setGroupId(null); selectedNav("tasks"); }}><ListTodo size={19} /><span>Tarefas</span></button>
        <button className={mode === "calendar" ? "active" : ""} onClick={() => selectedNav("calendar")}><CalendarDays size={19} /><span>Calendário</span></button>
        <button className={mode === "notebook" ? "active" : ""} onClick={() => selectedNav("notebook")}><BookOpen size={19} /><span>Caderno</span></button>
        <button onClick={() => setSidebarOpen(true)}><Menu size={19} /><span>Mais</span></button>
      </nav>
    </main>
  );
}

function PropertyRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return <div className="property-row"><div className="property-label">{icon}<span>{label}</span></div><div className="property-value">{children}</div></div>;
}

function TaskRow({
  task, group, selected, onClick, onComplete, today, archived = false, completed = false,
}: {
  task: Task; group?: TaskGroup; selected: boolean; onClick: () => void; onComplete: () => void; today: string; archived?: boolean; completed?: boolean;
}) {
  const overdue = task.dueDate && bucketForDate(task.dueDate, today) === "overdue" && !task.completed;
  return (
    <div className={`task-row ${selected ? "selected" : ""} ${overdue ? "is-overdue" : ""}`} onClick={onClick} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onClick(); }}>
      <button className={`task-check ${completed ? "done" : ""}`} aria-label={archived || completed ? "Reabrir tarefa" : "Concluir tarefa"} onClick={(event) => { event.stopPropagation(); onComplete(); }}>{completed ? <CheckCircle2 size={19} /> : <Circle size={19} />}</button>
      <span className="task-color-bar" style={{ backgroundColor: task.color }} />
      <div className="task-row-content">
        <strong>{task.title || "Tarefa sem título"}</strong>
        <div className="task-meta">
          <span className="group-chip"><span className="color-dot" style={{ backgroundColor: group?.color ?? "#47b8ec" }} />{group?.name ?? "Grupo"}</span>
          {task.dueDate && <span className={`due-chip ${overdue ? "late" : ""}`}><CalendarDays size={12} />{overdue ? "Atrasada · " : ""}{formatDate(task.dueDate)}</span>}
          {task.subtasks.length > 0 && <span className="subtask-chip"><ListTodo size={12} />{task.subtasks.filter((item) => item.completed).length}/{task.subtasks.length}</span>}
          {task.priority === "high" && <span className="priority-chip">Alta</span>}
        </div>
      </div>
      {archived && <span className="archived-chip"><Archive size={12} /> Arquivada</span>}
      <MoreHorizontal className="task-more" size={18} />
    </div>
  );
}
