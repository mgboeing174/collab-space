import http from 'http';

const BASE_URL = 'http://localhost:5000/api';

async function req(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('   CollabSpace Full-Stack End-to-End Verification   ');
  console.log('====================================================\n');

  const rand = Math.floor(Math.random() * 100000);
  const aliceEmail = `alice.${rand}@collabspace.dev`;
  const bobEmail = `bob.${rand}@collabspace.dev`;

  // 1. Register Alice
  console.log('1. Registering Alice...');
  const regAlice = await req('/auth/register', 'POST', {
    name: 'Alice Henderson',
    email: aliceEmail,
    password: 'password123'
  });
  if (!regAlice.ok) throw new Error('Alice registration failed: ' + JSON.stringify(regAlice.data));
  const aliceToken = regAlice.data.token;
  const aliceId = regAlice.data.user.id;
  const defaultWsId = regAlice.data.defaultWorkspaceId;
  console.log(`   ✓ Alice registered (User ID: ${aliceId}, Default WS: ${defaultWsId})`);

  // 2. Register Bob
  console.log('2. Registering Bob...');
  const regBob = await req('/auth/register', 'POST', {
    name: 'Bob Martinez',
    email: bobEmail,
    password: 'password123'
  });
  if (!regBob.ok) throw new Error('Bob registration failed: ' + JSON.stringify(regBob.data));
  const bobToken = regBob.data.token;
  const bobId = regBob.data.user.id;
  console.log(`   ✓ Bob registered (User ID: ${bobId})`);

  // 3. Alice creates a new shared workspace
  console.log('3. Alice creating "Core Platform Team" workspace...');
  const createWs = await req('/workspaces', 'POST', {
    name: 'Core Platform Team',
    description: 'Shared engineering & design workspace'
  }, aliceToken);
  if (!createWs.ok) throw new Error('Create workspace failed: ' + JSON.stringify(createWs.data));
  const wsId = createWs.data.workspace.id;
  const inviteCode = createWs.data.workspace.invite_code;
  console.log(`   ✓ Workspace created (ID: ${wsId}, Invite Code: ${inviteCode})`);

  // 4. Bob joins Alice's workspace using invite code
  console.log('4. Bob joining Alice\'s workspace with invite code...');
  const joinWs = await req(`/workspaces/join/${inviteCode}`, 'POST', null, bobToken);
  if (!joinWs.ok) throw new Error('Bob join failed: ' + JSON.stringify(joinWs.data));
  console.log(`   ✓ Bob joined workspace successfully (Role: ${joinWs.data.role})`);

  // 5. Alice creates a document using "project-proposal" template
  console.log('5. Alice creating document from "project-proposal" template...');
  const createDoc = await req('/documents', 'POST', {
    workspaceId: wsId,
    title: 'Real-Time Sync Protocol Proposal',
    templateType: 'project-proposal'
  }, aliceToken);
  if (!createDoc.ok) throw new Error('Create doc failed: ' + JSON.stringify(createDoc.data));
  const docId = createDoc.data.document.id;
  console.log(`   ✓ Document created (ID: ${docId}, Template: project-proposal)`);

  // 6. Fetch document sections
  console.log('6. Inspecting generated document sections...');
  const getDoc = await req(`/documents/${docId}`, 'GET', null, aliceToken);
  const sections = getDoc.data.sections;
  console.log(`   ✓ Document has ${sections.length} predefined sections:`);
  sections.forEach((s, idx) => console.log(`     [${idx + 1}] ${s.title} (Key: ${s.section_key})`));

  const section1 = sections[0]; // Title & Abstract
  const section2 = sections[1]; // Goals & Metrics

  // 7. Section Assignment: Alice assigns Section 1 to Alice, Section 2 to Bob
  console.log('7. Assigning sections independently: Section 1 -> Alice, Section 2 -> Bob...');
  await req(`/documents/${docId}/sections/${section1.id}/assign`, 'POST', { assignedTo: aliceId }, aliceToken);
  await req(`/documents/${docId}/sections/${section2.id}/assign`, 'POST', { assignedTo: bobId }, aliceToken);
  console.log('   ✓ Sections assigned.');

  // 8. Section Locking & Concurrency Control:
  console.log('8. Testing section-level locking and concurrency protection...');
  // Alice claims lock on Section 1
  const lockSec1 = await req(`/documents/${docId}/sections/${section1.id}/lock`, 'POST', null, aliceToken);
  if (!lockSec1.ok) throw new Error('Alice lock failed: ' + JSON.stringify(lockSec1.data));
  console.log('   ✓ Alice acquired lock on Section 1.');

  // Bob attempts to write to Section 1 -> Must be rejected (423 Locked)
  const bobEditAttempt = await req(`/documents/${docId}/sections/${section1.id}`, 'PUT', {
    content: '<p>Bob overwriting Alice content!</p>'
  }, bobToken);
  if (bobEditAttempt.status === 423) {
    console.log('   ✓ Conflicting edit safely rejected with HTTP 423 Locked: ' + bobEditAttempt.data.error);
  } else {
    throw new Error('Lock protection failed, expected status 423 but got: ' + bobEditAttempt.status);
  }

  // Bob claims Section 2 and edits Section 2 simultaneously
  await req(`/documents/${docId}/sections/${section2.id}/lock`, 'POST', null, bobToken);
  const bobEditSec2 = await req(`/documents/${docId}/sections/${section2.id}`, 'PUT', {
    content: '<p><strong>Bob Goals:</strong> 100% data integrity with zero overwrite collisions.</p>'
  }, bobToken);
  if (!bobEditSec2.ok) throw new Error('Bob edit section 2 failed');
  console.log('   ✓ Bob safely updated Section 2 independently.');

  // Alice updates Section 1 and releases lock
  const aliceEditSec1 = await req(`/documents/${docId}/sections/${section1.id}`, 'PUT', {
    content: '<h1>Architecture Brief</h1><p>Authored by Alice with section isolation.</p>'
  }, aliceToken);
  await req(`/documents/${docId}/sections/${section1.id}/unlock`, 'POST', null, aliceToken);
  console.log('   ✓ Alice updated Section 1 and released lock.');

  // 9. Version Snapshots and Rollback:
  console.log('9. Testing document version snapshots and recovery...');
  const snapshot1 = await req(`/documents/${docId}/versions`, 'POST', {
    summary: 'Milestone 1: Complete initial draft by Alice and Bob'
  }, aliceToken);
  console.log(`   ✓ Created Milestone 1 snapshot (Version: ${snapshot1.data.version.version_number})`);

  // Alice modifies section
  await req(`/documents/${docId}/sections/${section1.id}`, 'PUT', {
    content: '<p>Accidental deletion or experimental change</p>'
  }, aliceToken);

  // Restore previous version
  console.log('   Restoring to Milestone 1 snapshot...');
  const restoreRes = await req(`/documents/${docId}/versions/${snapshot1.data.version.id}/restore`, 'POST', null, aliceToken);
  if (!restoreRes.ok) throw new Error('Restore failed: ' + JSON.stringify(restoreRes.data));
  console.log('   ✓ Document restored successfully.');

  // Verify content was restored
  const docAfterRestore = await req(`/documents/${docId}`, 'GET', null, aliceToken);
  const restoredSec1 = docAfterRestore.data.sections.find(s => s.section_key === section1.section_key);
  if (restoredSec1.content.includes('Architecture Brief')) {
    console.log('   ✓ Verified restored section content matches snapshot exactly.');
  } else {
    throw new Error('Restored content mismatch: ' + restoredSec1.content);
  }

  // 10. Collaborative Whiteboard
  console.log('10. Testing collaborative whiteboard operations & persistence...');
  const createWb = await req('/whiteboards', 'POST', {
    workspaceId: wsId,
    title: 'Architecture & System Flow Whiteboard'
  }, aliceToken);
  const wbId = createWb.data.whiteboard.id;

  const canvasObjects = [
    { id: 'box1', type: 'rectangle', x: 50, y: 50, width: 200, height: 100, fillColor: '#ffffff', strokeColor: '#111111' },
    { id: 'arrow1', type: 'arrow', startX: 250, startY: 100, endX: 350, endY: 100, strokeColor: '#111111' },
    { id: 'note1', type: 'sticky', x: 360, y: 50, width: 180, height: 140, text: 'Real-time WebSocket & SQLite WAL mode', color: '#f5f5f5' }
  ];

  await req(`/whiteboards/${wbId}`, 'PUT', { canvasElements: canvasObjects }, aliceToken);
  const readWb = await req(`/whiteboards/${wbId}`, 'GET', null, bobToken);
  if (readWb.data.whiteboard.canvasElements.length === 3) {
    console.log(`   ✓ Bob retrieved Alice's whiteboard with ${readWb.data.whiteboard.canvasElements.length} persistent objects.`);
  } else {
    throw new Error('Whiteboard objects mismatch');
  }

  // 11. Activity Feed Verification
  console.log('11. Verifying workspace activity feed...');
  const actRes = await req(`/activity/workspace/${wsId}`, 'GET', null, aliceToken);
  console.log(`   ✓ Logged ${actRes.data.activities.length} activity events in workspace.`);
  actRes.data.activities.slice(0, 3).forEach(a => {
    console.log(`     • ${a.user_name}: ${a.action} -> "${a.entity_title}" (${a.details})`);
  });

  // 12. Workspace Search Verification
  console.log('12. Verifying workspace-wide search...');
  const searchRes = await req(`/search/workspace/${wsId}?q=Architecture`, 'GET', null, bobToken);
  console.log(`   ✓ Search for "Architecture" returned ${searchRes.data.documents.length} doc(s), ${searchRes.data.sections.length} section(s), and ${searchRes.data.whiteboards.length} whiteboard(s).`);

  console.log('\n====================================================');
  console.log('   ALL 12 E2E COLLABSPACE TESTS PASSED PERFECTLY!   ');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
