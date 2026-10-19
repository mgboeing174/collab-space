# CollabSpace — Real-Time Collaborative Workspace

**CollabSpace** is a full-stack digital workspace where distributed teams collaborate on documents, brainstorm on interactive whiteboards, and work together in real-time without overwriting each other's contributions.

Designed with a strict **black, white, and neutral grayscale visual identity**, CollabSpace delivers a distraction-free, professional productivity experience.

---

## Key Capabilities

### 1. Distinctive Minimalist Aesthetic
- **Controlled Grayscale Palette**: Off-white and white surfaces, black typography, charcoal panels, and subtle borders (`#111111`, `#333333`, `#666666`, `#cccccc`, `#fafafa`).
- **Professional SVG Icons**: Powered by Lucide icons; zero neon colors, zero emojis, zero glassmorphism blobs.
- **Predictable Layouts**: Optimized for desktop and tablet workflows, with responsive mobile fallbacks.

### 2. Authentication & Workspace Management
- Secure JWT token-based authentication with bcrypt password hashing.
- Role-based access control (**Owner**, **Admin**, **Member**, **Viewer**).
- Multi-workspace switcher: create, switch, and join workspaces.
- Shareable invitation links and direct workspace codes.
- Project & folder organization for documents and whiteboards.

### 3. Section-Based Collaborative Document Editor
Section isolation guarantees that multiple teammates can edit the same document without conflicting overwrites:
- **Structural Templates**:
  - `Header → Body → Footer`
  - `Header → Subheading → Content → Footer`
  - `Meeting Notes` (Overview, Discussion, Decisions, Action Items)
  - `Project Proposal` (Abstract, Goals, Technical Solution, Timeline, Risks)
  - `Task Report` (Summary, Implementation, Blockers, Verification)
  - `Research Document` (Abstract, Prior Art, Methodology, Findings, Conclusion)
  - `Custom Template`
- **Section Ownership & Concurrency**:
  - Assign individual sections to specific teammates with visible avatar tags.
  - Section claiming: collaborators claim a lock before editing.
  - Lock indicators: clear visual cue and readonly mode when another collaborator is editing.
  - Safe lock heartbeats (25s intervals) and automatic 60s lease expiry on disconnect.
  - Optimistic revision checking prevents stale saves with HTTP 423/409 safety guards.
- **Rich Text Formatting**: Headings (H1–H3), bold, italic, strikethrough, bullet & ordered lists, blockquotes, code blocks, links.
- **Autosave & Status**: Debounced auto-save with instant confirmation indicators.
- **Version History & Rollback**: Create milestone snapshots and restore to any previous version with auto-backup safety.

### 4. Real-Time Collaborative Whiteboard
- Interactive vector canvas powered by SVG & HTML5 Canvas.
- **Tools**: Freehand pen, Rectangle, Circle, Diamond, Straight Line, Connecting Arrow, Text Box, Sticky Notes, Eraser, Select/Move.
- **Grayscale Palette**: Black, Charcoal, Slate, Neutral Gray, Light Gray, White.
- **Stroke Weights**: Thin (1px), Normal (2px), Thick (4px), Bold (6px).
- **Infinite Feel**: Pan canvas (hand tool or middle drag) & Zoom (35% to 250%, Reset).
- **Undo / Redo**: 25-level action stack.
- **Multi-User Live Cursors**: Live pointer tags showing other teammates moving in real time.
- **Exporting**: Instant export to SVG vector format.
- **Persistent Data**: Changes persist in the backend database across page reloads.

### 5. Collaboration Infrastructure
- Powered by Node.js, Express, Socket.IO, and SQLite with WAL mode.
- Live section edits broadcasted to document rooms (`doc:<id>`).
- Live whiteboard element additions, updates, deletions, and cursor streams (`board:<id>`).
- Real-time online presence strip showing active teammates.
- Real-time workspace activity audit feed.
- Workspace-wide search across documents, section contents, and whiteboards.

---

## Technical Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 5, React Router 6, Socket.IO Client, Lucide Icons |
| **Backend** | Node.js (v24), Express.js, Socket.IO Server, JWT, Bcrypt |
| **Database** | SQLite with WAL mode via Node's native `DatabaseSync` (zero C++ compilation issues) |
| **Styling** | Custom CSS variables with strict black/white/grayscale design system |

---

## Getting Started

### 1. Prerequisites
- Node.js (v18+) and npm

### 2. Install Dependencies
```bash
# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

### 3. Run CollabSpace

#### Running the Full-Stack App (Unified on Port 5000):
```bash
# From root directory:
npm start
```
Then visit **`http://localhost:5000`** in your browser.

#### Running in Development Mode (with Vite Hot Reload):
```bash
# Terminal 1: Backend API & WebSockets (Port 5000)
npm run server

# Terminal 2: React Vite Dev Server (Port 5173)
npm run client
```
Then visit **`http://localhost:5173`**.

---

## Verification & Testing

CollabSpace includes a complete end-to-end integration test suite verifying user registration, multi-user joining via invite codes, template instantiation, section assignment, concurrency lock rejection, version restoration, and whiteboard persistence:

```bash
node test-collabspace.js
```

---

## License
MIT
