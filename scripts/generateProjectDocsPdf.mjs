import fs from "fs";
import path from "path";
import { jsPDF } from "jspdf";

const rootDir = process.cwd();
const docsDir = path.join(rootDir, "docs");

function createDoc() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 6;
  let y = margin;

  function ensureSpace(lines = 1) {
    if (y + lines * lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function title(text) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    ensureSpace(2);
    doc.text(text, margin, y);
    y += 10;
  }

  function subtitle(text) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(text, maxWidth);
    ensureSpace(lines.length + 1);
    doc.text(lines, margin, y);
    y += lines.length * lineHeight + 2;
  }

  function heading(text) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    ensureSpace(2);
    doc.text(text, margin, y);
    y += 7;
  }

  function paragraph(text) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(text, maxWidth);
    ensureSpace(lines.length + 1);
    doc.text(lines, margin, y);
    y += lines.length * lineHeight + 1;
  }

  function bullets(items) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    for (const item of items) {
      const wrapped = doc.splitTextToSize(`- ${item}`, maxWidth);
      ensureSpace(wrapped.length + 1);
      doc.text(wrapped, margin, y);
      y += wrapped.length * lineHeight;
    }
    y += 1;
  }

  function tableRows(rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const [left, right] of rows) {
      const text = `${left}: ${right}`;
      const wrapped = doc.splitTextToSize(text, maxWidth);
      ensureSpace(wrapped.length + 1);
      doc.text(wrapped, margin, y);
      y += wrapped.length * lineHeight;
    }
    y += 1;
  }

  return { doc, title, subtitle, heading, paragraph, bullets, tableRows };
}

function writePdf(doc, filename) {
  fs.mkdirSync(docsDir, { recursive: true });
  const outputPath = path.join(docsDir, filename);
  const arrayBuffer = doc.output("arraybuffer");
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
  return outputPath;
}

function buildProjectDocumentation() {
  const { doc, title, subtitle, heading, paragraph, bullets, tableRows } = createDoc();
  const dateText = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  title("FarmTrack Project Documentation");
  subtitle(`Version: 1.0 | Generated: ${dateText}`);

  heading("1. Project Overview");
  paragraph(
    "FarmTrack is a web-based farming management platform built with React and Firebase. It supports farm setup, crop lifecycle tracking, field monitoring, weather views, user administration, and report export. A backend Express service provides AI assistant responses using Gemini as primary provider with Ollama fallback."
  );

  heading("2. Technology Stack");
  bullets([
    "Frontend: React 19, Vite 7, React Router, Recharts, React Leaflet.",
    "Backend API: Node.js + Express.",
    "Database and Auth: Firebase Firestore and Firebase Authentication.",
    "AI Integration: Gemini API (recommended) with optional Ollama local fallback.",
    "Utilities: PapaParse (CSV), jsPDF/html2canvas (PDF/reporting), ESLint.",
  ]);

  heading("3. Repository Structure");
  bullets([
    "src/components: Shared UI shell and assistant floating chat widget.",
    "src/features/auth: Login, signup, email verification, auth guards.",
    "src/features/farms: Farm creation and map/location features.",
    "src/features/crops: Dashboard, crop creation/details, monitoring, history, projection, analytics.",
    "src/features/reports: Report generation and export.",
    "src/features/users: User list, detail view, role/activation management.",
    "src/features/weather: Weather dashboards and alerts.",
    "server/index.js: Assistant API service.",
  ]);

  heading("4. Route Map");
  tableRows([
    ["/", "Landing page"],
    ["/login", "Login page"],
    ["/signup", "Signup page"],
    ["/verify-email", "Email verification flow"],
    ["/account-pending", "Approval pending page"],
    ["/app", "Protected application shell and dashboard"],
    ["/app/farms/new", "Add farm"],
    ["/app/crops/new", "Add crop"],
    ["/app/crops/:id", "Crop detail"],
    ["/app/monitoring", "Monitoring hub"],
    ["/app/history/:type", "History records by type"],
    ["/app/projection", "Farm projection"],
    ["/app/fields/analytics", "Field analytics"],
    ["/app/reports", "Reports and export"],
    ["/app/weather", "Weather page"],
    ["/app/users", "Users management (admin UI visibility)"],
    ["/app/profile", "Profile page"],
  ]);

  heading("5. Data Model Summary");
  bullets([
    "users/{uid}: profile metadata including isAdmin and isActive flags.",
    "users/{uid}/fields/{farmId}: farm-level structure.",
    "users/{uid}/fields/{farmId}/seasons/{seasonId}: season and crop state.",
    "users/{uid}/notifications/{notificationId}: in-app notifications.",
    "Some components read both users and Users collections for compatibility.",
  ]);

  heading("6. Environment Configuration");
  paragraph("Create or update .env at project root. Main variables:");
  tableRows([
    ["GEMINI_API_KEY", "Gemini API key (if set, Gemini is used)"],
    ["GEMINI_MODEL", "Gemini model id, default gemini-2.5-flash"],
    ["OLLAMA_BASE_URL", "Ollama host for local fallback"],
    ["OLLAMA_MODEL", "Ollama model name"],
    ["PORT", "Assistant API port (default in this project: 8793)"],
    ["VITE_ASSISTANT_API_URL", "Optional frontend override when API is remote"],
  ]);

  heading("7. Running the Project");
  bullets([
    "Install dependencies: npm install",
    "Start frontend only: npm run dev",
    "Start API only: npm run api",
    "Start both frontend and API: npm run dev:all",
    "Build production bundle: npm run build",
    "Preview production build: npm run preview",
  ]);

  heading("8. Assistant API Endpoints");
  tableRows([
    ["GET /api/health", "Status, provider, model, and timestamp"],
    ["POST /api/assistant", "Generates AI response from prompt + farm context payload"],
  ]);

  heading("9. Security and Access Notes");
  bullets([
    "Authentication is required for /app routes.",
    "UI now gates Add Farm, Add Crop, and Users buttons by isAdmin status.",
    "Email verification is enforced before entering app shell.",
    "Signup sets isAdmin false and isActive false by default.",
    "Use Firestore Security Rules to enforce role permissions server-side.",
  ]);

  heading("10. Known Operational Notes");
  bullets([
    "Keep frontend and API running together for full assistant functionality.",
    "If Gemini is unavailable, API falls back to Ollama when configured.",
    "If role flags do not appear, verify user document exists in users collection.",
    "Large JS chunks appear in production build warning; consider code splitting.",
  ]);

  heading("11. Maintenance Checklist");
  bullets([
    "Review and rotate API keys periodically.",
    "Validate Firestore indexes and security rules after schema changes.",
    "Re-test signup, verification, admin role visibility, and report export after releases.",
    "Regenerate this PDF after major route, model, or environment changes.",
  ]);

  return doc;
}

function buildUserManual() {
  const { doc, title, subtitle, heading, paragraph, bullets, tableRows } = createDoc();
  const dateText = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  title("FarmTrack User Manual");
  subtitle(`Version: 1.0 | Generated: ${dateText}`);

  heading("1. Purpose");
  paragraph(
    "This manual explains how to use FarmTrack for daily farm operations, including account setup, adding farms and crops, monitoring field activity, reading analytics, and exporting reports."
  );

  heading("2. Account Setup");
  bullets([
    "Open the app and select Sign Up.",
    "Enter full name, email, and password.",
    "Check email and complete verification.",
    "Sign in and wait for account approval if your organization requires activation.",
  ]);

  heading("3. Login and Navigation");
  bullets([
    "Use Login with your registered email/password.",
    "After login, the sidebar shows dashboard, monitoring, histories, projection, weather, reports, profile, and users (admin only).",
    "Use the top-right Logout button to end your session.",
  ]);

  heading("4. Dashboard Workflow");
  bullets([
    "Review top metrics: farms count, active crops, harvest in 14 days, cycle progress, and overdue harvest.",
    "Open farm cards to inspect current crop stage and timing.",
    "Open field analytics links for deeper health indicators.",
    "Use action buttons for Add Farm/Add Crop/Users when your role is admin.",
  ]);

  heading("5. Add a Farm (Admin)");
  bullets([
    "Go to Add Farm.",
    "Enter farm name, location, code, and size in hectares.",
    "Use map picker if location coordinates are needed.",
    "Save and confirm farm appears on dashboard.",
  ]);

  heading("6. Add a Crop (Admin)");
  bullets([
    "Go to Add Crop and select the target farm.",
    "Enter crop name, planting date, expected harvest, and cycle duration.",
    "Provide field size hectares to support projection and capacity checks.",
    "Save and verify crop appears in dashboard analytics.",
  ]);

  heading("7. Monitoring Forms");
  bullets([
    "Open Monitoring to record soil, growth, irrigation, pest, and fumigation data.",
    "Submit updates regularly to keep analytics current.",
    "Use history pages to review all records by category.",
  ]);

  heading("8. Projection and Analytics");
  bullets([
    "Projection shows occupied vs free hectares by farm.",
    "Field analytics provides soil, weather, growth, water, pest, and overall health indices.",
    "Use these views for planning input allocation and harvest windows.",
  ]);

  heading("9. Weather and Alerts");
  bullets([
    "Open Weather for current and forecast conditions.",
    "Check alert panels before irrigation, spraying, and harvest operations.",
    "Adjust field operations when high-risk weather is expected.",
  ]);

  heading("10. Reports and Export");
  bullets([
    "Open Reports to view summary cards and trend data.",
    "Export CSV for spreadsheet analysis.",
    "Export PDF for management sharing and archive records.",
  ]);

  heading("11. AI Farming Assistant");
  bullets([
    "Click AI Chat (floating button).",
    "Ask focused questions on stage management, irrigation, pests, weather, or reporting.",
    "If backend is unreachable, assistant returns offline fallback guidance.",
  ]);

  heading("12. User Administration (Admin)");
  bullets([
    "Open Users to view registered accounts.",
    "Activate/deactivate accounts as needed.",
    "Promote or demote admin role where authorized by policy.",
  ]);

  heading("13. Troubleshooting");
  tableRows([
    ["Cannot login", "Verify email/password and internet connection."],
    ["Stuck on verification", "Complete email verification, then login again."],
    ["No Add Farm/Add Crop buttons", "Your account is not admin."],
    ["AI assistant unavailable", "Run API server and verify .env provider settings."],
    ["No data in analytics", "Ensure farms, crops, and monitoring records exist."],
  ]);

  heading("14. Best Practices");
  bullets([
    "Record monitoring data consistently (daily or scheduled intervals).",
    "Keep crop dates and field sizes accurate for reliable projections.",
    "Use reports weekly to detect risk trends early.",
    "Limit admin rights to trusted operators only.",
  ]);

  return doc;
}

const projectDoc = buildProjectDocumentation();
const manualDoc = buildUserManual();

const projectPath = writePdf(projectDoc, "FarmTrack-Project-Documentation.pdf");
const manualPath = writePdf(manualDoc, "FarmTrack-User-Manual.pdf");

console.log(`Generated: ${projectPath}`);
console.log(`Generated: ${manualPath}`);
