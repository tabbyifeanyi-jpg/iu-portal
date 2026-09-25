// ==========================================================
// IGBINEDION UNIVERSITY CAMPUS PORTAL - FIREBASE.JS
// Handles: Firebase init, Firestore sync, CRUD helpers
// ==========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* ---------- FIREBASE CONFIG ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyAG_mwux2MuPMoXfoq2gLoNiW7D5hwrIUU",
  authDomain: "my-live-website-b932b.firebaseapp.com",
  projectId: "my-live-website-b932b",
  storageBucket: "my-live-website-b932b.firebasestorage.app",
  messagingSenderId: "435523796198",
  appId: "1:435523796198:web:b7d30086966afcdb084f27",
  measurementId: "G-4E4WV9HXL4"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

/* ---------- COLLECTIONS ---------- */
const COL = {
  users: "users",
  products: "products",
  orders: "orders",
  tickets: "tickets",
  dms: "direct_messages",
  live: "campus_live_chat",
  notifications: "notifications",
  reviews: "reviews",
  withdrawals: "withdrawals",
  reports: "reports"
};

/* ---------- LOCAL STATE (mirrors Firestore) ---------- */
let usersArr = [];
let productsArr = [];
let ordersArr = [];
let ticketsArr = [];
let dmsArr = [];
let notifArr = [];
let reviewsArr = [];
let withdrawalsArr = [];
let reportsArr = [];
let liveMsgsArr = [];

/* ---------- DEFAULT ADMIN SEED ---------- */
const DEFAULT_ADMIN = {
  username: "chris.bone",
  password: "20232023P",
  name: "Chris Bone (Master Admin)",
  isAdmin: true,
  isBanned: false,
  isPrivate: false,
  isVerified: true,
  verifiedTier: "gold",
  balance: 0,
  avatarUrl: "",
  followers: [],
  following: [],
  blocked: [],
  rating: 0,
  ratingCount: 0,
  createdAt: Date.now()
};

async function ensureAdmin() {
  const adminRef = doc(db, COL.users, DEFAULT_ADMIN.username);
  const snap = await getDoc(adminRef);
  if (!snap.exists()) {
    await setDoc(adminRef, DEFAULT_ADMIN);
    console.log("[Firebase] Seeded admin account.");
  }
}

/* ---------- PUSH STATE TO APP.JS ---------- */
function pushState() {
  if (window.onFirebaseDataReady) {
    window.onFirebaseDataReady({
      users: usersArr,
      products: productsArr,
      orders: ordersArr,
      tickets: ticketsArr,
      dms: dmsArr,
      notifications: notifArr,
      reviews: reviewsArr,
      withdrawals: withdrawalsArr,
      reports: reportsArr
    });
  }
}

function notifyChange(colName) {
  if (window.onFirestoreSync) window.onFirestoreSync(colName);
}

/* ---------- REAL-TIME LISTENERS ---------- */
function listenUsers() {
  onSnapshot(collection(db, COL.users), (snap) => {
    usersArr = [];
    snap.forEach((d) => usersArr.push({ ...d.data(), _id: d.id }));
    pushState();
    notifyChange("users");
  });
}

function listenProducts() {
  onSnapshot(collection(db, COL.products), (snap) => {
    productsArr = [];
    snap.forEach((d) => productsArr.push({ ...d.data(), _id: d.id }));
    pushState();
    notifyChange("products");
  });
}

function listenOrders() {
  onSnapshot(collection(db, COL.orders), (snap) => {
    ordersArr = [];
    snap.forEach((d) => ordersArr.push({ ...d.data(), _id: d.id }));
    pushState();
    notifyChange("orders");
  });
}

function listenTickets() {
  onSnapshot(collection(db, COL.tickets), (snap) => {
    ticketsArr = [];
    snap.forEach((d) => ticketsArr.push({ ...d.data(), _id: d.id }));
    pushState();
    notifyChange("tickets");
  });
}

function listenDMs() {
  onSnapshot(collection(db, COL.dms), (snap) => {
    dmsArr = [];
    snap.forEach((d) => dmsArr.push({ ...d.data(), _id: d.id }));
    pushState();
    notifyChange("dms");
  });
}

function listenNotifications() {
  onSnapshot(collection(db, COL.notifications), (snap) => {
    notifArr = [];
    snap.forEach((d) => notifArr.push({ ...d.data(), _id: d.id }));
    notifArr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    pushState();
    notifyChange("notifications");
  });
}

function listenReviews() {
  onSnapshot(collection(db, COL.reviews), (snap) => {
    reviewsArr = [];
    snap.forEach((d) => reviewsArr.push({ ...d.data(), _id: d.id }));
    pushState();
    notifyChange("reviews");
  });
}

function listenWithdrawals() {
  onSnapshot(collection(db, COL.withdrawals), (snap) => {
    withdrawalsArr = [];
    snap.forEach((d) => withdrawalsArr.push({ ...d.data(), _id: d.id }));
    withdrawalsArr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    pushState();
    notifyChange("withdrawals");
  });
}

function listenReports() {
  onSnapshot(collection(db, COL.reports), (snap) => {
    reportsArr = [];
    snap.forEach((d) => reportsArr.push({ ...d.data(), _id: d.id }));
    pushState();
    notifyChange("reports");
  });
}

function listenLiveChat() {
  const q = query(collection(db, COL.live), orderBy("createdAt", "asc"), limit(250));
  onSnapshot(q, (snap) => {
    liveMsgsArr = [];
    snap.forEach((d) => {
      const m = d.data();
      let timeStr = "";
      if (m.createdAt && m.createdAt.toDate) {
        timeStr = m.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      liveMsgsArr.push({ ...m, timeStr });
    });
    if (window.onLiveChatUpdate) window.onLiveChatUpdate(liveMsgsArr);
  });
}

/* ==========================================================
   PUBLIC HELPERS — exposed on window for app.js to use
   ========================================================== */

/* ---------- USERS ---------- */
window.fsCreateUser = async (user) => {
  await setDoc(doc(db, COL.users, user.username), user);
};

window.fsUpdateUser = async (username, updates) => {
  await updateDoc(doc(db, COL.users, username), updates);
};

window.fsIncrementUser = async (username, field, amount) => {
  await updateDoc(doc(db, COL.users, username), { [field]: increment(amount) });
};

window.fsGetUser = async (username) => {
  const snap = await getDoc(doc(db, COL.users, username));
  return snap.exists() ? { ...snap.data(), _id: snap.id } : null;
};

/* ---------- PRODUCTS ---------- */
window.fsCreateProduct = async (prod) => {
  await setDoc(doc(db, COL.products, prod.id), prod);
};

window.fsUpdateProduct = async (id, updates) => {
  await updateDoc(doc(db, COL.products, id), updates);
};

window.fsDeleteProduct = async (id) => {
  await deleteDoc(doc(db, COL.products, id));
};

/* ---------- ORDERS ---------- */
window.fsCreateOrder = async (order) => {
  await setDoc(doc(db, COL.orders, order.id), order);
};

window.fsUpdateOrder = async (id, updates) => {
  await updateDoc(doc(db, COL.orders, id), updates);
};

/* ---------- TICKETS ---------- */
window.fsCreateTicket = async (ticket) => {
  await setDoc(doc(db, COL.tickets, ticket.id), ticket);
};

window.fsUpdateTicket = async (id, updates) => {
  await updateDoc(doc(db, COL.tickets, id), updates);
};

/* ---------- DMS ---------- */
window.fsCreateDM = async (dm) => {
  await setDoc(doc(db, COL.dms, dm.id), dm);
};

/* ---------- LIVE CHAT ---------- */
window.fsCreateLiveMsg = async (msg) => {
  await addDoc(collection(db, COL.live), {
    username: msg.username,
    avatarUrl: msg.avatarUrl || "",
    text: msg.text,
    createdAt: serverTimestamp()
  });
};

/* ---------- NOTIFICATIONS ---------- */
window.fsCreateNotification = async (notif) => {
  const id = "n_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  await setDoc(doc(db, COL.notifications, id), {
    id,
    ...notif,
    isRead: false,
    timestamp: Date.now()
  });
};

window.fsMarkNotifRead = async (id) => {
  await updateDoc(doc(db, COL.notifications, id), { isRead: true });
};

window.fsMarkAllNotifsRead = async (username) => {
  const targets = notifArr.filter((n) => n.forUser === username && !n.isRead);
  for (const n of targets) {
    await updateDoc(doc(db, COL.notifications, n._id), { isRead: true });
  }
};

window.fsDeleteNotification = async (id) => {
  await deleteDoc(doc(db, COL.notifications, id));
};

/* ---------- REVIEWS ---------- */
window.fsCreateReview = async (review) => {
  const id = "r_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  await setDoc(doc(db, COL.reviews, id), {
    id,
    ...review,
    timestamp: Date.now()
  });
};

/* ---------- WITHDRAWALS ---------- */
window.fsCreateWithdrawal = async (wd) => {
  await setDoc(doc(db, COL.withdrawals, wd.id), wd);
};

window.fsUpdateWithdrawal = async (id, updates) => {
  await updateDoc(doc(db, COL.withdrawals, id), updates);
};

/* ---------- REPORTS ---------- */
window.fsCreateReport = async (report) => {
  const id = "rep_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  await setDoc(doc(db, COL.reports, id), {
    id,
    ...report,
    status: "pending",
    timestamp: Date.now()
  });
};

window.fsUpdateReport = async (id, updates) => {
  await updateDoc(doc(db, COL.reports, id), updates);
};

/* ==========================================================
   BOOT: seed admin + start all listeners
   ========================================================== */
(async () => {
  try {
    await ensureAdmin();
    listenUsers();
    listenProducts();
    listenOrders();
    listenTickets();
    listenDMs();
    listenNotifications();
    listenReviews();
    listenWithdrawals();
    listenReports();
    listenLiveChat();
    console.log("[Firebase] All listeners started.");
  } catch (err) {
    console.error("[Firebase] Boot error:", err);
    const loadingEl = document.getElementById("loadingScreen");
    if (loadingEl) {
      loadingEl.innerHTML = `<p class="text-red-300 text-xs text-center px-6">Failed to connect to Firebase.<br><br>${err.message}</p>`;
    }
  }
})();