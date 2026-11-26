export interface Link { label: string; href: string; cv?: boolean }
export interface Job { company: string; role: string; period: string; location: string; bullets: string[] }
export interface Cert { name: string; code?: string; date: string }
export interface Skill { label: string; items: string }
/** href only for public repos or pages; private repos get no link. */
export interface Project { name: string; summary: string; stack: string; href?: string }

export const email = { user: "jayveeccelestial", domain: "gmail.com" };

export const links: Link[] = [
  { label: "GitHub", href: "https://github.com/jayveecelestial" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/jayveecelestial/" },
  { label: "Credly", href: "https://www.credly.com/users/jayvee-celestial/badges" },
  { label: "CV (PDF)", href: "#contact", cv: true },
];

export const experience: Job[] = [
  {
    company: "eMcREY Limited",
    role: "Senior DevOps Engineer",
    period: "2025 – now",
    location: "Riyadh",
    bullets: [
      "Designed multi-stage Control-M deployment workflows with human approval gates, file-watcher triggers, and per-order condition isolation so concurrent deployments stay safe.",
      "Tracked down race conditions, stale conditions, and self-ordering loops in Control-M job flows; fixed SELinux contexts and agent host misconfigurations during the proof of concept.",
      "Wrote Bash tooling for deployment payload extraction and approve/deny handling across segregated file-transfer zones.",
      "Debugged and slimmed developer container images for OpenShift, making builds more reliable and deploys faster.",
    ],
  },
  {
    company: "IBM",
    role: "Platform Engineer",
    period: "2024 – 2025",
    location: "Quezon City",
    bullets: [
      "Rolled out OpenShift ACM and ACS for central policy enforcement, RBAC governance, and security posture across multiple clusters.",
      "Wrote ACM governance policies that catch anomalous resource usage and clean up temporary namespaces automatically.",
      "Built Python and Bash scripts that cross-audit microservice versions between PROD and DR.",
    ],
  },
  {
    company: "IBM",
    role: "DevOps Engineer",
    period: "2022 – 2024",
    location: "Quezon City",
    bullets: [
      "Ran Helm and GitOps deployments for large banking clients and external vendors with zero-downtime releases.",
      "Built Jenkins declarative pipelines for pull request validation, code quality checks, and build analytics.",
      "Trained and supported 300+ project managers, developers, and architects.",
    ],
  },
];

export const projects: Project[] = [
  {
    name: "Homelab cluster",
    summary:
      "Three-node k3s cluster run fully through GitOps: Argo CD syncs every app from Git, and secrets are committed only as Sealed Secrets. Cilium replaced Flannel, ingress-nginx and kube-proxy. Longhorn storage backs up to Cloudflare R2, and apps reach the internet through a Cloudflare Tunnel with cert-manager certificates.",
    stack: "k3s, Argo CD, Cilium, Longhorn, Sealed Secrets, cert-manager, kube-prometheus-stack, n8n",
  },
  {
    name: "MeetRec",
    summary:
      "macOS menu bar app that records Teams meetings, shows live English captions for Lebanese Arabic, and writes a transcript and minutes afterwards. Transcription runs locally with whisper.cpp; an offline mode sends nothing to an outside service.",
    stack: "Swift, whisper.cpp, ffmpeg, Claude",
  },
  {
    name: "Istio canary on Kind",
    summary:
      "Local lab for canary releases: a Spring Boot app on Kind behind an Istio gateway with HTTPS, splitting traffic 80/20 between v1 and v2. A GitHub webhook triggers the Jenkins pipeline that builds and deploys it.",
    stack: "Kind, Istio, Jenkins, Docker, Java",
  },
  {
    name: "This site",
    summary:
      "Astro on Vercel with a canvas game over plain HTML. The CV download is gated by Cloudflare Turnstile and streamed from a private Blob store. The visitor counter is one atomic Redis script on Upstash with per-IP limits and no personal data stored. Strict security headers and CSP.",
    stack: "Astro, TypeScript, Vercel, Upstash Redis, Turnstile",
    href: "https://github.com/jayveecelestial/jayveecelestial.com",
  },
];

export const certs: Cert[] = [
  { name: "Red Hat Certified Engineer in OpenShift", date: "2026" },
  { name: "Advanced System Administrator in OpenShift", code: "EX380", date: "2026" },
  { name: "OpenShift Advanced Cluster Security", code: "EX430", date: "2026" },
  { name: "Technologist in OpenShift", code: "EX180", date: "2026" },
  { name: "OpenShift Advanced Cluster Management", code: "EX432", date: "2025" },
  { name: "System Administrator in OpenShift", code: "EX280", date: "2025" },
  { name: "Developer in Cloud-native Applications", code: "EX188", date: "2025" },
  { name: "AWS Certified Cloud Practitioner", date: "2026" },
];

export const skills: Skill[] = [
  { label: "Platforms", items: "OpenShift, Kubernetes, k3s, Docker, Podman" },
  { label: "Cluster ops", items: "ACM, ACS, multi-cluster governance, RBAC" },
  { label: "Delivery", items: "ArgoCD, Helm, Jenkins, Nexus, GitLab CI, GitHub Actions" },
  { label: "Automation", items: "Ansible, Terraform, Control-M" },
  { label: "Linux", items: "RHEL, Ubuntu, SELinux, ingress-nginx, Tailscale" },
  { label: "Code", items: "Python, Bash, Java" },
  { label: "AI", items: "Claude and OpenAI APIs, LangChain, RAG, ChromaDB" },
  { label: "Cloud", items: "AWS, Azure" },
];

export const description = "Senior DevOps engineer in Riyadh. I build and run OpenShift and Kubernetes platforms. Red Hat Certified Engineer in OpenShift.";

export const stats = [
  { value: "5+ yrs", label: "DevOps" },
  { value: String(certs.length), label: "certs" },
  { value: "eMcREY", label: "Current" },
];

export const offDuty = {
  text: "Plays Apex Legends",
  links: [{ label: "Twitch", handle: "twitch.tv/boicoldbrew", href: "https://www.twitch.tv/boicoldbrew" }],
};
