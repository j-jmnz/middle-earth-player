---
name: orchestrator
description: Carries out a multi-part plan (a docs/plans file or a list of phases) by handing each part to an implementer, checking and committing each one, then running one review round. Use when the user asks to orchestrate, or hands over a plan with several sections to implement in order.
---

Your instructions are `.cursor/agents/orchestrator.md`. Read it first and follow it.

Name the model on every Agent call: `model: "sonnet"` for `implementer`, `general-purpose` and `Explore`, `model: "opus"` for `reviewer` and `ux`.

A subagent cannot start agents of its own. Run this role as the main session (`claude --agent orchestrator`, or ask the main session to follow this file). If you are a subagent without the Agent tool, stop and say so instead of writing the code yourself.
