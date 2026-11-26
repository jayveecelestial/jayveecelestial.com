---
title: "Safe concurrent deployments with Control-M"
summary: "Approval gates, file-watcher triggers and per-order conditions, and the race conditions I had to fix on the way."
date: 2026-11-26
draft: true
---

<!-- DRAFT. Built only from the CV bullets. Fill every TODO, then set draft: false. -->

## The problem

Several deployments can run at the same time, and each must wait for a human to approve it. Deployment payloads move across segregated file-transfer zones, so no single host sees the whole flow.

TODO: what the team used before Control-M, and why it stopped working.

## The design

- **Multi-stage workflow.** TODO: list the stages.
- **Human approval gates.** A deployment pauses until someone approves or denies it. Bash tooling handles the approve and deny actions across the file-transfer zones.
- **File-watcher triggers.** A stage starts when its payload arrives, not on a timer.
- **Per-order condition isolation.** Each deployment order uses its own conditions, so two concurrent deployments can't release each other.

TODO: a small diagram or example of the condition names for one order.

## What broke during the proof of concept

- **Race conditions** between concurrent orders. TODO: what happened and what fixed it.
- **Stale conditions** left behind by earlier runs. TODO: how they were cleaned up.
- **Self-ordering loops**, where a job ended up waiting on itself. TODO: the cause.
- **Host setup**: wrong SELinux contexts and misconfigured agent hosts. TODO: the symptom you saw first.

## What I'd tell someone starting this

TODO: two or three lessons.
