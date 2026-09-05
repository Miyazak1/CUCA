# CUAC PageAgent Integration Note

Date: 2026-08-12

Status: reference and future integration guidance.

Reference:

- GitHub: https://github.com/alibaba/page-agent
- Overview: https://alibaba.github.io/page-agent/docs/introduction/overview/
- PageAgent class and panel: https://alibaba.github.io/page-agent/docs/advanced/page-agent/
- Limitations: https://alibaba.github.io/page-agent/docs/introduction/limitations/
- Custom instructions: https://alibaba.github.io/page-agent/docs/features/custom-instructions/

## 1. Why It Matters For CUAC

CUAC is moving from a keyword-search homepage to a natural-language planning entry. When a student types a goal such as `English-taught computer science in Hangzhou`, the product should not only return static search results. It should show how CUAC understands the goal, searches routes, checks city/cost fit, verifies requirements, and prepares the next action.

PageAgent is relevant because it is an embedded in-page GUI agent: it reads the current page through DOM structure and can perform page actions such as clicking, typing, scrolling, selecting, focusing, and submitting. It also offers a built-in UI panel, while PageAgentCore can be used with a custom UI.

This matches the current CUAC direction:

- Shared bottom-center natural-language composer collects the student's goal on every student-facing page.
- Right-side `Agent Workspace` opens after send.
- The same composer docks at the workspace bottom while the panel is open, supporting follow-up instructions.
- The workspace shows route interpretation and operational steps.
- Later, an agent runtime can operate the page instead of only displaying mocked steps.

## 2. Correct Product Positioning

PageAgent should be treated as a page-operation layer, not as CUAC's admissions brain.

CUAC needs two separate agent layers:

1. CUAC Admissions Agent.
   This is the domain layer. It understands Chinese universities, programs, scholarships, deadlines, documents, HSK/IELTS, visa/JW form, source freshness, and student readiness. This layer must be controlled by CUAC product logic and data.

2. Page Operation Agent.
   This is the UI operation layer. PageAgent can help execute actions inside the current page: open filters, select chips, save a program, compare universities, open details, or show how to prepare a shortlist.

Do not let PageAgent become the source of admissions truth. It can operate the interface, but CUAC's data contract and rules decide what is valid.

## 3. Best Fit In The Current Demo

For the current frontend-only phase, use PageAgent as inspiration, not as a production dependency.

Current demo behavior should be:

- User sends a natural-language goal from the global bottom composer or a page-level planning input.
- Right-side `Agent Workspace` opens.
- Composer moves into the workspace bottom for continued questions.
- The workspace displays mocked but realistic steps:
  - Understand intent.
  - Search matching programs.
  - Compare city/cost context.
  - Check readiness.
  - Prepare next action.
- The panel can collapse.
- A small right-edge `Agent` reopen control appears after collapse.

This gives the desired agent experience without pretending a real AI/backend is running.

## 4. Future Integration Path

Phase 1: Frontend-only simulation

- Keep the custom CUAC panel.
- Keep all actions local and mocked.
- Make DOM semantics strong: clear buttons, labels, aria names, stable routes, and visible status.
- No LLM keys, no real document data, no personal information.

Phase 2: Controlled PageAgent prototype

- Test PageAgent or PageAgentCore only on low-risk page actions.
- Allowlist actions such as:
  - Apply route chips.
  - Open university search.
  - Toggle filters.
  - Save/compare a program.
  - Open matching programs.
  - Open Hub.
- Use custom instructions to constrain behavior:
  - Never claim admission is guaranteed.
  - Never submit real applications.
  - Never request passport or transcript details in a public demo.
  - Ask before any irreversible action.

Phase 3: Production-ready architecture

- Use a backend proxy for LLM calls. Do not expose API keys in frontend code.
- Keep admissions matching and readiness decisions in CUAC-owned services.
- Use PageAgent only as a UI automation/copilot layer when it adds clear value.
- Add audit history for agent actions.
- Add user confirmation before sensitive actions.
- Add data masking for personal information.

## 5. Important Limitations

PageAgent is DOM-based. It does not understand screenshots, canvas, WebGL, or visual-only content. This has direct design consequences:

- CUAC pages must use semantic HTML.
- Icon-only actions need accessible names.
- Visual-only states are not enough; state must be represented in text or attributes.
- Rapidly appearing/disappearing UI can reduce agent reliability.
- Current-page PageAgent is different from browser-extension control; multi-page workflows need extra setup.

Supported interaction types are useful for CUAC: click, text input, select, scroll, form submit, and focus. Unsupported or weak areas such as drag-and-drop, hover-only UI, keyboard shortcuts, and cross-origin iframe workflows should not be core to admissions UX.

## 6. Design Requirements For CUAC Pages

To stay compatible with a future PageAgent-like layer:

- Buttons must have clear visible text or `aria-label`.
- Program cards and university cards need stable semantic structure.
- Filters should be real controls, not decorative chips only.
- Results should expose text fields for program, city, tuition, deadline, language, scholarship, and source status.
- Agent-triggered operations should update visible state, not only hidden data.
- The global bottom composer and right-side `Agent Workspace` should be custom CUAC UI in the shared shell, even if future runtime uses PageAgentCore behind it. The composer should keep one shared state and dock into the panel while open.

## 7. Decision

Use PageAgent as a strong reference and possible future page-operation runtime.

Do not directly make it the core CUAC recommendation engine.

The near-term implementation should keep the current custom shared composer and right-side `Agent Workspace`, then later evaluate PageAgentCore or PageAgent behind that UI after the main CUAC frontend surfaces are stable.
