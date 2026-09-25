// ==========================================================
// IGBINEDION UNIVERSITY CAMPUS PORTAL - FIREBASE.JS
// Handles: Firebase init, Firestore sync, CRUD helpers
// UPDATED: Product views, message reactions, push notifications,
// admin Paystack payout, announcements
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
  increment,
  arrayUnion,
  arrayRemove
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
  reports: "reports",
  announcements: "announcements"
};

/* ---------- LOCAL STATE ---------- */
let usersArr = [];
let productsArr = [];
let ordersArr = [];
let ticketsArr = [];
let dmsArr = [];
let notifArr = [];
let reviewsArr = [];
let withdrawalsArr = [];
let reportsArr = [];
let announcementsArr = [];
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
  dismissedAnnouncements: [],
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
      reports: reportsArr,
      announcements: announcementsArr
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

function listenAnnouncements() {
  onSnapshot(collection(db, COL.announcements), (snap) => {
    announcementsArr = [];
    snap.forEach((d) => announcementsArr.push({ ...d.data(), _id: d.id }));
    announcementsArr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    pushState();
    notifyChange("announcements");
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
   PUBLIC HELPERS — exposed on window
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

window.fsIncrementProductView = async (id) => {
  try {
    await updateDoc(doc(db, COL.products, id), { views: increment(1) });
  } catch (err) { /* silent */ }
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

window.fsMarkDMRead = async (id) => {
  try {
    await updateDoc(doc(db, COL.dms, id), { isRead: true });
  } catch (err) { /* silent */ }
};

window.fsToggleDMReaction = async (msgId, emoji, username) => {
  try {
    const ref = doc(db, COL.dms, msgId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const reactions = data.reactions || {};
    const usersReacted = reactions[emoji] || [];
    if (usersReacted.includes(username)) {
      await updateDoc(ref, { [`reactions.${emoji}`]: arrayRemove(username) });
    } else {
      await updateDoc(ref, { [`reactions.${emoji}`]: arrayUnion(username) });
    }
  } catch (err) { /* silent */ }
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
  // Trigger push if function exists in app.js
  if (window.onNewNotificationForPush) {
    window.onNewNotificationForPush(notif);
  }
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

/* ---------- ANNOUNCEMENTS ---------- */
window.fsCreateAnnouncement = async (ann) => {
  const id = "ann_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  await setDoc(doc(db, COL.announcements, id), {
    id,
    ...ann,
    timestamp: Date.now()
  });
};

window.fsDeleteAnnouncement = async (id) => {
  await deleteDoc(doc(db, COL.announcements, id));
};

/* ---------- PAYSTACK ADMIN PAYOUT ---------- */
/* This creates a Paystack recipient + initiates transfer.
   Requires admin to have Transfers API enabled on Paystack. */
window.fsAdminPaystackPayout = async ({ bankCode, accountNumber, accountName, amountNaira, reason }) => {
  const PAYSTACK_SECRET_KEY = "sk_live_YOUR_SECRET_KEY_HERE"; // ⚠️ REPLACE THIS
  try {
    // Step 1: Create recipient
    const createRecipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN"
      })
    });
    const recipientData = await createRecipientRes.json();
    if (!recipientData.status) {
      throw new Error(recipientData.message || "Recipient creation failed");
    }

    // Step 2: Initiate transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(amountNaira * 100),
        recipient: recipientData.data.recipient_code,
        reason: reason || "IU Campus Withdrawal"
      })
    });
    const transferData = await transferRes.json();
    if (!transferData.status) {
      throw new Error(transferData.message || "Transfer failed");
    }
    return { success: true, transferCode: transferData.data.transfer_code, reference: transferData.data.reference };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/* ==========================================================
   BOOT
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
    listenAnnouncements();
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