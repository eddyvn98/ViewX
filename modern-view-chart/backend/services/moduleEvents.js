import { EventEmitter } from "events";

const emitter = new EventEmitter();

export function emitModuleActivated(payload) {
  emitter.emit("module_activated", payload);
}

export function onModuleActivated(handler) {
  emitter.on("module_activated", handler);
  return () => emitter.off("module_activated", handler);
}
