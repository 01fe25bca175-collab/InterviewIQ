require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname)));

const roles = ["Software Developer", "Web Developer", "Data Analyst", "Cybersecurity Analyst", "General Graduate"];
const types = ["Technical", "Aptitude", "Mixed"];
const difficulties = ["Easy", "Medium", "Hard"];

async function askNvidia(messages, maxTokens = 1400) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key || key.includes("PASTE_YOUR")) {
    const err = new Error("NVIDIA API key is not configured. Add it to your .env file.");
    err.status = 503; throw err;
  }
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
      messages, temperature: 0.35, max_tokens: maxTokens, stream: false
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.detail || data?.error?.message || `NVIDIA API returned ${response.status}. Check your model name, key and available credits.`);
    err.status = response.status; throw err;
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("The NVIDIA API returned an empty response.");
  return content;
}
function parseJson(text) {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{"), end = clean.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI response was not valid JSON. Please try again.");
  return JSON.parse(clean.slice(start, end + 1));
}
app.get("/api/health", (_req, res) => res.json({
  ok: true, configured: Boolean(process.env.NVIDIA_API_KEY && !process.env.NVIDIA_API_KEY.includes("PASTE_YOUR")),
  model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct"
}));
app.post("/api/mcq", async (req, res) => {
  try {
    const { role, experience, type, difficulty, count } = req.body || {};
    if (!roles.includes(role) || !types.includes(type) || !difficulties.includes(difficulty)) return res.status(400).json({ error: "Choose valid role, interview type and difficulty." });
    const n = Math.max(5, Math.min(10, Number(count) || 5));
    const content = await askNvidia([
      { role: "system", content: "You create accurate, fair job-interview multiple-choice practice questions. Return ONLY valid JSON. Each question must have exactly four distinct options and one correct answer. Avoid trick questions. Explanations should be short and educational." },
      { role: "user", content: `Create ${n} ${difficulty} difficulty ${type} interview MCQs for a ${role} candidate with ${experience || "entry-level"} experience. Return JSON exactly like {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","skill":"..."}]}. answer is the zero-based index of the correct option. Make questions distinct and relevant. No markdown.` }
    ], 2400);
    const parsed = parseJson(content);
    if (!Array.isArray(parsed.questions) || parsed.questions.length < 1) throw new Error("AI did not return questions.");
    const questions = parsed.questions.slice(0,n).map(q => ({
      question: String(q.question || ""),
      options: Array.isArray(q.options) ? q.options.slice(0,4).map(String) : [],
      answer: Number(q.answer),
      explanation: String(q.explanation || ""),
      skill: String(q.skill || "Core knowledge")
    })).filter(q => q.question && q.options.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3);
    if (!questions.length) throw new Error("AI returned questions in an unexpected format. Try again.");
    res.json({ questions, source: "nvidia" });
  } catch (e) { res.status(e.status || 500).json({ error: e.message || "Could not generate questions." }); }
});
app.post("/api/interview", async (req, res) => {
  try {
    const { role, experience, difficulty, history = [], answer, opening } = req.body || {};
    if (!roles.includes(role) || !difficulties.includes(difficulty)) return res.status(400).json({ error: "Choose a valid role and difficulty." });
    const safeHistory = Array.isArray(history) ? history.slice(-12).filter(m => ["user","assistant"].includes(m.role)).map(m => ({ role: m.role, content: String(m.content || "").slice(0,4000) })) : [];
    const system = `You are a realistic but supportive one-to-one mock interviewer for the target role: ${role}. Candidate experience: ${experience || "entry-level"}. Difficulty: ${difficulty}. Conduct one question at a time. Start with a concise greeting and your first relevant question. After each candidate response, briefly acknowledge it, give constructive specific feedback (what was good and what to improve), then ask the next interview question. Cover role knowledge, reasoning and practical scenarios. Do not claim to be a real recruiter. Keep replies concise and natural. If the candidate asks to finish, provide a brief overall assessment with strengths, improvements, and practice suggestions.`;
    const messages = [{ role: "system", content: system }];
    if (opening) messages.push({ role: "user", content: "Start the mock interview now. Ask your first question." });
    else messages.push(...safeHistory, { role: "user", content: String(answer || "").slice(0,4000) });
    const reply = await askNvidia(messages, 1000);
    res.json({ reply, source: "nvidia" });
  } catch (e) { res.status(e.status || 500).json({ error: e.message || "Interview request failed." }); }
});
app.post("/api/evaluate", async (req, res) => {
  try {
    const { role, experience, question, answer } = req.body || {};
    if (!String(answer || "").trim()) return res.status(400).json({ error: "Enter an answer to evaluate." });
    const content = await askNvidia([
      { role: "system", content: "You are a supportive interview coach. Evaluate only the provided answer fairly. Return ONLY valid JSON with score (integer 0-100), strengths (array of strings), improvements (array of strings), sampleAnswer (string). Do not infer personality or make hiring decisions." },
      { role: "user", content: `Role: ${role || "General Graduate"}; experience: ${experience || "Entry-level"}; interview question: ${String(question || "").slice(0,1500)}; candidate answer: ${String(answer).slice(0,4000)}. Evaluate relevance, correctness, clarity and structure. Give actionable feedback and a concise sample answer.` }
    ], 1000);
    res.json({ evaluation: parseJson(content), source: "nvidia" });
  } catch (e) { res.status(e.status || 500).json({ error: e.message || "Evaluation failed." }); }
});
app.listen(PORT, () => console.log(`AI Interview Coach running at http://localhost:${PORT}`));
