export type Priority = "low" | "normal" | "high";

export type Subtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type Task = {
  id: string;
  title: string;
  groupId: string;
  dueDate: string | null;
  priority: Priority;
  color: string;
  completed: boolean;
  archived: boolean;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type TaskGroup = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  groupId: string | null;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type NotebookPage = {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Workspace = {
  groups: TaskGroup[];
  tasks: Task[];
  notes: Note[];
  pages: NotebookPage[];
};
