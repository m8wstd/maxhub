const AUTOSAVE_DELAY_MS = 700;
const KEEPALIVE_BODY_LIMIT_BYTES = 60 * 1024;

export function workspaceSaveDelay(isNewTask) {
  return isNewTask ? 0 : AUTOSAVE_DELAY_MS;
}

export function canKeepaliveWorkspaceSave(body) {
  return new TextEncoder().encode(body).byteLength <= KEEPALIVE_BODY_LIMIT_BYTES;
}
