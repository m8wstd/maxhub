"use client";

import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CalendarDays,
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
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownPreview } from "@/components/markdown-preview";
import type { Note, Priority, Task, TaskGroup, Workspace } from "@/lib/maxhub-types";
import { bucketForDate, capitalize, dateFromOffset, formatDate, remainingWeekdays, todayInSaoPaulo, weekdayForDate } from "@/lib/task-date";

type ViewMode = "today" | "tasks" | "calendar" | "notes" | "trash" | "archive";
type Bucket = { id: string; label: string; date?: string };

const COLORS = ["#47b8ec", "#f0a36d", "#8e85e8", "#75b88b", "#e77e93", "#e4bd5c"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
];
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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

function mergeWorkspace(local: Workspace, remote: Workspace): Workspace {
  function mergeById<T extends { id: string; updatedAt: string }>(left: T[], right: T[]) {
    const items = new Map<string, T>();
    for (const item of [...right, ...left]) {
      const current = items.get(item.id);
      if (!current || item.updatedAt >= current.updatedAt) items.set(item.id, item);
    }
    return [...items.values()];
  }
  return {
    groups: mergeById(local.groups, remote.groups),
    tasks: mergeById(local.tasks, remote.tasks),
    notes: mergeById(local.notes, remote.notes),
  };
}

function MarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
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
        <p className="text-sm text-muted-foreground">Entre com sua senha para acessar o Maxhub.</p>
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
  const [syncStatus, setSyncStatus] = useState<"saved" | "syncing" | "offline">("saved");
  const [storageMode, setStorageMode] = useState<"blob" | "local-dev">("blob");
  const [mode, setMode] = useState<ViewMode>("today");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [calendarMonthOverride, setCalendarMonthOverride] = useState<string | null>(null);
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [showNewNote, setShowNewNote] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [mobileDetail, setMobileDetail] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [today, setToday] = useState("2000-01-01");
  const [nowMs, setNowMs] = useState(0);
  const versionRef = useRef<string | null>(null);
  const stateRef = useRef<Workspace | null>(null);
  const savingRef = useRef(false);

  const acceptSnapshot = useCallback((data: { workspace: Workspace; version: string | null; storageMode: "blob" | "local-dev" }) => {
    versionRef.current = data.version;
    setStorageMode(data.storageMode);
    setWorkspace((current) => current ? mergeWorkspace(current, data.workspace) : data.workspace);
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
    requestWorkspace()
      .then((data) => {
        if (active && data) acceptSnapshot(data);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar os dados.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const interval = window.setInterval(refreshClock, 60_000);
    const refresh = () => {
      if (document.visibilityState === "visible" && stateRef.current) void loadWorkspace();
    };
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearTimeout(todayTimeout);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [acceptSnapshot, loadWorkspace, requestWorkspace]);

  useEffect(() => {
    stateRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    if (!workspace || loading || savingRef.current) return;
    const timer = window.setTimeout(async () => {
      let retryAfterConflict = false;
      savingRef.current = true;
      setSyncStatus("syncing");
      try {
        const response = await fetch("/api/data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace, version: versionRef.current }),
        });
        if (response.status === 401) {
          setWorkspace(null);
          return;
        }
        if (response.status === 409) {
          retryAfterConflict = true;
          const latestResponse = await fetch("/api/data", { cache: "no-store" });
          if (!latestResponse.ok) throw new Error("Conflito ao sincronizar. Tente novamente.");
          const latest = await latestResponse.json();
          versionRef.current = latest.version;
          setStorageMode(latest.storageMode);
          const current = stateRef.current;
          if (current) setWorkspace(mergeWorkspace(current, latest.workspace));
          return;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Falha na sincronização.");
        versionRef.current = result.version;
        setStorageMode(result.storageMode);
        setSyncStatus("saved");
        setError("");
      } catch (caught) {
        setSyncStatus("offline");
        setError(caught instanceof Error ? caught.message : "Falha na sincronização.");
      } finally {
        savingRef.current = false;
        const current = stateRef.current;
        if (current && (retryAfterConflict || current !== workspace)) {
          setWorkspace((latest) => latest ? { ...latest } : latest);
        }
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [workspace, loading]);

  const activeGroups = useMemo(() => workspace?.groups
    .filter((group) => !group.deletedAt)
    .sort((left, right) => left.order - right.order) ?? [], [workspace]);
  const activeTasks = useMemo(() => workspace?.tasks.filter((task) => !task.deletedAt) ?? [], [workspace]);
  const buckets = useMemo(() => currentBuckets(today), [today]);
  const calendarMonth = calendarMonthOverride ?? today.slice(0, 7);
  const calendarDates = datesInMonth(calendarMonth);
  const selectedTask = activeTasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedNote = workspace?.notes.find((note) => note.id === selectedNoteId && !note.deletedAt) ?? null;
  const selectedGroup = activeGroups.find((group) => group.id === groupId) ?? null;
  const groupTasks = (task: Task) => groupId === null || task.groupId === groupId;
  const taskGroup = (task: Task) => activeGroups.find((group) => group.id === task.groupId);

  const updateWorkspace = (updater: (state: Workspace) => Workspace) => {
    setWorkspace((current) => current ? updater(current) : current);
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
  const looseNotes = workspace?.notes.filter((note) => !note.deletedAt && !note.taskId && (groupId === null || note.groupId === groupId)) ?? [];
  const taskNotes = selectedTask ? workspace?.notes.filter((note) => !note.deletedAt && note.taskId === selectedTask.id) ?? [] : [];

  const addTask = () => {
    const targetGroup = groupId ?? activeGroups.find((group) => !group.archived)?.id;
    if (!targetGroup) {
      setError("Crie um grupo antes de adicionar tarefas.");
      return;
    }
    const task = newTask(targetGroup);
    setWorkspace((current) => current ? { ...current, tasks: [...current.tasks, task] } : current);
    setSelectedTaskId(task.id);
    setMobileDetail(true);
  };

  const addGroup = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;
    const group = newGroup(name, activeGroups.length);
    setWorkspace((current) => current ? { ...current, groups: [...current.groups, group] } : current);
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

  const addLooseNote = (event: React.FormEvent) => {
    event.preventDefault();
    const title = newNoteTitle.trim();
    if (!title || !workspace) return;
    const stamp = now();
    const note: Note = {
      id: uid(), title, body: "", groupId: groupId, taskId: null, createdAt: stamp, updatedAt: stamp, deletedAt: null,
    };
    setWorkspace({ ...workspace, notes: [...workspace.notes, note] });
    setSelectedNoteId(note.id);
    setNewNoteTitle("");
    setShowNewNote(false);
  };

  const createTaskNote = () => {
    if (!selectedTask || !workspace) return;
    const stamp = now();
    const note: Note = {
      id: uid(), title: "Nova nota", body: "", groupId: selectedTask.groupId, taskId: selectedTask.id,
      createdAt: stamp, updatedAt: stamp, deletedAt: null,
    };
    setWorkspace({ ...workspace, notes: [...workspace.notes, note] });
    setSelectedNoteId(note.id);
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
        : mode === "notes"
          ? "Notas"
          : mode === "trash"
            ? "Lixeira"
            : "Arquivadas";

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

  const selectedNav = (view: ViewMode) => {
    setMode(view);
    setSelectedTaskId(null);
    setSelectedNoteId(null);
    setMobileDetail(false);
    setSidebarOpen(false);
  };

  return (
    <main className={`app-shell ${mobileDetail ? "show-detail" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark small">m</div>
          <span>maxhub</span>
          <button className="icon-button sidebar-close" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <button className={`nav-item ${mode === "today" ? "active" : ""}`} onClick={() => { setGroupId(null); selectedNav("today"); }}>
          <CheckCircle2 size={17} /> Hoje <span className="nav-count">{activeTasks.filter((task) => !task.archived && !task.completed && bucketForDate(task.dueDate, today) === "today").length}</span>
        </button>
        <div className="sidebar-section">
          <div className="sidebar-heading"><span>PLANEJAMENTO</span></div>
          <button className={`nav-item ${mode === "tasks" && groupId === null ? "active" : ""}`} onClick={() => { setGroupId(null); selectedNav("tasks"); }}><ListTodo size={17} /> Tarefas</button>
          <button className={`nav-item ${mode === "calendar" ? "active" : ""}`} onClick={() => selectedNav("calendar")}><CalendarDays size={17} /> Calendário</button>
          <button className={`nav-item ${mode === "notes" ? "active" : ""}`} onClick={() => selectedNav("notes")}><FileText size={17} /> Notas</button>
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
        <div className="sidebar-footer">
          <div className={`sync-dot ${syncStatus}`} />
          <span>{syncStatus === "syncing" ? "Sincronizando" : syncStatus === "offline" ? "Sem sincronização" : storageMode === "local-dev" ? "Teste local" : "Tudo salvo"}</span>
          <button className="icon-button ml-auto" aria-label="Sair" title="Sair" onClick={() => void logout()}><LogOut size={16} /></button>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}

      <section className={`main-column ${mobileDetail ? "hide-mobile" : ""}`}>
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>
          <div className="crumb"><span>{groupId ? selectedGroup?.name ?? "Grupo" : "Seu espaço"}</span><span className="crumb-slash">/</span><strong>{headerTitle}</strong></div>
          <div className="topbar-actions">
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
        <div className="view-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`))}</p>
              <h1>{mode === "tasks" && groupId ? selectedGroup?.name : headerTitle}</h1>
              <p className="page-description">
                {mode === "today" ? "Tarefas de hoje e sem prazo." :
                  mode === "tasks" ? "Prazos de todas as tarefas organizados por período." :
                    mode === "calendar" ? "Consulte os prazos no calendário mensal." :
                      mode === "notes" ? "Ideias e referências organizadas por grupo." :
                        mode === "trash" ? "Itens excluídos ficam disponíveis por 30 dias." :
                          "Tarefas e grupos guardados para consultar depois."}
              </p>
            </div>
            {(mode === "today" || mode === "tasks") && <button className="primary-button" onClick={addTask}><Plus size={17} /> Nova tarefa</button>}
            {mode === "notes" && <button className="primary-button" onClick={() => setShowNewNote(true)}><Plus size={17} /> Nova nota</button>}
          </div>

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

          {mode === "notes" && (
            <div className="notes-workspace">
              <div className="note-list">
                <div className="note-list-head"><span>{groupId ? selectedGroup?.name : "Todas as notas"}</span><button className="icon-button" aria-label="Nova nota" onClick={() => setShowNewNote(true)}><Plus size={17} /></button></div>
                {showNewNote && (
                  <form className="note-create-form" onSubmit={addLooseNote}>
                    <input autoFocus onChange={(event) => setNewNoteTitle(event.target.value)} placeholder="Título da nota" value={newNoteTitle} />
                    <button className="text-button" type="submit">Criar</button>
                  </form>
                )}
                {looseNotes.length ? looseNotes.map((note) => (
                  <button className={`note-card ${selectedNoteId === note.id ? "selected" : ""}`} key={note.id} onClick={() => setSelectedNoteId(note.id)}>
                    <strong>{note.title}</strong><span>{note.body.trim().split("\n")[0] || "Sem conteúdo"}</span>
                    <small>{activeGroups.find((group) => group.id === note.groupId)?.name ?? "Geral"}</small>
                  </button>
                )) : !showNewNote && <div className="small-empty">Nenhuma nota neste grupo.</div>}
              </div>
              <div className="note-editor">
                {selectedNote ? (
                  <>
                    <div className="note-editor-head">
                      <input className="note-title-input" onChange={(event) => updateNote(selectedNote.id, { title: event.target.value })} value={selectedNote.title} />
                      <button className="icon-button" aria-label="Excluir nota" onClick={() => updateNote(selectedNote.id, { deletedAt: now() })}><Trash2 size={16} /></button>
                    </div>
                    <MarkdownEditor onChange={(body) => updateNote(selectedNote.id, { body })} value={selectedNote.body} />
                  </>
                ) : <div className="small-empty">Selecione uma nota ou crie uma nova.</div>}
              </div>
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
                    <MarkdownEditor onChange={(body) => updateNote(note.id, { body })} value={note.body} />
                  </div>
                ))}
                {!taskNotes.length && <p className="helper-text">Adicione notas em Markdown para guardar contexto.</p>}
              </section>
              <div className="detail-actions">
                <button className="secondary-button" onClick={() => updateTask(selectedTask.id, { archived: !selectedTask.archived })}><Archive size={15} /> {selectedTask.archived ? "Desarquivar" : "Arquivar"}</button>
              </div>
            </div>
          </>
        ) : selectedNote && mode === "notes" ? (
          <div className="detail-placeholder"><FileText size={25} /><p>A nota selecionada pode ser editada na área central.</p></div>
        ) : (
          <div className="detail-placeholder"><div className="detail-empty-mark"><ListTodo size={24} /></div><h3>Seu espaço de trabalho</h3><p>Selecione uma tarefa para ver detalhes, subtarefas e notas.</p><button className="text-button" onClick={addTask}><Plus size={15} /> Criar tarefa</button></div>
        )}
      </aside>
      <nav className="mobile-bottom-nav">
        <button className={mode === "today" ? "active" : ""} onClick={() => { setGroupId(null); selectedNav("today"); }}><CheckCircle2 size={19} /><span>Hoje</span></button>
        <button className={mode === "tasks" ? "active" : ""} onClick={() => { setGroupId(null); selectedNav("tasks"); }}><ListTodo size={19} /><span>Tarefas</span></button>
        <button className={mode === "calendar" ? "active" : ""} onClick={() => selectedNav("calendar")}><CalendarDays size={19} /><span>Calendário</span></button>
        <button className={mode === "notes" ? "active" : ""} onClick={() => selectedNav("notes")}><FileText size={19} /><span>Notas</span></button>
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
