import { Router } from "express";
import crypto from "crypto";

const router = Router();

// --- Startup Diagnostic ---
if (process.env.GEMINI_API_KEY) {
    console.log("  [AI API] ✅ GEMINI_API_KEY detected. Direct Mode (Gemini 2.5 Flash) is READY.");
} else {
    console.warn("  [AI API] ⚠️ GEMINI_API_KEY not found. Falling back to Bridge Mode.");
}

// In-memory storage for orchestration
const pendingTasks = [];
const taskResults = new Map(); // taskId -> {status, content, timestamp}
const aiHistory = []; // {id, source: 'chat'|'system', prompt, response, timestamp}

/**
 * Get AI Communication History
 */
router.get("/history", (req, res) => {
    return res.json(aiHistory.slice(-50).reverse()); // Return last 50, newest first
});

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
    const { prompt, timeout = 120000, source = 'system' } = req.body;
    if (!prompt) return res.status(400).send("Prompt missing");

    // 1. Check for official API Key
    const apiKey = process.env.GEMINI_API_KEY;
    console.log(`  [AI API] Checking GEMINI_API_KEY: ${apiKey ? "FOUND (Direct Mode)" : "NOT FOUND (Bridge Mode)"}`);

    if (apiKey) {
        console.log("  [AI API] Using direct Gemini API...");
        try {
            const apiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                }
            );

            if (!apiRes.ok) {
                const errData = await apiRes.json();
                throw new Error(errData.error?.message || apiRes.statusText);
            }

            const data = await apiRes.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                console.log("  [AI API] Success: Response received directly.");

                // Log to history
                aiHistory.push({
                    id: crypto.randomUUID(),
                    source,
                    prompt,
                    response: text,
                    timestamp: Date.now()
                });

                return res.json({ status: "ok", response: text });
            }
        } catch (error) {
            console.error(`  [AI API] ❌ Direct API Error: ${error.message}`);
            // Fallback to bridge if API fails? Or just error?
            // Let's error so the user knows their key might be wrong
            return res.status(502).json({ status: "error", msg: `Gemini API Error: ${error.message}` });
        }
    }

    // 2. Fallback to Bridge logic
    const taskId = crypto.randomUUID();
    const task = { task_id: taskId, prompt };

    pendingTasks.push(task);
    console.log(`  [AI Bridge] New Task Queued (Bridge Fallback): ${taskId}`);

    // Wait for result (Polling)
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (taskResults.has(taskId)) {
            const result = taskResults.get(taskId);
            taskResults.delete(taskId);

            // Log to history
            aiHistory.push({
                id: taskId,
                source,
                prompt,
                response: result.content,
                timestamp: Date.now()
            });

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
