export interface Link { label: string; href: string; cv?: boolean }
export interface Job { company: string; role: string; period: string; location: string; bullets: string[] }
export interface Cert { name: string; code?: string; date: string }
export interface Skill { label: string; items: string }

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
