---
title: "Governing many OpenShift clusters with ACM and ACS"
summary: "Central policy, RBAC governance and security posture across clusters, plus policies that clean up after themselves."
date: 2026-11-25
draft: true
---

<!-- DRAFT. Built only from the CV bullets. Fill every TODO, then set draft: false. -->

## The setup

I rolled out OpenShift Advanced Cluster Management (ACM) and Advanced Cluster Security (ACS) to enforce policy centrally, govern RBAC, and track security posture across several clusters.

TODO: how many clusters and environments (no client names), and what governance looked like before.

## Policies that do the work

- **Catching anomalous resource usage.** TODO: what counted as anomalous and what the policy did when it found it.
- **Cleaning up temporary namespaces automatically.** TODO: how a namespace was marked temporary and when it was removed.

TODO: a short, anonymised policy example.

## Checking PROD against DR

Python and Bash scripts cross-audit microservice versions between PROD and DR, so version drift between the two shows up in a report.

TODO: how often it ran and what it reported.

## Lessons

TODO: two or three lessons.
