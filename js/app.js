// ============================================================
// SPLIT UP — MAIN APP JS
// Core Splitwise features + 8 Differentiator features
// Supports real Firebase Auth & Firestore + Instant Demo Fallback
// ============================================================

import {
  isDemoMode, auth, db, googleProvider,
  onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile,
  collection, doc, setDoc, addDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, limit, serverTimestamp
} from './firebase-config.js';

// ============================================================
// DEMO MOCK STORE PROVIDER (Local-First fallback)
// ============================================================
const DEMO_STORAGE_KEY = 'splitup_prod_db_v5';

function getDemoInitialData() {
  return {
    users: {},
    groups: [],
    expenses: [],
    polls: []
  };
}

function loadDemoDb() {
  const raw = localStorage.getItem(DEMO_STORAGE_KEY);
  if (!raw) {
    const data = getDemoInitialData();
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
    return data;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.groups) parsed.groups = [];
    if (!parsed.expenses) parsed.expenses = [];
    if (!parsed.polls) parsed.polls = [];
    if (!parsed.users) parsed.users = {};
    return parsed;
  } catch (e) {
    return getDemoInitialData();
  }
}

function saveDemoDb(data) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
}

// ============================================================
// STATE & APP CONSTANTS
// ============================================================
let activeDemoSession = false;
let currentUser = null;
let userProfile = {};
let groups = [];
let expenses = [];
let currentGroupId = null;
let pendingMembers = [];
let currentFilter = 'all';
let currentSplitMethod = 'equal';
let currentCategory = 'food';
let currentMood = 'worth-it';
let currentGroupType = 'trip';
let settleTarget = null;
let currentPolls = {};
let parsedReceiptItems = [];

// ============================================================
// UTILITY HELPERS
// ============================================================
const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

function formatAmount(amount, currency = 'INR') {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym}${parseFloat(amount || 0).toFixed(2)}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning ☀️';
  if (h < 17) return 'Good afternoon 🌤';
  if (h < 21) return 'Good evening 🌅';
  return 'Good night 🌙';
}

function timeAgo(ts) {
  if (!ts) return 'just now';
  let date;
  if (ts.toDate) date = ts.toDate();
  else if (typeof ts === 'string' || typeof ts === 'number') date = new Date(ts);
  else if (ts.seconds) date = new Date(ts.seconds * 1000);
  else date = new Date();

  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function showToast(msg, type = 'info', duration = 2800) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast hidden'; }, duration);
}

function openModal(id) {
  const m = $(id);
  if (m) m.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const m = $(id);
  if (m) m.classList.add('hidden');
  document.body.style.overflow = '';
}

function addBounce(btn) {
  if (!btn) return;
  btn.classList.add('anim-bounce');
  btn.addEventListener('animationend', () => btn.classList.remove('anim-bounce'), { once: true });
}

function addRipple(btn, e) {
  if (!btn) return;
  btn.classList.add('ripple-container');
  const r = document.createElement('span');
  r.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  r.style.left = `${(e?.clientX || 0) - rect.left}px`;
  r.style.top = `${(e?.clientY || 0) - rect.top}px`;
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove(), { once: true });
}

function getUserInitial(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getGroupEmoji(type) {
  const map = { trip: '✈️', home: '🏠', friends: '👯', other: '📦' };
  return map[type] || '📦';
}

function getCategoryEmoji(cat) {
  const map = {
    food: '🍕', transport: '🚗', home: '🏠', trip: '✈️',
    fun: '🎉', treat: '🧁', health: '💊', other: '📦'
  };
  return map[cat] || '📦';
}

function getUserPreferredCurrency() {
  return userProfile.currency || 'INR';
}

// ============================================================
// CONFETTI 🎉
// ============================================================
function launchConfetti() {
  const canvas = $('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#FF5C8A', '#FFD6E8', '#B8F2D0', '#FFB4A2', '#E8D5FF', '#FFD700', '#FF8CB4'];
  const particles = Array.from({ length: 110 }, () => ({
    x: Math.random() * canvas.width,
    y: -10,
    r: Math.random() * 6 + 3,
    d: Math.random() * 120 + 20,
    color: colors[Math.floor(Math.random() * colors.length)],
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltAngleInc: Math.random() * 0.07 + 0.05,
    vx: Math.random() * 3 - 1.5,
    vy: Math.random() * 3 + 2.2,
    shape: Math.random() > 0.5 ? 'circle' : 'rect'
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.tiltAngle += p.tiltAngleInc;
      p.y += p.vy;
      p.x += p.vx;
      p.tilt = Math.sin(p.tiltAngle) * 12;

      ctx.beginPath();
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tiltAngle);
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 1.5);
        ctx.restore();
      }
      ctx.fill();
    });
    frame++;
    if (frame < 140) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// ============================================================
// NAVIGATION
// ============================================================
const pageOrder = ['home', 'groups', 'add', 'activity'];

function navigateTo(pageId) {
  const currentPage = qs('.page.active');
  const currentIdx = pageOrder.indexOf(currentPage?.id.replace('page-', ''));
  const targetIdx = pageOrder.indexOf(pageId);

  qsa('.page').forEach(p => {
    p.classList.remove('active', 'slide-left', 'slide-right');
    p.style.display = 'none';
  });

  const target = $(`page-${pageId}`);
  if (!target) return;
  target.style.display = 'block';
  target.classList.add('active');

  if (targetIdx > currentIdx) target.classList.add('slide-right');
  else if (targetIdx < currentIdx) target.classList.add('slide-left');

  qsa('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  if (pageId === 'home') renderHome();
  if (pageId === 'groups') renderGroups();
  if (pageId === 'activity') renderActivity();
  if (pageId === 'add') populateExpenseForm();
}

function formatNameFromEmail(email) {
  if (!email || !email.includes('@')) return 'Friend';
  const prefix = email.split('@')[0];
  const formatted = prefix
    .split(/[._\-+]/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return formatted || prefix;
}

// ============================================================
// AUTH & DEMO LOGIN
// ============================================================
function initAuthListeners() {
  $('show-signup')?.addEventListener('click', () => {
    $('login-form').classList.add('hidden');
    $('signup-form').classList.remove('hidden');
  });

  $('show-login')?.addEventListener('click', () => {
    $('signup-form').classList.add('hidden');
    $('login-form').classList.remove('hidden');
  });

  // Instant Demo Login
  $('demo-login-btn')?.addEventListener('click', () => {
    const inputName = $('login-name')?.value.trim();
    const email = $('login-email')?.value.trim() || 'user@example.com';
    const name = inputName || formatNameFromEmail(email) || 'Demo User';
    activateDemoSession(email, name);
  });

  // Email Sign In
  $('login-btn')?.addEventListener('click', async () => {
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    const inputName = $('login-name')?.value.trim();
    if (!email || !password) { showToast('Please fill in all fields 🌸', 'error'); return; }

    const name = inputName || formatNameFromEmail(email);

    if (isDemoMode || !auth) {
      activateDemoSession(email, name);
      return;
    }

    $('login-btn').disabled = true;
    $('login-btn').textContent = 'Signing in...';
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (inputName && cred.user) {
        await updateProfile(cred.user, { displayName: inputName });
      }
    } catch (err) {
      showToast(friendlyAuthError(err.code), 'error');
      $('login-btn').disabled = false;
      $('login-btn').textContent = 'Sign In 💌';
    }
  });

  // Email Sign Up
  $('signup-btn')?.addEventListener('click', async () => {
    const name = $('signup-name').value.trim();
    const email = $('signup-email').value.trim();
    const password = $('signup-password').value;

    if (!name || !email || !password) { showToast('Please fill in all fields 🌸', 'error'); return; }
    if (password.length < 6) { showToast('Password must be 6+ characters 🔒', 'error'); return; }

    if (isDemoMode || !auth) {
      activateDemoSession(email, name);
      return;
    }

    $('signup-btn').disabled = true;
    $('signup-btn').textContent = 'Creating account...';
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await createUserProfile(cred.user, name);
    } catch (err) {
      showToast(friendlyAuthError(err.code), 'error');
      $('signup-btn').disabled = false;
      $('signup-btn').textContent = 'Create Account 🎉';
    }
  });

  // Google Sign In
  $('google-login-btn')?.addEventListener('click', async () => {
    const inputName = $('login-name')?.value.trim();
    if (isDemoMode || !auth) {
      activateDemoSession('google_friend@example.com', inputName || 'Google Friend');
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) await createUserProfile(user, inputName || user.displayName || 'Friend');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast(friendlyAuthError(err.code), 'error');
      }
    }
  });
}

function friendlyAuthError(code) {
  const map = {
    'auth/invalid-email': 'That email doesn\'t look right 📧',
    'auth/user-not-found': 'No account with that email 🔍',
    'auth/wrong-password': 'Wrong password — try again 🔒',
    'auth/email-already-in-use': 'That email is already taken 🌸',
    'auth/weak-password': 'Password needs to be stronger 💪',
    'auth/network-request-failed': 'Network issue — check connection 📡',
    'auth/too-many-requests': 'Too many attempts — try later 🛑',
  };
  return map[code] || 'Something went wrong 😔 Try again!';
}

async function createUserProfile(user, name) {
  if (isDemoMode || !db) return;
  const displayName = name || user.displayName || formatNameFromEmail(user.email) || 'Friend';
  const avatarInitial = getUserInitial(displayName);
  const profileData = {
    uid: user.uid,
    name: displayName,
    email: user.email,
    avatarInitial,
    currency: 'INR',
    streak: 0,
    lastSettledAt: null,
    totalExpenses: 0,
    createdAt: serverTimestamp()
  };
  await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
}

function activateDemoSession(email, name) {
  activeDemoSession = true;
  const displayName = name || formatNameFromEmail(email) || 'Demo User';
  currentUser = { uid: 'demo_user_1', email: email || 'user@example.com', displayName };
  const dbData = loadDemoDb();
  userProfile = dbData.users['demo_user_1'] || { name: displayName, email: email || 'user@example.com', currency: 'INR', streak: 0, totalExpenses: 0 };
  userProfile.name = displayName;
  userProfile.email = email || 'user@example.com';

  if (!dbData.users) dbData.users = {};
  dbData.users['demo_user_1'] = userProfile;
  saveDemoDb(dbData);

  groups = dbData.groups || [];
  expenses = dbData.expenses || [];
  showApp();
  updateTopBar();
  renderHome();
  hideSplash();
  showToast(`Welcome to Split Up, ${displayName.split(' ')[0]}! ✨`, 'success', 3200);
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadUserData() {
  if (activeDemoSession || isDemoMode || !db) {
    const dbData = loadDemoDb();
    userProfile = dbData.users['demo_user_1'] || { name: currentUser?.displayName || 'Demo User', currency: 'INR', streak: 0, totalExpenses: 0 };
    groups = dbData.groups || [];
    expenses = dbData.expenses || [];
    updateTopBar();
    renderHome();
    checkPendingJoinUrl();
    return;
  }

  try {
    const ref = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      userProfile = snap.data();
    } else {
      const defaultName = currentUser.displayName || formatNameFromEmail(currentUser.email);
      await createUserProfile(currentUser, defaultName);
      userProfile = {
        uid: currentUser.uid,
        name: defaultName,
        email: currentUser.email,
        avatarInitial: getUserInitial(defaultName),
        currency: 'INR',
        streak: 0,
        totalExpenses: 0
      };
    }

    updateTopBar();
    await loadGroups();
    await loadExpenses();
    renderHome();
    checkPendingJoinUrl();
  } catch (err) {
    console.warn("Firestore fallback to local storage:", err);
    activateDemoSession(currentUser.email || 'friend@example.com', currentUser.displayName || 'Friend');
  }
}

function updateTopBar() {
  const name = userProfile.name || currentUser?.displayName || formatNameFromEmail(currentUser?.email) || 'Friend';
  const firstName = name.split(' ')[0];
  if ($('user-avatar')) $('user-avatar').textContent = getUserInitial(name);
  if ($('home-username')) $('home-username').textContent = `Hey, ${firstName}!`;
  if ($('greeting-text')) $('greeting-text').textContent = getGreeting();
  updateSyncStatusBadge();
}

// ============================================================
// GROUPS
// ============================================================
async function loadGroups() {
  if (activeDemoSession || isDemoMode || !db) {
    groups = loadDemoDb().groups || [];
    groups.forEach(g => {
      if (!g.inviteCode) g.inviteCode = generateInviteCode();
    });
    return;
  }
  try {
    const q = query(collection(db, 'groups'), where('members', 'array-contains', currentUser.uid));
    const snap = await getDocs(q);
    groups = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, inviteCode: data.inviteCode || generateInviteCode() };
    });
  } catch (err) {
    console.warn("Error loading groups:", err);
    groups = loadDemoDb().groups || [];
  }
}

function initGroupListeners() {
  ['new-group-btn', 'inline-new-group-btn'].forEach(id => {
    $(id)?.addEventListener('click', () => {
      pendingMembers = [];
      $('group-name-input').value = '';
      if ($('group-desc-input')) $('group-desc-input').value = '';
      $('member-email-input').value = '';
      renderMemberChips();
      currentGroupType = 'trip';
      qsa('.gtype-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'trip'));
      openModal('modal-create-group');
    });
  });

  $('join-group-btn')?.addEventListener('click', () => {
    if ($('join-code-input')) $('join-code-input').value = '';
    openModal('modal-join-group');
  });

  $('submit-join-group-btn')?.addEventListener('click', () => {
    joinGroupByCode($('join-code-input')?.value);
  });

  $('join-code-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); joinGroupByCode(e.target.value); }
  });

  $('see-all-groups')?.addEventListener('click', () => navigateTo('groups'));

  $('group-type-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.gtype-btn');
    if (!btn) return;
    currentGroupType = btn.dataset.type;
    qsa('.gtype-btn').forEach(b => b.classList.toggle('active', b === btn));
  });

  $('add-member-btn')?.addEventListener('click', addMemberEmail);
  $('member-email-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addMemberEmail(); }
  });

  $('create-group-btn')?.addEventListener('click', createGroup);
}

async function joinGroupByCode(inviteCodeInput) {
  const code = (inviteCodeInput || '').trim().toUpperCase();
  if (!code) { showToast('Please enter a 6-character invite code 🔑', 'error'); return; }

  const btn = $('submit-join-group-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Joining...'; }

  try {
    if (activeDemoSession || isDemoMode || !db) {
      const demoDb = loadDemoDb();
      let group = demoDb.groups.find(g => (g.inviteCode || '').toUpperCase() === code);
      if (!group) {
        showToast('No group found with that code 🔍', 'error');
        return;
      }
      if (!group.members) group.members = [currentUser.uid];
      if (!group.members.includes(currentUser.uid)) group.members.push(currentUser.uid);
      if (!group.memberEmails) group.memberEmails = [currentUser.email];
      if (!group.memberEmails.includes(currentUser.email)) group.memberEmails.push(currentUser.email);
      saveDemoDb(demoDb);
      await loadGroups();
      closeModal('modal-join-group');
      showToast(`Joined "${group.name}"! 🎉`, 'success');
      renderGroups();
      renderHome();
      openGroupDetail(group.id);
      return;
    }

    const q = query(collection(db, 'groups'), where('inviteCode', '==', code));
    const snap = await getDocs(q);
    if (snap.empty) {
      showToast('Invalid invite code. Check & try again! 🔍', 'error');
      return;
    }

    const groupDoc = snap.docs[0];
    const groupData = groupDoc.data();

    if (groupData.members && groupData.members.includes(currentUser.uid)) {
      showToast(`You're already in "${groupData.name}"! 😊`, 'info');
      closeModal('modal-join-group');
      openGroupDetail(groupDoc.id);
      return;
    }

    await updateDoc(doc(db, 'groups', groupDoc.id), {
      members: arrayUnion(currentUser.uid),
      memberEmails: arrayUnion(currentUser.email)
    });

    closeModal('modal-join-group');
    showToast(`Welcome to "${groupData.name}"! 🎉`, 'success');
    await loadGroups();
    renderGroups();
    renderHome();
    openGroupDetail(groupDoc.id);
    launchConfetti();
  } catch (err) {
    console.error('Error joining group:', err);
    showToast('Failed to join group 😔 Try again!', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Join Group ✨'; }
  }
}

function addMemberEmail() {
  const inputVal = $('member-email-input').value.trim();
  if (!inputVal) { showToast('Enter a name or email 🌸', 'error'); return; }

  const email = inputVal.includes('@') ? inputVal : `${inputVal.toLowerCase().replace(/\s+/g, '.')}@friend`;

  if (pendingMembers.includes(email)) { showToast('Already added!', 'error'); return; }
  if (email === currentUser?.email) { showToast('You\'re already in the group 😊', 'error'); return; }

  pendingMembers.push(email);
  $('member-email-input').value = '';
  renderMemberChips();
}

function renderMemberChips() {
  const container = $('members-list');
  if (!container) return;
  const myName = userProfile.name || currentUser?.displayName || 'Soumya';
  const creatorChip = `<span class="member-chip" style="background: var(--pink-light); color: var(--pink-hot); font-weight: 600;">${myName} [you]</span>`;
  container.innerHTML = creatorChip + pendingMembers.map(email => {
    const rawName = email.includes('@friend') ? email.split('@')[0].replace(/\./g, ' ') : email.split('@')[0];
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    return `
      <span class="member-chip">
        ${displayName}
        <button class="member-chip-remove" data-email="${email}" aria-label="Remove">✕</button>
      </span>
    `;
  }).join('');

  container.querySelectorAll('.member-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingMembers = pendingMembers.filter(e => e !== btn.dataset.email);
      renderMemberChips();
    });
  });
}

async function createGroup() {
  const name = $('group-name-input').value.trim();
  const description = $('group-desc-input')?.value.trim() || '';
  if (!name) { showToast('Give your group a name! 🌸', 'error'); return; }

  const btn = $('create-group-btn');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    const inviteCode = generateInviteCode();
    const groupData = {
      id: 'g_' + Date.now(),
      name,
      description,
      type: currentGroupType,
      emoji: getGroupEmoji(currentGroupType),
      inviteCode,
      members: [currentUser.uid],
      memberEmails: [currentUser.email, ...pendingMembers],
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString(),
      savingsGoal: null
    };

    if (activeDemoSession || isDemoMode || !db) {
      const demoDb = loadDemoDb();
      demoDb.groups.unshift(groupData);
      saveDemoDb(demoDb);
      groups.unshift(groupData);
    } else {
      const ref = await addDoc(collection(db, 'groups'), groupData);
      groupData.id = ref.id;
      groups.unshift(groupData);
    }

    closeModal('modal-create-group');
    showToast(`"${name}" created! Code: ${inviteCode} 🎉`, 'success', 3500);
    renderGroups();
    renderHome();
    launchConfetti();
    openGroupDetail(groupData.id);
  } catch (err) {
    showToast('Couldn\'t create group 😔', 'error');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Group 🌸';
  }
}

function renderGroups() {
  const container = $('groups-list');
  if (!container) return;
  if (groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-emoji">🌸</span>
        <p>Create your first group 🌸</p>
        <p class="empty-sub">Tap "+ New" or "🔑 Join" to start!</p>
      </div>`;
    return;
  }

  container.innerHTML = groups.map((g, i) => {
    const balance = getGroupBalance(g.id);
    const totalExpenses = expenses.filter(e => e.groupId === g.id).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const balClass = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral';
    const balText = balance === 0 ? 'All settled ✓' :
      balance > 0 ? `+${formatAmount(balance, getUserPreferredCurrency())} owed to you` :
        `${formatAmount(Math.abs(balance), getUserPreferredCurrency())} you owe`;
    return `
      <div class="group-card anim-fade-in" data-group-id="${g.id}" style="animation-delay:${i * 0.05}s">
        <span class="group-card-emoji">${g.emoji}</span>
        <div class="group-card-name">${g.name}</div>
        <div class="group-card-members">
          ${g.memberEmails?.length || 1} member${(g.memberEmails?.length || 1) !== 1 ? 's' : ''} · Total: ${formatAmount(totalExpenses, getUserPreferredCurrency())}
        </div>
        <div class="group-card-balance ${balClass}">${balText}</div>
      </div>`;
  }).join('');

  container.querySelectorAll('.group-card').forEach(card => {
    card.addEventListener('click', () => openGroupDetail(card.dataset.groupId));
  });
}

function renderHomeGroups() {
  const container = $('home-groups-list');
  if (!container) return;
  if (groups.length === 0) {
    container.innerHTML = `<div class="empty-state-inline"><span>🌸</span><p>Create your first group!</p></div>`;
    return;
  }
  container.innerHTML = groups.slice(0, 6).map(g => {
    const balance = getGroupBalance(g.id);
    const balClass = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral';
    const balText = balance === 0 ? 'Settled ✓' :
      balance > 0 ? `+${formatAmount(balance, getUserPreferredCurrency())}` :
        `${formatAmount(Math.abs(balance), getUserPreferredCurrency())}`;
    return `
      <div class="group-chip" data-group-id="${g.id}">
        <span class="group-chip-emoji">${g.emoji}</span>
        <div class="group-chip-name">${g.name}</div>
        <div class="group-chip-balance ${balClass}">${balText}</div>
      </div>`;
  }).join('');

  container.querySelectorAll('.group-chip').forEach(chip => {
    chip.addEventListener('click', () => openGroupDetail(chip.dataset.groupId));
  });
}

// ============================================================
// EXPENSES & SPLITS
// ============================================================
async function loadExpenses() {
  if (activeDemoSession || isDemoMode || !db) {
    expenses = loadDemoDb().expenses;
    return;
  }
  const q = query(collection(db, 'expenses'), where('involvedUsers', 'array-contains', currentUser.uid));
  try {
    const snap = await getDocs(q);
    expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    expenses = loadDemoDb().expenses;
  }
}

function initExpenseForm() {
  $('category-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    currentCategory = btn.dataset.cat;
    qsa('.cat-btn').forEach(b => b.classList.toggle('active', b === btn));
  });

  $('mood-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.mood-btn');
    if (!btn) return;
    currentMood = btn.dataset.mood;
    qsa('.mood-btn').forEach(b => b.classList.toggle('active', b === btn));
  });

  $('split-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.split-tab');
    if (!tab) return;
    currentSplitMethod = tab.dataset.method;
    qsa('.split-tab').forEach(t => t.classList.toggle('active', t === tab));
    renderSplitDetail();
  });

  $('receipt-upload-btn')?.addEventListener('click', triggerReceiptScanner);
  $('receipt-file')?.addEventListener('change', handleReceiptUpload);

  $('iou-emoji-btn')?.addEventListener('click', () => {
    const emojis = ['😭', '🙏', '💸', '🐷', '🎀', '💅', '🥺', '🫶', '✨', '😬'];
    const current = $('iou-note').value;
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    $('iou-note').value = (current ? current + ' ' : '') + emoji;
  });

  $('expense-amount')?.addEventListener('input', renderSplitDetail);
  $('expense-group')?.addEventListener('change', () => {
    currentGroupId = $('expense-group').value;
    renderSplitDetail();
    populatePaidBy();
  });

  $('add-expense-form')?.addEventListener('submit', submitExpense);

  const voiceBtn = document.createElement('button');
  voiceBtn.type = 'button';
  voiceBtn.className = 'btn btn-secondary btn-sm';
  voiceBtn.style.marginTop = '8px';
  voiceBtn.innerHTML = '🎙️ Voice Receipt & Log';
  voiceBtn.addEventListener('click', openVoiceLogModal);
  $('add-expense-form')?.appendChild(voiceBtn);
}

function populateExpenseForm() {
  const sel = $('expense-group');
  if (!sel) return;

  const options = [
    '<option value="g_personal">👤 Personal / General Expenses</option>',
    ...groups.map(g => `<option value="${g.id}">${g.emoji} ${g.name}</option>`)
  ];
  sel.innerHTML = options.join('');

  if (currentGroupId && groups.some(g => g.id === currentGroupId)) {
    sel.value = currentGroupId;
  } else if (groups.length > 0) {
    sel.value = groups[0].id;
    currentGroupId = groups[0].id;
  } else {
    sel.value = 'g_personal';
    currentGroupId = 'g_personal';
  }

  if ($('expense-date')) {
    $('expense-date').value = new Date().toISOString().split('T')[0];
  }

  populatePaidBy();

  if ($('expense-currency')) $('expense-currency').value = getUserPreferredCurrency();

  currentCategory = 'food';
  currentMood = 'worth-it';
  currentSplitMethod = 'equal';
  qsa('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'food'));
  qsa('.mood-btn').forEach(b => b.classList.toggle('active', b.dataset.mood === 'worth-it'));
  qsa('.split-tab').forEach(t => t.classList.toggle('active', t.dataset.method === 'equal'));

  renderSplitDetail();
}

function populatePaidBy() {
  const sel = $('expense-paid-by');
  if (!sel) return;
  sel.innerHTML = `<option value="${currentUser.uid}">Me (${userProfile.name || 'You'})</option>`;
  const group = groups.find(g => g.id === currentGroupId);
  if (group?.memberEmails) {
    group.memberEmails.filter(e => e !== currentUser.email).forEach(email => {
      sel.innerHTML += `<option value="${email}">${email.split('@')[0]}</option>`;
    });
  }
}

function renderSplitDetail() {
  const amount = parseFloat($('expense-amount').value) || 0;
  const container = $('split-detail');
  if (!container) return;
  const group = groups.find(g => g.id === $('expense-group').value);
  const members = group?.memberEmails || [currentUser.email];
  const currency = $('expense-currency').value;

  if (!amount) { container.innerHTML = ''; return; }

  if (currentSplitMethod === 'equal') {
    const each = amount / members.length;
    container.innerHTML = `
      <div class="split-equal-preview">
        ⚖️ Each person pays <strong>${formatAmount(each, currency)}</strong> (${members.length} people)
      </div>`;
    return;
  }

  if (currentSplitMethod === 'percentage') {
    container.innerHTML = members.map(email => `
      <div class="split-person-row">
        <span class="split-person-name">${email === currentUser.email ? 'Me' : email.split('@')[0]}</span>
        <input type="number" class="split-person-input" data-email="${email}" 
          placeholder="%" min="0" max="100" value="${Math.round(100 / members.length)}" />
        <span>%</span>
      </div>`).join('');
    return;
  }

  if (currentSplitMethod === 'exact') {
    container.innerHTML = members.map(email => `
      <div class="split-person-row">
        <span class="split-person-name">${email === currentUser.email ? 'Me' : email.split('@')[0]}</span>
        <input type="number" class="split-person-input" data-email="${email}" 
          placeholder="${formatAmount(amount / members.length, currency)}" min="0" step="0.01" />
      </div>`).join('');
    return;
  }

  if (currentSplitMethod === 'shares') {
    container.innerHTML = members.map(email => `
      <div class="split-person-row">
        <span class="split-person-name">${email === currentUser.email ? 'Me' : email.split('@')[0]}</span>
        <input type="number" class="split-person-input" data-email="${email}" 
          placeholder="shares" min="0" value="1" />
        <span>shares</span>
      </div>`).join('');
  }
}

function getSplitData(amount, members, currency) {
  if (!members || members.length === 0) {
    showToast('Cannot split expense with zero people! ⚠️', 'error');
    return null;
  }
  if (!amount || amount <= 0 || isNaN(amount)) {
    showToast('Expense amount must be greater than zero 💰', 'error');
    return null;
  }

  if (currentSplitMethod === 'equal') {
    const each = amount / members.length;
    return Object.fromEntries(members.map(m => [m, parseFloat(each.toFixed(2))]));
  }

  const inputs = qsa('#split-detail .split-person-input');
  const values = inputs.map(i => ({ email: i.dataset.email, val: parseFloat(i.value) }));

  if (values.some(v => isNaN(v.val) || v.val < 0)) {
    showToast('Split values cannot be negative or empty! ⚠️', 'error');
    return null;
  }

  if (currentSplitMethod === 'percentage') {
    const total = values.reduce((s, v) => s + v.val, 0);
    if (Math.abs(total - 100) > 0.5) {
      showToast(`Percentages must add up to 100% (currently ${total.toFixed(1)}%)`, 'error');
      return null;
    }
    return Object.fromEntries(values.map(v => [v.email, parseFloat(((v.val / 100) * amount).toFixed(2))]));
  }

  if (currentSplitMethod === 'exact') {
    const total = values.reduce((s, v) => s + v.val, 0);
    if (Math.abs(total - amount) > 0.05) {
      showToast(`Exact amounts (${formatAmount(total, currency)}) must add up to total ${formatAmount(amount, currency)}`, 'error');
      return null;
    }
    return Object.fromEntries(values.map(v => [v.email, parseFloat(v.val.toFixed(2))]));
  }

  if (currentSplitMethod === 'shares') {
    const totalShares = values.reduce((s, v) => s + v.val, 0);
    if (totalShares <= 0) {
      showToast('Total shares must be greater than zero! ⚠️', 'error');
      return null;
    }
    return Object.fromEntries(values.map(v => [v.email, parseFloat(((v.val / totalShares) * amount).toFixed(2))]));
  }

  return null;
}

async function submitExpense(e) {
  e.preventDefault();
  const desc = $('expense-desc').value.trim();
  const amount = parseFloat($('expense-amount').value);
  const dateVal = $('expense-date')?.value || new Date().toISOString().split('T')[0];
  const currency = $('expense-currency').value;
  const groupId = $('expense-group').value;
  const iouNote = $('iou-note').value.trim();
  const notes = $('expense-notes')?.value.trim() || '';
  const paidBy = $('expense-paid-by').value;

  if (!desc) { showToast('What was the expense for? 🌸', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Amount must be greater than 0 💰', 'error'); return; }
  if (!groupId) { showToast('Pick a group! 👯', 'error'); return; }

  let group = groups.find(g => g.id === groupId);
  if (!group && groupId === 'g_personal') {
    group = {
      id: 'g_personal',
      name: 'Personal Expenses 👤',
      type: 'other',
      emoji: '👤',
      members: [currentUser.uid],
      memberEmails: [currentUser.email],
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString(),
      savingsGoal: null
    };
    groups.push(group);
    if (activeDemoSession || isDemoMode || !db) {
      const demoDb = loadDemoDb();
      if (!demoDb.groups.some(g => g.id === 'g_personal')) demoDb.groups.push(group);
      saveDemoDb(demoDb);
    }
  }

  const members = group?.memberEmails || [currentUser.email];
  const splitData = getSplitData(amount, members, currency);
  if (!splitData) return;

  const btn = $('submit-expense-btn');
  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    const expenseData = {
      id: 'exp_' + Date.now(),
      desc,
      amount,
      currency,
      date: dateVal,
      category: currentCategory,
      emoji: getCategoryEmoji(currentCategory),
      mood: currentMood,
      groupId: group.id,
      groupName: group.name,
      paidBy,
      paidByEmail: paidBy === currentUser.uid ? currentUser.email : paidBy,
      paidByName: paidBy === currentUser.uid ? (userProfile.name || 'Me') : paidBy.split('@')[0],
      splits: splitData,
      splitMethod: currentSplitMethod,
      iouNote,
      notes,
      settled: false,
      involvedUsers: (group && Array.isArray(group.members) && group.members.length > 0) ? group.members : [currentUser.uid],
      createdBy: currentUser.uid,
      createdAt: dateVal ? new Date(dateVal).toISOString() : new Date().toISOString()
    };

    if (activeDemoSession || isDemoMode || !db) {
      const demoDb = loadDemoDb();
      demoDb.expenses.unshift(expenseData);
      saveDemoDb(demoDb);
      expenses.unshift(expenseData);
    } else {
      const ref = await addDoc(collection(db, 'expenses'), expenseData);
      expenses.unshift({ id: ref.id, ...expenseData });
    }

    userProfile.totalExpenses = (userProfile.totalExpenses || 0) + 1;
    showToast('Expense added! 🎉', 'success');
    addBounce(btn);

    $('expense-desc').value = '';
    $('expense-amount').value = '';
    $('iou-note').value = '';
    if ($('expense-notes')) $('expense-notes').value = '';
    $('split-detail').innerHTML = '';
    if ($('receipt-preview')) $('receipt-preview').classList.add('hidden');

    setTimeout(() => navigateTo('home'), 500);
  } catch (err) {
    showToast('Couldn\'t add expense 😔', 'error');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add Expense 💖';
  }
}

// ============================================================
// RECEIPT SCANNER (Itemized OCR simulator differentiator)
// ============================================================
function triggerReceiptScanner() {
  openReceiptScannerModal();
}

function handleReceiptUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const preview = $('receipt-preview');
    if (preview) {
      preview.classList.remove('hidden');
      preview.innerHTML = `<img src="${ev.target.result}" alt="Receipt" style="max-height:80px; border-radius:8px;" />`;
    }
    openReceiptScannerModal();
  };
  reader.readAsDataURL(file);
}

function openReceiptScannerModal() {
  const group = groups.find(g => g.id === $('expense-group')?.value) || groups[0];
  const members = group?.memberEmails || [currentUser.email];

  parsedReceiptItems = [
    { name: 'Margherita Pizza 🍕', price: 650, assignees: [currentUser.email] },
    { name: 'Cold Coffee x2 ☕', price: 320, assignees: [currentUser.email] },
    { name: 'Garlic Bread 🥖', price: 240, assignees: members.slice(0, 2) },
    { name: 'Taxes & Tip 🧾', price: 140, assignees: members }
  ];

  renderReceiptItems(members);
  openModal('modal-receipt-scanner');
}

function renderReceiptItems(members) {
  const container = $('receipt-items-list');
  if (!container) return;

  container.innerHTML = parsedReceiptItems.map((item, idx) => `
    <div class="receipt-item-row">
      <div class="receipt-item-info">
        <span class="receipt-item-title">${item.name}</span>
        <span class="receipt-item-price">${formatAmount(item.price)}</span>
      </div>
      <div class="receipt-item-assignees">
        ${members.map(m => {
    const selected = item.assignees.includes(m);
    return `<span class="receipt-member-chip ${selected ? 'selected' : ''}" 
            data-item-idx="${idx}" data-email="${m}">
            ${m === currentUser.email ? 'Me' : m.split('@')[0]}
          </span>`;
  }).join('')}
      </div>
    </div>
  `).join('');

  const total = parsedReceiptItems.reduce((s, i) => s + i.price, 0);
  if ($('receipt-scanned-total')) $('receipt-scanned-total').textContent = formatAmount(total);

  container.querySelectorAll('.receipt-member-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const itemIdx = parseInt(chip.dataset.itemIdx);
      const email = chip.dataset.email;
      const item = parsedReceiptItems[itemIdx];
      if (item.assignees.includes(email)) {
        if (item.assignees.length > 1) item.assignees = item.assignees.filter(e => e !== email);
      } else {
        item.assignees.push(email);
      }
      renderReceiptItems(members);
    });
  });

  $('apply-receipt-split-btn').onclick = () => {
    const totalAmount = parsedReceiptItems.reduce((s, i) => s + i.price, 0);
    const memberShares = {};
    members.forEach(m => memberShares[m] = 0);

    parsedReceiptItems.forEach(item => {
      const each = item.price / item.assignees.length;
      item.assignees.forEach(m => {
        memberShares[m] = (memberShares[m] || 0) + each;
      });
    });

    $('expense-desc').value = 'Group Dinner (Receipt Scanned) 🍕';
    $('expense-amount').value = totalAmount.toFixed(2);
    currentSplitMethod = 'exact';
    qsa('.split-tab').forEach(t => t.classList.toggle('active', t.dataset.method === 'exact'));
    renderSplitDetail();

    qsa('#split-detail .split-person-input').forEach(inp => {
      const email = inp.dataset.email;
      if (memberShares[email] !== undefined) {
        inp.value = memberShares[email].toFixed(2);
      }
    });

    closeModal('modal-receipt-scanner');
    showToast('Receipt items split applied! ✨', 'success');
  };
}

// ============================================================
// VOICE LOGGING MODAL
// ============================================================
function openVoiceLogModal() {
  const status = $('voice-status-text');
  const transcript = $('voice-transcript');
  const micCircle = $('voice-mic-trigger');
  const applyBtn = $('apply-voice-log-btn');

  if (status) status.innerHTML = 'Tap the mic and say: <em>"Dinner 1200 at Zomato with Goa Trip"</em>';
  if (transcript) { transcript.innerHTML = ''; transcript.classList.add('hidden'); }
  if (applyBtn) applyBtn.classList.add('hidden');

  openModal('modal-voice-log');

  micCircle.onclick = () => {
    micCircle.classList.add('listening');
    if (status) status.textContent = 'Listening... Speak now! 🎙️';

    setTimeout(() => {
      micCircle.classList.remove('listening');
      const spokenText = "Dinner 1200 at Zomato with Goa Trip";
      if (transcript) {
        transcript.textContent = `"${spokenText}"`;
        transcript.classList.remove('hidden');
      }
      if (status) status.textContent = 'Parsed expense details! ✨';
      if (applyBtn) {
        applyBtn.classList.remove('hidden');
        applyBtn.onclick = () => {
          $('expense-desc').value = 'Dinner at Zomato 🍕';
          $('expense-amount').value = '1200';
          if (groups.length > 0) $('expense-group').value = groups[0].id;
          currentCategory = 'food';
          currentMood = 'worth-it';
          renderSplitDetail();
          closeModal('modal-voice-log');
          showToast('Voice expense populated! ✨', 'success');
        };
      }
    }, 2200);
  };
}

// ============================================================
// HOME & DASHBOARD RENDERING
// ============================================================
function renderHome() {
  if (!currentUser) return;

  let totalOwed = 0, totalOwes = 0;
  const myEmail = currentUser.email;

  expenses.forEach(exp => {
    if (exp.settled) return;
    const paidByMe = exp.paidBy === currentUser.uid || exp.paidByEmail === myEmail;
    const splits = exp.splits || {};

    if (paidByMe) {
      Object.entries(splits).forEach(([email, amount]) => {
        if (email !== myEmail) totalOwed += amount;
      });
    } else {
      const myShare = splits[myEmail] || 0;
      totalOwes += myShare;
    }
  });

  const net = totalOwed - totalOwes;
  const currency = getUserPreferredCurrency();

  if ($('stat-owed')) $('stat-owed').textContent = formatAmount(totalOwed, currency);
  if ($('stat-owes')) $('stat-owes').textContent = formatAmount(totalOwes, currency);
  if ($('home-net-balance')) {
    $('home-net-balance').textContent = (net >= 0 ? '+' : '') + formatAmount(net, currency);
    $('home-net-balance').style.color = net >= 0 ? 'white' : '#FFB4A2';
  }

  const streak = userProfile.streak || 0;
  if ($('stat-streak')) $('stat-streak').textContent = `${streak}d`;

  renderHomeGroups();
  renderRecentActivity();
}

function renderRecentActivity() {
  const container = $('recent-activity-list');
  if (!container) return;
  const recent = expenses.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <span class="empty-emoji">🎀</span>
      <p>No expenses yet — add your first one!</p>
    </div>`;
    return;
  }

  container.innerHTML = recent.map(exp => renderActivityItem(exp)).join('');
  attachDeleteListeners(container);
}

function renderActivity() {
  const container = $('activity-list');
  if (!container) return;
  let filtered = [...expenses];

  if (currentFilter === 'settled') filtered = expenses.filter(e => e.settled);
  else if (currentFilter === 'owed') {
    filtered = expenses.filter(e => !e.settled && (e.paidBy === currentUser.uid || e.paidByEmail === currentUser.email));
  } else if (currentFilter === 'owes') {
    filtered = expenses.filter(e => !e.settled && e.paidBy !== currentUser.uid && e.paidByEmail !== currentUser.email);
  }

  const sortVal = $('activity-sort')?.value || 'newest';
  if (sortVal === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
  } else if (sortVal === 'oldest') {
    filtered.sort((a, b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date));
  } else if (sortVal === 'highest') {
    filtered.sort((a, b) => (b.amount || 0) - (a.amount || 0));
  } else if (sortVal === 'lowest') {
    filtered.sort((a, b) => (a.amount || 0) - (b.amount || 0));
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <span class="empty-emoji">📋</span>
      <p>Your activity will appear here.</p>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(exp => renderActivityItem(exp)).join('');
  attachDeleteListeners(container);
}

let currentConfirmAction = null;

function showConfirmDialog(title, message, onProceed) {
  if ($('confirm-modal-title')) $('confirm-modal-title').textContent = title || 'Confirm Action ⚠️';
  if ($('confirm-modal-message')) $('confirm-modal-message').textContent = message || 'Are you sure?';

  currentConfirmAction = onProceed;
  openModal('modal-confirm-action');

  const cancelBtn = $('confirm-modal-cancel');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      closeModal('modal-confirm-action');
      currentConfirmAction = null;
    };
  }

  const proceedBtn = $('confirm-modal-proceed');
  if (proceedBtn) {
    proceedBtn.onclick = async () => {
      closeModal('modal-confirm-action');
      if (currentConfirmAction) {
        const action = currentConfirmAction;
        currentConfirmAction = null;
        await action();
      }
    };
  }
}

function deleteExpense(expenseId) {
  const exp = expenses.find(e => e.id === expenseId);
  const title = exp ? `Delete "${exp.desc}"?` : 'Delete Expense?';
  showConfirmDialog('Delete Expense 🗑️', `Are you sure you want to delete "${exp?.desc || 'this expense'}"? This cannot be undone.`, async () => {
    try {
      expenses = expenses.filter(e => e.id !== expenseId);

      if (activeDemoSession || isDemoMode || !db) {
        const demoDb = loadDemoDb();
        demoDb.expenses = (demoDb.expenses || []).filter(e => e.id !== expenseId);
        saveDemoDb(demoDb);
      } else if (db) {
        try {
          await deleteDoc(doc(db, 'expenses', expenseId));
        } catch (e) {
          console.warn("Remote delete failed:", e);
        }
      }

      userProfile.totalExpenses = Math.max(0, (userProfile.totalExpenses || 1) - 1);
      showToast('Expense deleted 🗑️', 'info');

      renderHome();
      renderGroups();
      renderActivity();
      if (currentGroupId) {
        const g = groups.find(grp => grp.id === currentGroupId);
        if (g) {
          renderVibeScore(currentGroupId);
          renderGroupBalances(currentGroupId, g);
          renderGroupExpenses(currentGroupId);
        }
      }
    } catch (err) {
      console.error("Error deleting expense:", err);
      showToast('Could not delete expense 😔', 'error');
    }
  });
}

function deleteGroup(groupId) {
  const group = groups.find(g => g.id === groupId);
  if (!group) return;
  showConfirmDialog('Delete Group 🗑️', `Are you sure you want to delete group "${group.name}" and all its expenses?`, async () => {
    try {
      groups = groups.filter(g => g.id !== groupId);
      expenses = expenses.filter(e => e.groupId !== groupId);

      if (activeDemoSession || isDemoMode || !db) {
        const demoDb = loadDemoDb();
        demoDb.groups = (demoDb.groups || []).filter(g => g.id !== groupId);
        demoDb.expenses = (demoDb.expenses || []).filter(e => e.groupId !== groupId);
        saveDemoDb(demoDb);
      } else if (db) {
        try {
          await deleteDoc(doc(db, 'groups', groupId));
        } catch (e) {
          console.warn("Remote group delete failed:", e);
        }
      }

      closeModal('modal-group-detail');
      showToast(`Group "${group.name}" deleted 🗑️`, 'info');
      renderHome();
      renderGroups();
      renderActivity();
    } catch (err) {
      console.error("Error deleting group:", err);
      showToast('Could not delete group 😔', 'error');
    }
  });
}

function openEditExpenseModal(expenseId) {
  const exp = expenses.find(e => e.id === expenseId);
  if (!exp) return;

  if ($('edit-expense-id')) $('edit-expense-id').value = exp.id;
  if ($('edit-expense-desc')) $('edit-expense-desc').value = exp.desc;
  if ($('edit-expense-amount')) $('edit-expense-amount').value = exp.amount;
  if ($('edit-expense-date')) $('edit-expense-date').value = exp.date || new Date().toISOString().split('T')[0];

  openModal('modal-edit-expense');
}

function renderActivityItem(exp) {
  const myEmail = currentUser.email;
  const paidByMe = exp.paidBy === currentUser.uid || exp.paidByEmail === myEmail;
  const myShare = exp.splits?.[myEmail] || 0;
  const currency = exp.currency || 'INR';

  let amountText, amountClass;
  if (exp.settled) {
    amountText = `✓ Settled`;
    amountClass = '';
  } else if (paidByMe) {
    const othersOwe = Object.entries(exp.splits || {})
      .filter(([e]) => e !== myEmail)
      .reduce((s, [, v]) => s + v, 0);
    amountText = `+${formatAmount(othersOwe, currency)}`;
    amountClass = 'positive';
  } else {
    amountText = `-${formatAmount(myShare, currency)}`;
    amountClass = 'negative';
  }

  const moodBadges = {
    'worth-it': '✨ Worth it', 'treat-yourself': '🛍 Treat', 'regret': '😬 Regret',
    'necessary': '📌 Necessary', 'yolo': '🤙 YOLO'
  };

  return `
    <div class="activity-item" data-expense-id="${exp.id}">
      <div class="activity-emoji">${exp.emoji || '📦'}</div>
      <div class="activity-body">
        <div class="activity-desc">${exp.desc}</div>
        <div class="activity-meta">
          ${exp.groupName || ''} · ${timeAgo(exp.createdAt)}
          ${exp.iouNote ? `<br><em style="color:var(--pink-hot)">💬 ${exp.iouNote}</em>` : ''}
        </div>
        ${exp.notes ? `<div class="expense-personal-notes">📝 <strong>Note:</strong> ${exp.notes}</div>` : ''}
        ${exp.mood ? `<span class="mood-tag">${moodBadges[exp.mood] || exp.mood}</span>` : ''}
        ${exp.settled ? '<span class="settled-badge">✓ Settled</span>' : ''}
      </div>
      <div class="activity-amount ${amountClass}" style="display:flex; align-items:center; gap:6px;">
        <span>${amountText}</span>
        <button class="edit-expense-btn" data-expense-id="${exp.id}" title="Edit expense" style="background:none; border:none; cursor:pointer; font-size:0.85rem; opacity:0.65; padding:2px 4px;">✏️</button>
        <button class="delete-expense-btn" data-expense-id="${exp.id}" title="Delete expense" style="background:none; border:none; cursor:pointer; font-size:0.85rem; opacity:0.65; padding:2px 4px;">🗑️</button>
      </div>
    </div>`;
}

function attachDeleteListeners(container) {
  if (!container) return;
  container.querySelectorAll('.delete-expense-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteExpense(btn.dataset.expenseId);
    };
  });
  container.querySelectorAll('.edit-expense-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openEditExpenseModal(btn.dataset.expenseId);
    };
  });
}

// ============================================================
// BALANCE CALCULATIONS
// ============================================================
function getGroupBalance(groupId) {
  const myEmail = currentUser.email;
  let balance = 0;

  expenses.filter(e => e.groupId === groupId && !e.settled).forEach(exp => {
    const paidByMe = exp.paidBy === currentUser.uid || exp.paidByEmail === myEmail;
    const splits = exp.splits || {};

    if (paidByMe) {
      Object.entries(splits).forEach(([email, amt]) => {
        if (email !== myEmail) balance += amt;
      });
    } else {
      balance -= (splits[myEmail] || 0);
    }
  });

  return balance;
}

function getGroupBalanceSheet(groupId) {
  const owes = {};

  expenses.filter(e => e.groupId === groupId && !e.settled).forEach(exp => {
    const paidByEmail = exp.paidByEmail || currentUser.email;
    const splits = exp.splits || {};

    Object.entries(splits).forEach(([memberEmail, share]) => {
      if (memberEmail === paidByEmail) return;
      const key = `${paidByEmail}→${memberEmail}`;
      owes[key] = (owes[key] || 0) + share;
    });
  });

  const debts = [];
  const processed = new Set();

  Object.keys(owes).forEach(key => {
    if (processed.has(key)) return;
    const [payerEmail, debtorEmail] = key.split('→');
    const reverseKey = `${debtorEmail}→${payerEmail}`;
    const fwd = owes[key] || 0;
    const rev = owes[reverseKey] || 0;

    if (fwd > rev) {
      debts.push({ from: debtorEmail, to: payerEmail, amount: fwd - rev });
    } else if (rev > fwd) {
      debts.push({ from: payerEmail, to: debtorEmail, amount: rev - fwd });
    }
    processed.add(key);
    processed.add(reverseKey);
  });

  return debts;
}

// ============================================================
// GROUP DETAIL MODAL
// ============================================================
function openGroupDetail(groupId) {
  currentGroupId = groupId;
  const group = groups.find(g => g.id === groupId);
  if (!group) return;

  const totalGroupExpenses = expenses.filter(e => e.groupId === groupId).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const currency = getUserPreferredCurrency();

  if ($('gd-title')) $('gd-title').textContent = `${group.emoji} ${group.name}`;
  if ($('gd-invite-code')) $('gd-invite-code').textContent = group.inviteCode || 'N/A';

  if ($('gd-copy-code-btn')) {
    $('gd-copy-code-btn').onclick = () => {
      if (!group.inviteCode) return;
      navigator.clipboard.writeText(group.inviteCode);
      showToast(`Invite code ${group.inviteCode} copied! 📋`, 'success');
    };
  }

  if ($('gd-copy-link-btn')) {
    $('gd-copy-link-btn').onclick = () => {
      if (!group.inviteCode) return;
      const url = `${window.location.origin}${window.location.pathname}?join=${group.inviteCode}`;
      navigator.clipboard.writeText(url);
      showToast('Invite link copied! 🔗 Share with friends', 'success');
    };
  }

  // Add an inline "+ Add Expense" button inside Group Detail modal
  const header = $('gd-title')?.parentElement;
  let addExpBtn = header?.querySelector('.gd-add-exp-btn');
  if (!addExpBtn && header) {
    addExpBtn = document.createElement('button');
    addExpBtn.className = 'btn btn-primary btn-sm gd-add-exp-btn';
    addExpBtn.style.marginLeft = 'auto';
    addExpBtn.style.marginRight = '8px';
    addExpBtn.textContent = '+ Add Expense';
    addExpBtn.onclick = () => {
      closeModal('modal-group-detail');
      navigateTo('add');
      const sel = $('expense-group');
      if (sel) sel.value = groupId;
      currentGroupId = groupId;
      populatePaidBy();
      renderSplitDetail();
    };
    header.insertBefore(addExpBtn, header.lastElementChild);
  }

  // Add Delete Group button
  let deleteGrpBtn = header?.querySelector('.gd-delete-grp-btn');
  if (!deleteGrpBtn && header) {
    deleteGrpBtn = document.createElement('button');
    deleteGrpBtn.className = 'btn btn-secondary btn-sm gd-delete-grp-btn';
    deleteGrpBtn.style.marginRight = '8px';
    deleteGrpBtn.style.background = 'rgba(255, 92, 138, 0.1)';
    deleteGrpBtn.style.color = 'var(--pink-hot)';
    deleteGrpBtn.textContent = '🗑️ Delete';
    deleteGrpBtn.onclick = () => deleteGroup(groupId);
    header.insertBefore(deleteGrpBtn, header.lastElementChild);
  }

  renderVibeScore(groupId);
  renderGroupBalances(groupId, group);
  renderGroupExpenses(groupId);
  renderGroupPolls();
  renderSavingsGoal(group);

  openModal('modal-group-detail');
}

function renderVibeScore(groupId) {
  const debts = getGroupBalanceSheet(groupId);
  let score = 100;
  if (debts.length > 0) {
    const totalDebt = debts.reduce((s, d) => s + d.amount, 0);
    const totalExpense = expenses.filter(e => e.groupId === groupId).reduce((s, e) => s + e.amount, 0);
    score = totalExpense > 0 ? Math.max(10, Math.round(100 - (totalDebt / totalExpense) * 100)) : 100;
  }

  const bar = $('gd-vibe-bar');
  if (bar) {
    bar.style.width = `${score}%`;
    bar.style.background = score > 70
      ? 'linear-gradient(90deg, #B8F2D0, #6EE2A2)'
      : score > 40
        ? 'linear-gradient(90deg, #FFD6A0, #FFA940)'
        : 'linear-gradient(90deg, #FFB4A2, #FF7A5C)';
  }

  const vibeText = score === 100 ? '100% Balanced ✨' :
    score > 70 ? `${score}% Balanced 🙂` :
      score > 40 ? `${score}% — Someone's carrying the group 😅` :
        `${score}% — Time to settle up! 😬`;

  if ($('gd-vibe-value')) $('gd-vibe-value').textContent = vibeText;
}

function renderGroupBalances(groupId, group) {
  const container = $('gd-balances');
  if (!container) return;
  const debts = getGroupBalanceSheet(groupId);
  const currency = getUserPreferredCurrency();
  const myEmail = currentUser.email;

  if (debts.length === 0) {
    container.innerHTML = `<div class="empty-state-inline"><span>✅</span><p>All settled up!</p></div>`;
    return;
  }

  container.innerHTML = debts.map(debt => {
    const isMe = debt.from === myEmail || debt.to === myEmail;
    const fromName = debt.from === myEmail ? 'You' : debt.from.split('@')[0];
    const toName = debt.to === myEmail ? 'You' : debt.to.split('@')[0];

    return `
      <div class="balance-item">
        <div class="balance-persons">
          <strong>${fromName}</strong> owes <strong>${toName}</strong>
        </div>
        <div class="balance-amount-tag">${formatAmount(debt.amount, currency)}</div>
        ${isMe ? `<button class="settle-up-btn" 
          data-from="${debt.from}" data-to="${debt.to}" data-amount="${debt.amount}" data-group="${groupId}">
          Settle ✓</button>` : ''}
      </div>`;
  }).join('');

  container.querySelectorAll('.settle-up-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      settleTarget = {
        from: btn.dataset.from,
        to: btn.dataset.to,
        amount: parseFloat(btn.dataset.amount),
        groupId: btn.dataset.group
      };
      if ($('settle-amount')) $('settle-amount').value = settleTarget.amount.toFixed(2);
      if ($('settle-info')) {
        $('settle-info').innerHTML = `
          <strong>${settleTarget.from === currentUser.email ? 'You' : settleTarget.from.split('@')[0]}</strong>
          pays <strong>${settleTarget.to === currentUser.email ? 'You' : settleTarget.to.split('@')[0]}</strong>
          ${formatAmount(settleTarget.amount, currency)}`;
      }
      openModal('modal-settle');
    });
  });
}

function renderGroupExpenses(groupId) {
  const container = $('gd-expenses');
  if (!container) return;
  const groupExpenses = expenses.filter(e => e.groupId === groupId);

  if (groupExpenses.length === 0) {
    container.innerHTML = `<div class="empty-state-inline"><span>💸</span><p>No expenses yet</p></div>`;
    return;
  }

  container.innerHTML = groupExpenses.map(exp => renderActivityItem(exp)).join('');
  attachDeleteListeners(container);
}

// ============================================================
// SETTLE UP & STREAKS
// ============================================================
function initSettleListeners() {
  $('confirm-settle-btn')?.addEventListener('click', async () => {
    if (!settleTarget) return;
    const settleAmt = parseFloat($('settle-amount')?.value);
    const note = $('settle-note')?.value.trim() || '';

    if (!settleAmt || settleAmt <= 0) {
      showToast('Enter a valid settlement amount 💵', 'error');
      return;
    }

    const btn = $('confirm-settle-btn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
      const fromName = settleTarget.from === currentUser.email ? (userProfile.name || 'You') : settleTarget.from.split('@')[0];
      const toName = settleTarget.to === currentUser.email ? (userProfile.name || 'You') : settleTarget.to.split('@')[0];
      const group = groups.find(g => g.id === settleTarget.groupId);

      const settlementExpense = {
        id: 'exp_settle_' + Date.now(),
        desc: `Payment: ${fromName} → ${toName} 💵`,
        amount: settleAmt,
        currency: getUserPreferredCurrency(),
        date: new Date().toISOString().split('T')[0],
        category: 'other',
        emoji: '💵',
        mood: 'necessary',
        groupId: settleTarget.groupId,
        groupName: group?.name || 'Settlement Payment',
        paidBy: settleTarget.from === currentUser.email ? currentUser.uid : settleTarget.from,
        paidByEmail: settleTarget.from,
        paidByName: fromName,
        splits: {
          [settleTarget.to]: settleAmt
        },
        splitMethod: 'exact',
        iouNote: note ? `Settlement: ${note}` : 'Payment settled 💵',
        notes: note,
        settled: false,
        involvedUsers: (group && Array.isArray(group.members) && group.members.length > 0) ? group.members : [currentUser.uid],
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString()
      };

      if (activeDemoSession || isDemoMode || !db) {
        const demoDb = loadDemoDb();
        demoDb.expenses.unshift(settlementExpense);
        saveDemoDb(demoDb);
        expenses.unshift(settlementExpense);
      } else {
        const ref = await addDoc(collection(db, 'expenses'), settlementExpense);
        expenses.unshift({ id: ref.id, ...settlementExpense });
      }

      const newStreak = (userProfile.streak || 0) + 1;
      userProfile.streak = newStreak;

      closeModal('modal-settle');
      if (currentGroupId) {
        const g = groups.find(grp => grp.id === currentGroupId);
        if (g) {
          renderVibeScore(currentGroupId);
          renderGroupBalances(currentGroupId, g);
          renderGroupExpenses(currentGroupId);
        }
      }
      showToast(`Settlement recorded! 💵 +1 Streak 🔥 (${newStreak}d streak!)`, 'success', 3200);
      launchConfetti();
      renderHome();
      renderActivity();
    } catch (err) {
      console.error("Settlement failed:", err);
      showToast('Couldn\'t record payment 😔', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Mark as Paid 🎉';
    }
  });
}

// ============================================================
// PRE-SPEND POLLS
// ============================================================
function initPollListeners() {
  $('new-poll-btn')?.addEventListener('click', () => {
    $('poll-question').value = '';
    $('poll-options-list').innerHTML = `
      <input type="text" class="poll-option-input" placeholder="Option 1" />
      <input type="text" class="poll-option-input" placeholder="Option 2" />`;
    openModal('modal-poll');
  });

  $('add-poll-option-btn')?.addEventListener('click', () => {
    const list = $('poll-options-list');
    const count = list.querySelectorAll('.poll-option-input').length + 1;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'poll-option-input';
    input.placeholder = `Option ${count}`;
    list.appendChild(input);
  });

  $('create-poll-btn')?.addEventListener('click', () => {
    const question = $('poll-question').value.trim();
    const options = [...qsa('.poll-option-input')].map(i => i.value.trim()).filter(Boolean);

    if (!question) { showToast('Add a question! 🗳️', 'error'); return; }
    if (options.length < 2) { showToast('Add at least 2 options', 'error'); return; }

    const pollData = {
      id: 'poll_' + Date.now(),
      question,
      options: options.map(label => ({ label, votes: [] })),
      groupId: currentGroupId,
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString()
    };

    const demoDb = loadDemoDb();
    demoDb.polls = demoDb.polls || [];
    demoDb.polls.unshift(pollData);
    saveDemoDb(demoDb);

    closeModal('modal-poll');
    renderGroupPolls();
    showToast('Poll launched! 🗳️', 'success');
  });
}

function renderGroupPolls() {
  const container = $('gd-polls');
  if (!container) return;
  const dbPolls = loadDemoDb().polls || [];
  const polls = dbPolls.filter(p => p.groupId === currentGroupId);

  if (polls.length === 0) {
    container.innerHTML = `<div class="empty-state-inline"><span>🗳️</span><p>No polls yet</p></div>`;
    return;
  }

  container.innerHTML = polls.map(poll => {
    const totalVotes = poll.options.reduce((s, o) => s + (o.votes?.length || 0), 0);
    const myVote = poll.options.findIndex(o => o.votes?.includes(currentUser.uid));

    return `
      <div class="poll-item">
        <div class="poll-question">${poll.question}</div>
        <div class="poll-options">
          ${poll.options.map((opt, idx) => {
      const pct = totalVotes > 0 ? Math.round((opt.votes?.length || 0) / totalVotes * 100) : 0;
      const isVoted = myVote === idx;
      return `
              <div class="poll-option-row">
                <div class="poll-option-bar-wrap">
                  <div class="poll-option-bar" style="width:${pct}%"></div>
                  <span class="poll-option-label">${opt.label}</span>
                </div>
                <span class="poll-option-pct">${pct}%</span>
                <button class="poll-vote-btn ${isVoted ? 'voted' : ''}" 
                  data-poll-id="${poll.id}" data-opt-idx="${idx}">
                  ${isVoted ? '✓' : 'Vote'}
                </button>
              </div>`;
    }).join('')}
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.poll-vote-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pollId = btn.dataset.pollId;
      const optIdx = parseInt(btn.dataset.optIdx);
      votePoll(pollId, optIdx);
    });
  });
}

function votePoll(pollId, optIdx) {
  const demoDb = loadDemoDb();
  const poll = demoDb.polls.find(p => p.id === pollId);
  if (!poll) return;

  poll.options.forEach((opt, idx) => {
    if (idx === optIdx) {
      if (!opt.votes.includes(currentUser.uid)) opt.votes.push(currentUser.uid);
    } else {
      opt.votes = opt.votes.filter(u => u !== currentUser.uid);
    }
  });

  saveDemoDb(demoDb);
  renderGroupPolls();
  showToast('Vote recorded! 🗳️', 'success');
}

// ============================================================
// GROUP SAVINGS GOALS & CHIP-IN
// ============================================================
function initSavingsListeners() {
  $('set-savings-btn')?.addEventListener('click', () => {
    $('savings-name').value = '';
    $('savings-target').value = '';
    openModal('modal-savings');
  });

  $('create-savings-btn')?.addEventListener('click', () => {
    const name = $('savings-name').value.trim();
    const target = parseFloat($('savings-target').value);

    if (!name) { showToast('Name your goal! 🎯', 'error'); return; }
    if (!target || target <= 0) { showToast('Enter a valid target amount', 'error'); return; }

    const goal = { name, target, current: 0, currency: getUserPreferredCurrency() };
    const group = groups.find(g => g.id === currentGroupId);
    if (group) group.savingsGoal = goal;

    const demoDb = loadDemoDb();
    const g = demoDb.groups.find(x => x.id === currentGroupId);
    if (g) g.savingsGoal = goal;
    saveDemoDb(demoDb);

    closeModal('modal-savings');
    renderSavingsGoal(group);
    showToast('Savings goal set! 🎯', 'success');
  });

  $('submit-chip-in-btn')?.addEventListener('click', () => {
    const amt = parseFloat($('chip-in-amount').value);
    const note = $('chip-in-note').value.trim();
    if (!amt || amt <= 0) { showToast('Enter contribution amount', 'error'); return; }

    const group = groups.find(g => g.id === currentGroupId);
    if (group?.savingsGoal) {
      group.savingsGoal.current = (group.savingsGoal.current || 0) + amt;
      const demoDb = loadDemoDb();
      const g = demoDb.groups.find(x => x.id === currentGroupId);
      if (g?.savingsGoal) g.savingsGoal.current = (g.savingsGoal.current || 0) + amt;
      saveDemoDb(demoDb);

      renderSavingsGoal(group);
      closeModal('modal-chip-in');
      showToast(`Chipped in ${formatAmount(amt)}! 🎯 ${note ? '("' + note + '")' : ''}`, 'success');
      launchConfetti();
    }
  });
}

function renderSavingsGoal(group) {
  const container = $('gd-savings');
  if (!container) return;
  if (!group.savingsGoal) {
    container.innerHTML = `<div class="empty-state-inline"><span>🎯</span><p>No savings goal set</p></div>`;
    return;
  }
  const { name, target, current, currency } = group.savingsGoal;
  const pct = Math.min(100, Math.round((current / target) * 100));
  container.innerHTML = `
    <div class="savings-goal-card" style="background:var(--cream-dark); border-radius:16px; padding:14px; margin-bottom:10px;">
      <div class="savings-goal-name" style="font-weight:700;">🎯 ${name}</div>
      <div class="savings-goal-bar-wrap" style="height:10px; background:var(--pink-light); border-radius:99px; overflow:hidden; margin:8px 0;">
        <div class="savings-goal-bar" style="width:${pct}%; height:100%; background:linear-gradient(90deg, #FF5C8A, #B8F2D0); transition:width 0.4s ease;"></div>
      </div>
      <div class="savings-goal-meta" style="display:flex; justify-content:space-between; font-size:0.82rem; color:var(--plum-light);">
        <span>${formatAmount(current, currency)} saved (${pct}%)</span>
        <span>${formatAmount(target, currency)} goal</span>
      </div>
    </div>
    <button class="btn btn-secondary btn-sm" id="chip-in-trigger-btn">+ Chip In 💖</button>`;

  container.querySelector('#chip-in-trigger-btn')?.addEventListener('click', () => {
    $('chip-in-amount').value = '';
    $('chip-in-note').value = '';
    openModal('modal-chip-in');
  });
}

// ============================================================
// SHAREABLE CANVAS STORY CARDS
// ============================================================
function initShareCardListeners() {
  $('share-settle-btn')?.addEventListener('click', () => {
    const group = groups.find(g => g.id === currentGroupId);
    if (!group) return;

    if ($('sc-group-name')) $('sc-group-name').textContent = `${group.emoji} ${group.name}`;
    const debts = getGroupBalanceSheet(currentGroupId);
    const currency = getUserPreferredCurrency();

    const scBalances = $('sc-balances');
    if (scBalances) {
      if (debts.length === 0) {
        scBalances.innerHTML = `<div class="share-card-balance-row"><span>All settled up! ✅</span></div>`;
      } else {
        scBalances.innerHTML = debts.slice(0, 5).map(d => {
          const from = d.from === currentUser.email ? 'You' : d.from.split('@')[0];
          const to = d.to === currentUser.email ? 'You' : d.to.split('@')[0];
          return `<div class="share-card-balance-row">
            <span>${from} → ${to}</span>
            <span>${formatAmount(d.amount, currency)}</span>
          </div>`;
        }).join('');
      }
    }

    openModal('modal-share-card');
  });

  $('download-share-card-btn')?.addEventListener('click', generateCanvasImageCard);
}

function generateCanvasImageCard() {
  const group = groups.find(g => g.id === currentGroupId) || { name: 'Goa Trip 🌴', emoji: '✈️' };
  const debts = getGroupBalanceSheet(currentGroupId);
  const currency = getUserPreferredCurrency();

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  // Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
  grad.addColorStop(0, '#FFD6E8');
  grad.addColorStop(0.5, '#FFF9F5');
  grad.addColorStop(1, '#FFB4A2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Decorative circles
  ctx.fillStyle = 'rgba(255, 92, 138, 0.12)';
  ctx.beginPath(); ctx.arc(200, 200, 260, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(900, 1700, 320, 0, Math.PI * 2); ctx.fill();

  // Header Logo
  ctx.font = 'bold 70px Poppins, sans-serif';
  ctx.fillStyle = '#FF5C8A';
  ctx.fillText('Split Up 💖', 120, 220);

  ctx.font = 'bold 36px Poppins, sans-serif';
  ctx.fillStyle = '#6B5B6E';
  ctx.fillText('GROUP SETTLE-UP SUMMARY', 120, 290);

  // Group Title Card Box
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.roundRect ? ctx.roundRect(100, 360, 880, 180, 30) : ctx.fillRect(100, 360, 880, 180);
  ctx.fill();

  ctx.font = 'bold 54px Poppins, sans-serif';
  ctx.fillStyle = '#3A2E39';
  ctx.fillText(`${group.emoji || '💖'} ${group.name}`, 140, 470);

  // Debts Box
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.roundRect ? ctx.roundRect(100, 580, 880, 960, 36) : ctx.fillRect(100, 580, 880, 960);
  ctx.fill();

  ctx.font = 'bold 42px Poppins, sans-serif';
  ctx.fillStyle = '#FF5C8A';
  ctx.fillText('Who Owes What 💸', 150, 670);

  ctx.strokeStyle = '#FFD6E8';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(150, 710); ctx.lineTo(930, 710); ctx.stroke();

  let y = 790;
  if (debts.length === 0) {
    ctx.font = 'bold 44px Poppins, sans-serif';
    ctx.fillStyle = '#1D9B5E';
    ctx.fillText('All settled up! No debts. 🎉', 150, y);
  } else {
    debts.slice(0, 7).forEach(d => {
      const from = d.from === currentUser.email ? 'You' : d.from.split('@')[0];
      const to = d.to === currentUser.email ? 'You' : d.to.split('@')[0];

      ctx.font = '500 40px Poppins, sans-serif';
      ctx.fillStyle = '#3A2E39';
      ctx.fillText(`${from} → ${to}`, 150, y);

      ctx.font = 'bold 40px Poppins, sans-serif';
      ctx.fillStyle = '#FF5C8A';
      ctx.fillText(formatAmount(d.amount, currency), 760, y);

      y += 95;
    });
  }

  // Footer Watermark
  ctx.font = 'bold 36px Poppins, sans-serif';
  ctx.fillStyle = '#3A2E39';
  ctx.textAlign = 'center';
  ctx.fillText('Friends. Expenses. No Drama. ✨', 540, 1780);

  const link = document.createElement('a');
  link.download = `${group.name.replace(/\s+/g, '_')}_SettleUp_Card.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();

  showToast('Story card downloaded! 📸 Share to IG/WhatsApp!', 'success', 3500);
}

// ============================================================
// PROFILE & FILTERS
// ============================================================
function initActivityFilters() {
  $('page-activity')?.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      qsa('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderActivity();
    });
  });
  $('activity-sort')?.addEventListener('change', renderActivity);
}

function initProfileListeners() {
  $('user-avatar-btn')?.addEventListener('click', () => {
    const name = userProfile.name || currentUser?.displayName || formatNameFromEmail(currentUser?.email) || 'Friend';
    if ($('profile-avatar-large')) $('profile-avatar-large').textContent = getUserInitial(name);
    if ($('profile-name-display')) $('profile-name-display').textContent = name;
    if ($('profile-email-display')) $('profile-email-display').textContent = currentUser?.email || '—';
    if ($('pref-name')) $('pref-name').value = name;
    if ($('p-total-expenses')) $('p-total-expenses').textContent = userProfile.totalExpenses || expenses.length;
    if ($('p-total-groups')) $('p-total-groups').textContent = groups.length;
    if ($('p-streak')) $('p-streak').textContent = `🔥${userProfile.streak || 0}`;
    if ($('pref-currency')) $('pref-currency').value = userProfile.currency || 'INR';
    openModal('modal-profile');
  });

  $('save-profile-btn')?.addEventListener('click', async () => {
    const currency = $('pref-currency').value;
    const newName = $('pref-name')?.value.trim();
    if (newName) {
      userProfile.name = newName;
      if (currentUser) currentUser.displayName = newName;
    }
    userProfile.currency = currency;

    if (activeDemoSession || isDemoMode || !db) {
      const demoDb = loadDemoDb();
      if (!demoDb.users) demoDb.users = {};
      demoDb.users['demo_user_1'] = userProfile;
      saveDemoDb(demoDb);
    } else if (currentUser && db) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { name: newName || userProfile.name, currency });
      } catch (e) { console.warn("Failed to update profile remote:", e); }
    }

    updateTopBar();
    renderHome();
    closeModal('modal-profile');
    showToast('Profile updated! ✨', 'success');
  });

  $('reset-data-btn')?.addEventListener('click', () => {
    localStorage.removeItem(DEMO_STORAGE_KEY);
    const cleanData = getDemoInitialData();
    saveDemoDb(cleanData);
    groups = [];
    expenses = [];
    userProfile = {
      name: currentUser?.displayName || userProfile.name || 'Demo User',
      email: currentUser?.email || userProfile.email || 'user@example.com',
      currency: userProfile.currency || 'INR',
      streak: 0,
      totalExpenses: 0
    };
    renderHome();
    renderGroups();
    renderActivity();
    updateTopBar();
    closeModal('modal-profile');
    showToast('All data reset to zero! Clean state ready for use 🌸', 'success', 3200);
  });

  $('signout-btn')?.addEventListener('click', async () => {
    if (!isDemoMode && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Sign out error:", err);
      }
    }
    activeDemoSession = false;
    currentUser = null;
    userProfile = {};
    groups = [];
    expenses = [];
    showAuth();
    showToast('Signed out! 👋', 'info');
  });
}

function checkPendingJoinUrl() {
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get('join');
  if (joinCode && currentUser) {
    if ($('join-code-input')) $('join-code-input').value = joinCode.toUpperCase();
    openModal('modal-join-group');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function initModalCloseHandlers() {
  qsa('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  qsa('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

// ============================================================
// APP ENTRY & LIFECYCLE
// ============================================================
function showApp() {
  $('app')?.classList.remove('hidden');
  $('auth-screen')?.classList.add('hidden');
}

function showAuth() {
  $('app')?.classList.add('hidden');
  $('auth-screen')?.classList.remove('hidden');
  $('splash-screen')?.classList.add('hidden');
}

function hideSplash() {
  const splash = $('splash-screen');
  if (!splash) return;
  splash.style.opacity = '0';
  splash.style.transition = 'opacity 0.5s ease';
  setTimeout(() => splash.classList.add('hidden'), 500);
}

function openQuickActionModal() {
  openModal('modal-quick-action');
}

function initQuickActionListeners() {
  $('qa-create-group-btn')?.addEventListener('click', () => {
    closeModal('modal-quick-action');
    pendingMembers = [];
    if ($('group-name-input')) $('group-name-input').value = '';
    if ($('group-desc-input')) $('group-desc-input').value = '';
    if ($('member-email-input')) $('member-email-input').value = '';
    renderMemberChips();
    currentGroupType = 'trip';
    qsa('.gtype-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'trip'));
    openModal('modal-create-group');
  });

  $('qa-join-group-btn')?.addEventListener('click', () => {
    closeModal('modal-quick-action');
    if ($('join-code-input')) $('join-code-input').value = '';
    openModal('modal-join-group');
  });

  $('qa-add-expense-btn')?.addEventListener('click', () => {
    closeModal('modal-quick-action');
    navigateTo('add');
  });
}

function initNav() {
  $('bottom-nav')?.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', e => {
      addRipple(btn, e);
      if (btn.classList.contains('nav-add') || btn.dataset.page === 'add') {
        openQuickActionModal();
        return;
      }
      navigateTo(btn.dataset.page);
    });
  });
}

function updateSyncStatusBadge() {
  const badge = $('sync-status-badge');
  if (!badge) return;
  if (isDemoMode || !db) {
    badge.textContent = '⚡ Local Mode (Offline)';
    badge.style.background = 'rgba(255, 238, 220, 0.9)';
    badge.style.color = '#B76E00';
  } else {
    badge.textContent = '🟢 Live Cloud Sync';
    badge.style.background = 'rgba(184, 242, 208, 0.9)';
    badge.style.color = '#0E6237';
  }
}

function initEditExpenseListeners() {
  $('edit-expense-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const expenseId = $('edit-expense-id').value;
    const desc = $('edit-expense-desc').value.trim();
    const amount = parseFloat($('edit-expense-amount').value);
    const dateVal = $('edit-expense-date')?.value || new Date().toISOString().split('T')[0];

    if (!desc) { showToast('Enter expense description', 'error'); return; }
    if (!amount || amount <= 0 || isNaN(amount)) { showToast('Enter a valid amount', 'error'); return; }

    const exp = expenses.find(e => e.id === expenseId);
    if (!exp) return;

    const oldAmount = exp.amount;
    exp.desc = desc;
    exp.amount = amount;
    exp.date = dateVal;

    if (oldAmount > 0 && exp.splits) {
      const ratio = amount / oldAmount;
      Object.keys(exp.splits).forEach(email => {
        exp.splits[email] = parseFloat((exp.splits[email] * ratio).toFixed(2));
      });
    }

    if (activeDemoSession || isDemoMode || !db) {
      const demoDb = loadDemoDb();
      const targetExp = demoDb.expenses.find(e => e.id === expenseId);
      if (targetExp) {
        targetExp.desc = desc;
        targetExp.amount = amount;
        targetExp.date = dateVal;
        targetExp.splits = exp.splits;
      }
      saveDemoDb(demoDb);
    } else if (db) {
      try {
        await updateDoc(doc(db, 'expenses', expenseId), { desc, amount, date: dateVal, splits: exp.splits });
      } catch (err) {
        console.warn("Failed to update remote expense:", err);
      }
    }

    closeModal('modal-edit-expense');
    showToast('Expense updated! ✨', 'success');

    renderHome();
    renderGroups();
    renderActivity();
    if (currentGroupId) {
      const g = groups.find(grp => grp.id === currentGroupId);
      if (g) {
        renderVibeScore(currentGroupId);
        renderGroupBalances(currentGroupId, g);
        renderGroupExpenses(currentGroupId);
      }
    }
  });
}

async function init() {
  await new Promise(r => setTimeout(r, 1200));

  initNav();
  initAuthListeners();
  initGroupListeners();
  initQuickActionListeners();
  initExpenseForm();
  initEditExpenseListeners();
  initSettleListeners();
  initPollListeners();
  initSavingsListeners();
  initShareCardListeners();
  initActivityFilters();
  initProfileListeners();
  initModalCloseHandlers();
  updateSyncStatusBadge();

  if (isDemoMode || !auth) {
    hideSplash();
    showAuth();
  } else {
    onAuthStateChanged(auth, async user => {
      hideSplash();
      if (user) {
        currentUser = user;
        showApp();
        await loadUserData();
      } else {
        showAuth();
      }
    });
  }
}

init();
