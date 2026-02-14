import { Router } from "express";
import crypto from "crypto";

const router = Router();

// In-memory storage for orchestration
const pendingTasks = [];
const taskResults = new Map(); // taskId -> {status, content, timestamp}

/**
 * Extension calls this to see if there's work
 */
router.get("/pending", (req, res) => {
    if (pendingTasks.length > 0) {
        const task = pendingTasks.shift();
        console.log(`  [AI Bridge] Task pushed to Extension: ${task.task_id}`);
        return res.json(task);
    }
    return res.status(204).send();
});

/**
 * Extension calls this to deliver the response
 */
router.post("/result", (req, res) => {
    const { task_id, response } = req.body;

    if (task_id) {
        console.log(`  [AI Bridge] Received result for task: ${task_id}`);
        taskResults.set(task_id, {
            status: "done",
            content: response,
            timestamp: Date.now()
        });
        return res.json({ status: "ok" });
    }
    return res.status(400).json({ status: "err", msg: "task_id missing" });
});

/**
 * Generic task creation endpoint (used by the app/bot)
 */
router.post("/task", async (req, res) => {
    const { prompt, timeout = 120000 } = req.body;
    if (!prompt) return res.status(400).send("Prompt missing");

    const taskId = crypto.randomUUID();
    const task = { task_id: taskId, prompt };

    pendingTasks.push(task);
    console.log(`  [AI Bridge] New Task Queued: ${taskId}`);

    // Wait for result (Polling)
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (taskResults.has(taskId)) {
            const result = taskResults.get(taskId);
            taskResults.delete(taskId);
            return res.json({ status: "ok", response: result.content });
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`  [AI Bridge] ❌ Task Timeout: ${taskId}`);
    return res.status(408).json({ status: "error", msg: "Gemini Web Timeout" });
});

/**
 * Extension logs and remote execution
 */
router.post("/execute", (req, res) => {
    const { command, type = "terminal" } = req.body;
    console.log(`  [AI Bridge-Auto] Log/Exec (${type}): ${command}`);

    // For now, we only log to server console to keep it safe.
    // If the user wants full autonomous terminal support, it can be added here.
    return res.json({ status: "done", msg: "Log received" });
});

export default router;
