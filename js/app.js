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
const DEMO_STORAGE_KEY = 'splitup_demo_db_v2';

function getDemoInitialData() {
  return {
    users: {
      'demo_user_1': {
        uid: 'demo_user_1',
        name: 'Priya Sharma',
        email: 'priya@example.com',
        currency: 'INR',
        streak: 4,
        totalExpenses: 5,
        createdAt: new Date().toISOString()
      }
    },
    groups: [
      {
        id: 'g_goa_trip',
        name: 'Goa Trip 🌴',
        type: 'trip',
        emoji: '✈️',
        members: ['demo_user_1', 'demo_user_2', 'demo_user_3'],
        memberEmails: ['priya@example.com', 'rahul@example.com', 'ananya@example.com'],
        createdBy: 'demo_user_1',
        createdAt: new Date().toISOString(),
        savingsGoal: {
          name: 'Manali Winter Fund 🏔️',
          target: 30000,
          current: 14500,
          currency: 'INR'
        }
      },
      {
        id: 'g_roommates',
        name: 'Roommates 🏠',
        type: 'home',
        emoji: '🏠',
        members: ['demo_user_1', 'demo_user_4'],
        memberEmails: ['priya@example.com', 'rohit@example.com'],
        createdBy: 'demo_user_1',
        createdAt: new Date().toISOString(),
        savingsGoal: null
      }
    ],
    expenses: [
      {
        id: 'exp_1',
        desc: 'Beach Shack Dinner 🍕',
        amount: 3600,
        currency: 'INR',
        category: 'food',
        emoji: '🍕',
        mood: 'worth-it',
        groupId: 'g_goa_trip',
        groupName: 'Goa Trip 🌴',
        paidBy: 'rahul@example.com',
        paidByEmail: 'rahul@example.com',
        paidByName: 'Rahul',
        splits: {
          'priya@example.com': 1200,
          'rahul@example.com': 1200,
          'ananya@example.com': 1200
        },
        splitMethod: 'equal',
        iouNote: 'Best seafood ever! 💖',
        settled: false,
        involvedUsers: ['demo_user_1'],
        createdBy: 'demo_user_2',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
      },
      {
        id: 'exp_2',
        desc: 'Uber to Calangute 🚗',
        amount: 850,
        currency: 'INR',
        category: 'transport',
        emoji: '🚗',
        mood: 'necessary',
        groupId: 'g_goa_trip',
        groupName: 'Goa Trip 🌴',
        paidBy: 'demo_user_1',
        paidByEmail: 'priya@example.com',
        paidByName: 'Me',
        splits: {
          'priya@example.com': 283.33,
          'rahul@example.com': 283.33,
          'ananya@example.com': 283.34
        },
        splitMethod: 'equal',
        iouNote: 'Traffic was insane 😭',
        settled: false,
        involvedUsers: ['demo_user_1'],
        createdBy: 'demo_user_1',
        createdAt: new Date(Date.now() - 3600000 * 18).toISOString()
      },
      {
        id: 'exp_3',
        desc: 'Sunset Cocktails 🍹',
        amount: 2200,
        currency: 'INR',
        category: 'fun',
        emoji: '🎉',
        mood: 'treat-yourself',
        groupId: 'g_goa_trip',
        groupName: 'Goa Trip 🌴',
        paidBy: 'ananya@example.com',
        paidByEmail: 'ananya@example.com',
        paidByName: 'Ananya',
        splits: {
          'priya@example.com': 733.33,
          'rahul@example.com': 733.33,
          'ananya@example.com': 733.34
        },
        splitMethod: 'equal',
        iouNote: 'Worth every rupee! 🍹✨',
        settled: false,
        involvedUsers: ['demo_user_1'],
        createdBy: 'demo_user_3',
        createdAt: new Date(Date.now() - 3600000 * 36).toISOString()
      },
      {
        id: 'exp_4',
        desc: 'Wifi & Electricity ⚡',
        amount: 2400,
        currency: 'INR',
        category: 'home',
        emoji: '🏠',
        mood: 'necessary',
        groupId: 'g_roommates',
        groupName: 'Roommates 🏠',
        paidBy: 'demo_user_1',
        paidByEmail: 'priya@example.com',
        paidByName: 'Me',
        splits: {
          'priya@example.com': 1200,
          'rohit@example.com': 1200
        },
        splitMethod: 'equal',
        iouNote: 'Please GPay on time! 📌',
        settled: false,
        involvedUsers: ['demo_user_1'],
        createdBy: 'demo_user_1',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
      }
    ],
    polls: [
      {
        id: 'poll_1',
        groupId: 'g_goa_trip',
        question: 'Should we book the ₹5000 Sunset Yacht or ₹2500 Kayaking? ⛵',
        options: [
          { label: '⛵ Sunset Yacht Cruise (₹5000)', votes: ['demo_user_1', 'demo_user_2'] },
          { label: '🚣 Kayaking Tour (₹2500)', votes: ['demo_user_3'] }
        ],
        createdBy: 'demo_user_1',
        createdAt: new Date().toISOString()
      }
    ]
  };
}

function loadDemoDb() {
  const raw = localStorage.getItem(DEMO_STORAGE_KEY);
  if (!raw) {
    const data = getDemoInitialData();
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
    return data;
  }
  try { return JSON.parse(raw); } catch (e) { return getDemoInitialData(); }
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
    activateDemoSession('priya@example.com', 'Priya Sharma');
  });

  // Email Sign In
  $('login-btn')?.addEventListener('click', async () => {
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    if (!email || !password) { showToast('Please fill in all fields 🌸', 'error'); return; }

    if (isDemoMode || !auth) {
      activateDemoSession(email, email.split('@')[0]);
      return;
    }

    $('login-btn').disabled = true;
    $('login-btn').textContent = 'Signing in...';
    try {
      await signInWithEmailAndPassword(auth, email, password);
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
    if (isDemoMode || !auth) {
      activateDemoSession('google_friend@example.com', 'Google Friend');
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) await createUserProfile(user, user.displayName || 'Friend');
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
  await setDoc(doc(db, 'users', user.uid), {
    name,
    email: user.email,
    currency: 'INR',
    streak: 0,
    lastSettledAt: null,
    totalExpenses: 0,
    createdAt: serverTimestamp()
  });
}

function activateDemoSession(email, name) {
  activeDemoSession = true;
  currentUser = { uid: 'demo_user_1', email, displayName: name };
  const dbData = loadDemoDb();
  userProfile = dbData.users['demo_user_1'] || { name, email, currency: 'INR', streak: 4, totalExpenses: 5 };
  userProfile.name = name;
  userProfile.email = email;
  groups = dbData.groups || [];
  expenses = dbData.expenses || [];
  showApp();
  updateTopBar();
  renderHome();
  hideSplash();
  showToast(`Welcome to Split Up Instant Demo Mode, ${name.split(' ')[0]}! ✨`, 'success', 3200);
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadUserData() {
  if (activeDemoSession || isDemoMode || !db) {
    const dbData = loadDemoDb();
    userProfile = dbData.users['demo_user_1'] || { name: currentUser.displayName || 'Friend', currency: 'INR', streak: 4 };
    groups = dbData.groups || [];
    expenses = dbData.expenses || [];
    updateTopBar();
    renderHome();
    return;
  }

  try {
    const ref = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) userProfile = snap.data();
    else userProfile = { name: currentUser.displayName || 'Friend', currency: 'INR', streak: 0 };

    updateTopBar();
    await loadGroups();
    await loadExpenses();
    renderHome();
  } catch (err) {
    console.warn("Firestore fallback to local storage:", err);
    activateDemoSession(currentUser.email || 'friend@example.com', currentUser.displayName || 'Friend');
  }
}

function updateTopBar() {
  const name = userProfile.name || currentUser?.displayName || 'Friend';
  if ($('user-avatar')) $('user-avatar').textContent = getUserInitial(name);
  if ($('home-username')) $('home-username').textContent = `Hey, ${name.split(' ')[0]}!`;
  if ($('greeting-text')) $('greeting-text').textContent = getGreeting();
}

// ============================================================
// GROUPS
// ============================================================
async function loadGroups() {
  if (activeDemoSession || isDemoMode || !db) {
    groups = loadDemoDb().groups;
    return;
  }
  const q = query(collection(db, 'groups'), where('members', 'array-contains', currentUser.uid));
  const snap = await getDocs(q);
  groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function initGroupListeners() {
  ['new-group-btn'].forEach(id => {
    $(id)?.addEventListener('click', () => {
      pendingMembers = [];
      $('group-name-input').value = '';
      $('member-email-input').value = '';
      $('members-list').innerHTML = '';
      currentGroupType = 'trip';
      qsa('.gtype-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'trip'));
      openModal('modal-create-group');
    });
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

function addMemberEmail() {
  const email = $('member-email-input').value.trim();
  if (!email || !email.includes('@')) { showToast('Enter a valid email 📧', 'error'); return; }
  if (pendingMembers.includes(email)) { showToast('Already added!', 'error'); return; }
  if (email === currentUser?.email) { showToast('You\'re already in the group 😊', 'error'); return; }

  pendingMembers.push(email);
  $('member-email-input').value = '';
  renderMemberChips();
}

function renderMemberChips() {
  const container = $('members-list');
  if (!container) return;
  container.innerHTML = pendingMembers.map(email => `
    <span class="member-chip">
      ${email}
      <button class="member-chip-remove" data-email="${email}" aria-label="Remove">✕</button>
    </span>
  `).join('');

  container.querySelectorAll('.member-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingMembers = pendingMembers.filter(e => e !== btn.dataset.email);
      renderMemberChips();
    });
  });
}

async function createGroup() {
  const name = $('group-name-input').value.trim();
  if (!name) { showToast('Give your group a name! 🌸', 'error'); return; }

  const btn = $('create-group-btn');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    const groupData = {
      id: 'g_' + Date.now(),
      name,
      type: currentGroupType,
      emoji: getGroupEmoji(currentGroupType),
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
      groups.unshift({ id: ref.id, ...groupData });
    }

    closeModal('modal-create-group');
    showToast(`"${name}" created! 🎉`, 'success');
    renderGroups();
    renderHome();
    launchConfetti();
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
        <span class="empty-emoji">👯</span>
        <p>No groups yet</p>
        <p class="empty-sub">Tap "+ New" to create one!</p>
      </div>`;
    return;
  }

  container.innerHTML = groups.map((g, i) => {
    const balance = getGroupBalance(g.id);
    const balClass = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral';
    const balText = balance === 0 ? 'All settled ✓' :
      balance > 0 ? `+${formatAmount(balance, getUserPreferredCurrency())} owed to you` :
        `${formatAmount(Math.abs(balance), getUserPreferredCurrency())} you owe`;
    return `
      <div class="group-card anim-fade-in" data-group-id="${g.id}" style="animation-delay:${i * 0.05}s">
        <span class="group-card-emoji">${g.emoji}</span>
        <div class="group-card-name">${g.name}</div>
        <div class="group-card-members">
          ${g.memberEmails?.length || 1} member${(g.memberEmails?.length || 1) !== 1 ? 's' : ''}
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
  sel.innerHTML = '<option value="">Select a group...</option>' +
    groups.map(g => `<option value="${g.id}">${g.emoji} ${g.name}</option>`).join('');

  if ($('expense-currency')) $('expense-currency').value = getUserPreferredCurrency();

  currentCategory = 'food';
  currentMood = 'worth-it';
  currentSplitMethod = 'equal';
  qsa('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'food'));
  qsa('.mood-btn').forEach(b => b.classList.toggle('active', b.dataset.mood === 'worth-it'));
  qsa('.split-tab').forEach(t => t.classList.toggle('active', t.dataset.method === 'equal'));

  if ($('split-detail')) $('split-detail').innerHTML = '';
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
  if (currentSplitMethod === 'equal') {
    const each = amount / members.length;
    return Object.fromEntries(members.map(m => [m, each]));
  }

  const inputs = qsa('#split-detail .split-person-input');
  const values = inputs.map(i => ({ email: i.dataset.email, val: parseFloat(i.value) || 0 }));

  if (currentSplitMethod === 'percentage') {
    const total = values.reduce((s, v) => s + v.val, 0);
    if (Math.abs(total - 100) > 0.5) {
      showToast(`Percentages must add up to 100% (currently ${total}%)`, 'error');
      return null;
    }
    return Object.fromEntries(values.map(v => [v.email, (v.val / 100) * amount]));
  }

  if (currentSplitMethod === 'exact') {
    const total = values.reduce((s, v) => s + v.val, 0);
    if (Math.abs(total - amount) > 0.01) {
      showToast(`Amounts must add up to ${formatAmount(amount, currency)}`, 'error');
      return null;
    }
    return Object.fromEntries(values.map(v => [v.email, v.val]));
  }

  if (currentSplitMethod === 'shares') {
    const totalShares = values.reduce((s, v) => s + v.val, 0);
    if (totalShares <= 0) return null;
    return Object.fromEntries(values.map(v => [v.email, (v.val / totalShares) * amount]));
  }

  return null;
}

async function submitExpense(e) {
  e.preventDefault();
  const desc = $('expense-desc').value.trim();
  const amount = parseFloat($('expense-amount').value);
  const currency = $('expense-currency').value;
  const groupId = $('expense-group').value;
  const iouNote = $('iou-note').value.trim();
  const paidBy = $('expense-paid-by').value;

  if (!desc) { showToast('What was the expense for? 🌸', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Enter a valid amount 💰', 'error'); return; }
  if (!groupId) { showToast('Pick a group! 👯', 'error'); return; }

  const group = groups.find(g => g.id === groupId);
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
      category: currentCategory,
      emoji: getCategoryEmoji(currentCategory),
      mood: currentMood,
      groupId,
      groupName: group.name,
      paidBy,
      paidByEmail: paidBy === currentUser.uid ? currentUser.email : paidBy,
      paidByName: paidBy === currentUser.uid ? (userProfile.name || 'Me') : paidBy.split('@')[0],
      splits: splitData,
      splitMethod: currentSplitMethod,
      iouNote,
      settled: false,
      involvedUsers: [currentUser.uid],
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString()
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
}

function renderActivity() {
  const container = $('activity-list');
  if (!container) return;
  let filtered = expenses;

  if (currentFilter === 'settled') filtered = expenses.filter(e => e.settled);
  else if (currentFilter === 'owed') {
    filtered = expenses.filter(e => !e.settled && (e.paidBy === currentUser.uid || e.paidByEmail === currentUser.email));
  } else if (currentFilter === 'owes') {
    filtered = expenses.filter(e => !e.settled && e.paidBy !== currentUser.uid && e.paidByEmail !== currentUser.email);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <span class="empty-emoji">📋</span>
      <p>Nothing here yet!</p>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(exp => renderActivityItem(exp)).join('');
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
        ${exp.mood ? `<span class="mood-tag">${moodBadges[exp.mood] || exp.mood}</span>` : ''}
        ${exp.settled ? '<span class="settled-badge">✓ Settled</span>' : ''}
      </div>
      <div class="activity-amount ${amountClass}">${amountText}</div>
    </div>`;
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

  if ($('gd-title')) $('gd-title').textContent = `${group.emoji} ${group.name}`;

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
}

// ============================================================
// SETTLE UP & STREAKS
// ============================================================
function initSettleListeners() {
  $('confirm-settle-btn')?.addEventListener('click', async () => {
    if (!settleTarget) return;
    const note = $('settle-note').value.trim();

    const btn = $('confirm-settle-btn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
      expenses.filter(e => e.groupId === settleTarget.groupId && !e.settled).forEach(e => e.settled = true);

      const newStreak = (userProfile.streak || 0) + 1;
      userProfile.streak = newStreak;

      if (activeDemoSession || isDemoMode || !db) {
        const demoDb = loadDemoDb();
        demoDb.expenses.filter(e => e.groupId === settleTarget.groupId && !e.settled).forEach(e => e.settled = true);
        if (demoDb.users['demo_user_1']) demoDb.users['demo_user_1'].streak = newStreak;
        saveDemoDb(demoDb);
      }

      closeModal('modal-settle');
      closeModal('modal-group-detail');
      showToast(`Settled up! 🎉 +1 Streak 🔥 (${newStreak}d streak!)`, 'success', 3200);
      launchConfetti();
      renderHome();
      renderActivity();
    } catch (err) {
      showToast('Couldn\'t mark as settled 😔', 'error');
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
}

function initProfileListeners() {
  $('user-avatar-btn')?.addEventListener('click', () => {
    const name = userProfile.name || currentUser?.displayName || 'Friend';
    if ($('profile-avatar-large')) $('profile-avatar-large').textContent = getUserInitial(name);
    if ($('profile-name-display')) $('profile-name-display').textContent = name;
    if ($('profile-email-display')) $('profile-email-display').textContent = currentUser?.email || '—';
    if ($('p-total-expenses')) $('p-total-expenses').textContent = userProfile.totalExpenses || expenses.length;
    if ($('p-total-groups')) $('p-total-groups').textContent = groups.length;
    if ($('p-streak')) $('p-streak').textContent = `🔥${userProfile.streak || 4}`;
    if ($('pref-currency')) $('pref-currency').value = userProfile.currency || 'INR';
    openModal('modal-profile');
  });

  $('save-profile-btn')?.addEventListener('click', async () => {
    const currency = $('pref-currency').value;
    userProfile.currency = currency;
    showToast('Preferences saved! ✨', 'success');
    closeModal('modal-profile');
    renderHome();
  });

  $('signout-btn')?.addEventListener('click', () => {
    activeDemoSession = false;
    currentUser = null;
    userProfile = {};
    groups = [];
    expenses = [];
    showAuth();
    showToast('Signed out! 👋', 'info');
  });
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

function initNav() {
  $('bottom-nav')?.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', e => {
      addRipple(btn, e);
      navigateTo(btn.dataset.page);
    });
  });
}

async function init() {
  await new Promise(r => setTimeout(r, 1200));

  initNav();
  initAuthListeners();
  initGroupListeners();
  initExpenseForm();
  initSettleListeners();
  initPollListeners();
  initSavingsListeners();
  initShareCardListeners();
  initActivityFilters();
  initProfileListeners();
  initModalCloseHandlers();

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
