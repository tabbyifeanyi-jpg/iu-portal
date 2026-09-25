// ==========================================================
// IGBINEDION UNIVERSITY CAMPUS PORTAL - APP.JS
// UPDATED: Confirm-before-buy, auto-DM on purchase,
// all-status listings, cancel escrow, wallet pending
// ==========================================================

/* ---------- GLOBAL STATE ---------- */
let currentUser = null;
let users = [];
let products = [];
let orders = [];
let supportTickets = [];
let directMessages = [];
let notifications = [];
let reviews = [];
let withdrawals = [];
let reports = [];
let announcements = [];

let activeChatTarget = null;
let activeTagFilter = 'all';
let currentAppTheme = localStorage.getItem('iu_theme') || 'party';
let currentDetailSeller = '';
let currentChatMode = 'ai';
let currentChatSubMode = 'ai';
let tempProductImagesBase64 = [];
let tempSignupAvatarBase64 = '';
let dbReady = false;
let searchMode = 'products';
let currentRatingOrderId = null;
let currentRatingValue = 0;
let notifFilter = 'all';

let lightboxImages = [];
let lightboxIndex = 0;
let reactionPickerMsgId = null;
let deferredPrompt = null;

// Track buttons currently processing to prevent double-tap
let processingButtons = new Set();

let aiChatHistory = [{
  id: 1,
  sender: 'ai',
  text: "Hello! Welcome to IU Campus Escrow Portal 😊✨\n\nI'm your smart assistant. I know everything about buying, selling, escrow, verification, withdrawal, and more!\n\nHow can I help?",
  options: null
}];

const HELP_TOPICS = [
  { key: 'payments', label: '🛡️ Escrow & Buyer Approval' },
  { key: 'seller_payout', label: '💰 Seller Payouts & 5% Fee' },
  { key: 'dispute_info', label: '⚠️ Refund / Dispute Escrow' },
  { key: 'upload_prod', label: '📦 Post a Product (with photos)' },
  { key: 'verification', label: '🏆 Get Verified (Gold/Silver)' },
  { key: 'boost', label: '⭐ Boost My Listing' },
  { key: 'withdraw', label: '💸 Withdraw to Bank' },
  { key: 'deposit', label: '💳 Deposit with Paystack' },
  { key: 'dm', label: '💬 Chat / DM Someone' },
  { key: 'block_report', label: '🚩 Report or Block a User' },
  { key: 'ticket', label: '🎫 Open Support Ticket' }
];

/* ==========================================================
   TOASTS & UTILITIES
   ========================================================== */
function showToast(message, isError = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md text-xs font-bold text-white border animate-toast ${isError ? 'bg-red-600/90 border-red-400' : 'bg-emerald-600/90 border-emerald-400'}`;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-4', 'transition-all', 'duration-500');
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString();
}

function compressImage(file, maxWidth = 800, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ==========================================================
   THEME
   ========================================================== */
function setAppTheme(themeName, save = true) {
  currentAppTheme = themeName;
  document.getElementById('appBody').className =
    `font-sans min-h-screen text-slate-100 relative overflow-x-hidden selection:bg-purple-500 selection:text-white theme-${themeName}`;
  if (save) localStorage.setItem('iu_theme', themeName);
}

/* ==========================================================
   MODAL HELPERS
   ========================================================== */
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

function guardedAction(action) {
  if (!currentUser) { openModal('customAlertModal'); return; }
  if (currentUser.isBanned) { openModal('bannedModal'); return; }
  action();
}

/* ==========================================================
   SECTION NAVIGATION
   ========================================================== */
function showSection(sectionId) {
  ['feedSection', 'chatSection', 'profileSection', 'adminSection', 'notificationsSection']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  document.getElementById(sectionId)?.classList.remove('hidden');
  if (sectionId === 'chatSection') renderChatFeed();
  if (sectionId === 'adminSection') renderAdminPanel();
  if (sectionId === 'profileSection') {
    renderBuyerOrders();
    renderMyListings();
    renderMyReviews();
  }
  if (sectionId === 'notificationsSection') renderNotificationsPage();
}

/* ==========================================================
   VERIFICATION BADGE
   ========================================================== */
function renderVerifiedBadge(username) {
  const u = users.find(x => x.username === username);
  if (!u || !u.isVerified) return '';
  if (u.verifiedTier === 'gold') {
    return `<span class="badge-verified-gold" title="Gold Verified"><i class="fa-solid fa-check"></i></span>`;
  }
  return `<span class="badge-verified-silver" title="Silver Verified"><i class="fa-solid fa-check"></i></span>`;
}

/* ==========================================================
   STARS
   ========================================================== */
function renderStars(rating, size = 'text-[10px]') {
  const full = Math.round(rating || 0);
  let html = '<span class="inline-flex gap-0.5">';
  for (let i = 1; i <= 5; i++) {
    html += `<i class="fa-solid fa-star ${i <= full ? 'star-filled' : 'star-empty'} ${size}"></i>`;
  }
  html += '</span>';
  return html;
}

function getUserRating(username) {
  const u = users.find(x => x.username === username);
  if (!u) return { rating: 0, count: 0 };
  return { rating: u.rating || 0, count: u.ratingCount || 0 };
}

/* ==========================================================
   ANNOUNCEMENTS
   ========================================================== */
function renderAnnouncements() {
  const container = document.getElementById('announcementContainer');
  if (!container) return;

  const myDismissed = (currentUser && currentUser.dismissedAnnouncements) || [];
  const visible = announcements.filter(a => !myDismissed.includes(a.id));

  if (!visible.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = visible.map(a => `
    <div class="announcement-banner animate-slide-down">
      <div class="announcement-close" onclick="dismissAnnouncement('${a.id}')">
        <i class="fa-solid fa-xmark"></i>
      </div>
      <div class="flex items-start gap-2">
        <div class="announcement-icon"><i class="fa-solid fa-bullhorn"></i></div>
        <div class="flex-1">
          <div class="announcement-title">📢 Announcement</div>
          <div class="announcement-text">${escapeHtml(a.text)}</div>
          <div class="announcement-time">${timeAgo(a.timestamp)}</div>
        </div>
      </div>
    </div>
  `).join('');
}

async function dismissAnnouncement(id) {
  if (!currentUser) return;
  const dismissed = [...(currentUser.dismissedAnnouncements || []), id];
  currentUser.dismissedAnnouncements = dismissed;
  try {
    await window.fsUpdateUser(currentUser.username, { dismissedAnnouncements: dismissed });
    renderAnnouncements();
  } catch (err) { /* silent */ }
}

async function postAnnouncement() {
  if (!currentUser || !currentUser.isAdmin) return;
  const text = prompt("📢 Enter announcement text (will be shown to everyone):");
  if (!text || !text.trim()) return;

  try {
    await window.fsCreateAnnouncement({
      text: text.trim(),
      postedBy: currentUser.username
    });
    showToast("Announcement posted to everyone! 📢");
  } catch (err) { showToast("Post failed", true); }
}

async function deleteAnnouncement(id) {
  if (!currentUser || !currentUser.isAdmin) return;
  if (!confirm("Delete this announcement?")) return;
  try {
    await window.fsDeleteAnnouncement(id);
    showToast("Announcement deleted");
  } catch (err) { showToast("Failed", true); }
}

/* ==========================================================
   MARKET TABS
   ========================================================== */
function switchMarketTab(tabType) {
  const buyGrid = document.getElementById('buyProductGrid');
  const rentGrid = document.getElementById('rentProductGrid');
  const buyBtn = document.getElementById('tabBuyBtn');
  const rentBtn = document.getElementById('tabRentBtn');
  if (tabType === 'buy') {
    buyGrid.classList.remove('hidden'); rentGrid.classList.add('hidden');
    buyBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg bg-purple-600/70 text-white shadow-md transition border border-white/20 backdrop-blur-md';
    rentBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg text-purple-200/70 hover:text-white transition';
  } else {
    buyGrid.classList.add('hidden'); rentGrid.classList.remove('hidden');
    rentBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg bg-purple-600/70 text-white shadow-md transition border border-white/20 backdrop-blur-md';
    buyBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg text-purple-200/70 hover:text-white transition';
  }
}

function setCategoryFilter(tag) {
  activeTagFilter = tag;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.remove('bg-purple-600', 'text-white');
    btn.classList.add('bg-white/10', 'text-purple-200');
  });
  const activeBtn = document.getElementById(`cat-${tag}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-white/10', 'text-purple-200');
    activeBtn.classList.add('bg-purple-600', 'text-white');
  }
  renderProducts();
}

function setSearchMode(mode) {
  searchMode = mode;
  document.getElementById('searchModeProductsBtn').className = mode === 'products'
    ? 'flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-purple-600/70 text-white'
    : 'flex-1 py-1.5 text-[10px] font-bold rounded-lg text-purple-200/70';
  document.getElementById('searchModePeopleBtn').className = mode === 'people'
    ? 'flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-purple-600/70 text-white'
    : 'flex-1 py-1.5 text-[10px] font-bold rounded-lg text-purple-200/70';
  document.getElementById('searchInput').placeholder = mode === 'products'
    ? 'Search items, users...'
    : 'Search people by name or @username...';
  renderProducts();
}

/* ==========================================================
   MULTI IMAGE UPLOAD
   ========================================================== */
async function handleMultiImageUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  if (tempProductImagesBase64.length + files.length > 4) {
    showToast("Max 4 images per product", true);
    return;
  }
  try {
    for (const file of files) {
      const compressed = await compressImage(file, 800, 0.6);
      tempProductImagesBase64.push(compressed);
    }
    renderImagePreviews();
  } catch (err) { showToast("Could not read image", true); }
}

function renderImagePreviews() {
  const box = document.getElementById('imagePreviewBox');
  if (!box) return;
  if (tempProductImagesBase64.length === 0) {
    box.classList.add('hidden'); box.innerHTML = ''; return;
  }
  box.classList.remove('hidden');
  box.innerHTML = tempProductImagesBase64.map((img, i) => `
    <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-white/20">
      <img src="${img}" class="w-full h-full object-cover">
      <button type="button" onclick="removeProductImage(${i})" class="absolute top-0 right-0 bg-red-600 text-white w-5 h-5 rounded-bl-lg text-[10px] font-bold">×</button>
    </div>
  `).join('');
}

function removeProductImage(i) {
  tempProductImagesBase64.splice(i, 1);
  renderImagePreviews();
}

async function previewSignupAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    tempSignupAvatarBase64 = await compressImage(file, 300, 0.7);
    document.getElementById('signupAvatarImgTag').src = tempSignupAvatarBase64;
    document.getElementById('signupAvatarPreview').classList.remove('hidden');
  } catch (err) { showToast("Could not read image", true); }
}

/* ==========================================================
   RENDER PRODUCTS
   ========================================================== */
function renderProducts() {
  const buyGrid = document.getElementById('buyProductGrid');
  const rentGrid = document.getElementById('rentProductGrid');
  const searchQuery = (document.getElementById('searchInput').value || '').toLowerCase().trim();

  if (searchMode === 'people') { renderPeopleSearch(searchQuery); return; }

  document.getElementById('peopleSearchResults')?.classList.add('hidden');
  buyGrid.classList.remove('hidden');
  document.getElementById('tabBuyBtn').parentElement.classList.remove('hidden');
  document.getElementById('tabRentBtn').parentElement.classList.remove('hidden');

  const myBlocked = (currentUser && currentUser.blocked) || [];
  const activeProducts = products.filter(p => p.status === 'active' &&
    !myBlocked.includes(p.seller) &&
    (p.title.toLowerCase().includes(searchQuery) || p.seller.toLowerCase().includes(searchQuery)) &&
    (activeTagFilter === 'all' || p.tag === activeTagFilter)
  );

  const now = Date.now();
  activeProducts.sort((a, b) => {
    const aFeat = a.featured && (!a.featuredUntil || a.featuredUntil > now);
    const bFeat = b.featured && (!b.featuredUntil || b.featuredUntil > now);
    if (aFeat && !bFeat) return -1;
    if (!aFeat && bFeat) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const renderCard = (p) => {
    const sellerObj = users.find(u => u.username === p.seller);
    const sellerAvatar = sellerObj?.avatarUrl
      ? `<img src="${sellerObj.avatarUrl}" class="w-full h-full object-cover">`
      : p.seller.slice(0, 2).toUpperCase();
    const isBanned = sellerObj?.isBanned;
    const images = p.images && p.images.length ? p.images : [p.imageUrl].filter(Boolean);
    const firstImg = images[0] || '';
    const { rating } = getUserRating(p.seller);
    const views = p.views || 0;
    const isFeatured = p.featured && (!p.featuredUntil || p.featuredUntil > now);
    const isMine = currentUser && currentUser.username === p.seller;

    return `
      <div class="glass-card flex flex-col justify-between overflow-hidden group ${isBanned ? 'opacity-60 border-red-500/40' : ''} ${isFeatured ? 'product-featured' : ''}">
        <div>
          <div class="p-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <div class="flex items-center gap-2 truncate cursor-pointer" onclick="viewUserProfile('${p.seller}')">
              <div class="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center font-black text-[10px] overflow-hidden">${sellerAvatar}</div>
              <span class="text-xs font-bold text-white block truncate">@${p.seller}</span>
              ${renderVerifiedBadge(p.seller)}
            </div>
            ${isBanned ? '<span class="banned-tag">BANNED</span>' : ''}
          </div>
          <div class="h-32 flex items-center justify-center overflow-hidden relative cursor-pointer" onclick="openProductDetail('${p.id}')">
            <img src="${firstImg}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="${escapeHtml(p.title)}">
            <span class="absolute top-2 right-2 bg-purple-950/80 text-purple-200 border border-white/20 text-[8px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md">${escapeHtml(p.tag)}</span>
            ${isFeatured ? `<span class="absolute top-2 left-2 badge-featured text-[8px] px-2 py-0.5 rounded-full">⭐ FEATURED</span>` : ''}
            ${images.length > 1 ? `<span class="absolute bottom-2 right-2 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">${images.length} 📷</span>` : ''}
            ${views > 0 ? `<span class="absolute bottom-2 left-2 view-counter ${views > 20 ? 'hot' : ''}">${views > 20 ? '🔥' : '👁'} ${views}</span>` : ''}
          </div>
          <div class="p-3">
            <h3 class="text-xs font-bold text-white truncate cursor-pointer" onclick="openProductDetail('${p.id}')">${escapeHtml(p.title)}</h3>
            <p class="text-xs font-black text-purple-300 mt-1">₦ ${(p.price || 0).toLocaleString()}</p>
            ${rating > 0 ? `<div class="mt-1 flex items-center gap-1">${renderStars(rating)}<span class="text-[9px] text-purple-300">${rating.toFixed(1)}</span></div>` : ''}
          </div>
        </div>
        <div class="p-3 pt-0 flex gap-1.5">
          ${isMine ? `
            <span class="flex-1 text-center text-[10px] font-bold py-1.5 rounded-xl bg-white/5 text-purple-200/70 border border-white/10">Your item</span>
          ` : `
            <button onclick="guardedAction(() => startSellerDirectChat('${p.seller}', '${escapeHtml(p.title).replace(/'/g, "")}'))" class="flex-1 glass-button bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1"><i class="fa-solid fa-comment-dots"></i> Chat</button>
            ${isBanned
              ? `<button disabled class="flex-1 bg-red-900/40 text-red-300 text-[10px] font-bold py-1.5 rounded-xl cursor-not-allowed">Banned</button>`
              : `<button onclick="guardedAction(() => requestBuyConfirmation('${p.id}'))" class="flex-1 glass-button bg-purple-600/80 hover:bg-purple-500 text-white text-[10px] font-bold py-1.5 rounded-xl transition">Buy</button>`}
          `}
        </div>
      </div>
    `;
  };

  if (buyGrid) buyGrid.innerHTML = activeProducts.filter(p => p.category === 'buy').map(renderCard).join('')
    || `<p class="col-span-2 text-center text-xs text-purple-300 py-6">No buy/sell items found.</p>`;
  if (rentGrid) rentGrid.innerHTML = activeProducts.filter(p => p.category === 'rent').map(renderCard).join('')
    || `<p class="col-span-2 text-center text-xs text-purple-300 py-6">No rentals found.</p>`;
}

function renderPeopleSearch(query) {
  const myBlocked = (currentUser && currentUser.blocked) || [];
  const people = users.filter(u =>
    !u.isBanned &&
    !myBlocked.includes(u.username) &&
    (u.username.toLowerCase().includes(query) || (u.name || '').toLowerCase().includes(query))
  );

  document.getElementById('buyProductGrid').classList.add('hidden');
  document.getElementById('rentProductGrid').classList.add('hidden');
  document.getElementById('tabBuyBtn').parentElement.classList.add('hidden');
  document.getElementById('tabRentBtn').parentElement.classList.add('hidden');

  const box = document.getElementById('peopleSearchResults');
  box.classList.remove('hidden');

  if (!query) {
    box.innerHTML = `<p class="text-center text-xs text-purple-300/60 py-6">Type a name or @username to search people</p>`;
    return;
  }
  if (!people.length) {
    box.innerHTML = `<p class="text-center text-xs text-purple-300/60 py-6">No people found.</p>`;
    return;
  }
  box.innerHTML = people.map(u => {
    const av = u.avatarUrl ? `<img src="${u.avatarUrl}" class="w-full h-full object-cover">` : u.username.slice(0, 2).toUpperCase();
    const { rating } = getUserRating(u.username);
    return `
      <div class="user-result-card" onclick="viewUserProfile('${u.username}')">
        <div class="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden border border-white/20">${av}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1">
            <span class="font-bold text-white text-xs truncate">@${u.username}</span>
            ${renderVerifiedBadge(u.username)}
          </div>
          <span class="text-[10px] text-purple-300 truncate block">${escapeHtml(u.name || '')}</span>
        </div>
        ${rating > 0 ? renderStars(rating) : ''}
      </div>
    `;
  }).join('');
}

/* ==========================================================
   MY LISTINGS — shows ALL statuses
   ========================================================== */
function renderMyListings() {
  const container = document.getElementById('myListingsContainer');
  if (!container || !currentUser) return;
  const myProds = products.filter(p => p.seller === currentUser.username);

  if (myProds.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 space-y-2">
        <div class="text-4xl opacity-40">📦</div>
        <p class="text-[11px] text-purple-300/60 italic">No listings yet</p>
        <button onclick="openModal('addProductModal')" class="text-[10px] bg-purple-600/70 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold">+ Post your first item</button>
      </div>
    `;
    return;
  }

  const now = Date.now();

  // Sort: pending_sale first (needs attention), then active, then sold
  const statusOrder = { 'pending_sale': 0, 'active': 1, 'sold': 2 };
  const sorted = [...myProds].sort((a, b) => {
    const aO = statusOrder[a.status] ?? 3;
    const bO = statusOrder[b.status] ?? 3;
    if (aO !== bO) return aO - bO;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  container.innerHTML = sorted.map(p => {
    const imgs = p.images && p.images.length ? p.images : [p.imageUrl].filter(Boolean);
    const img = imgs[0] || '';
    const isFeatured = p.featured && (!p.featuredUntil || p.featuredUntil > now);
    const views = p.views || 0;

    let statusPill = '';
    let statusColor = 'text-purple-200';
    if (p.status === 'active') { statusPill = 'ACTIVE'; statusColor = 'text-emerald-300'; }
    else if (p.status === 'pending_sale') { statusPill = 'IN ESCROW'; statusColor = 'text-amber-300'; }
    else if (p.status === 'sold') { statusPill = 'SOLD'; statusColor = 'text-blue-300'; }

    return `
      <div class="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between ${isFeatured ? 'product-featured' : ''}">
        <div class="flex items-center gap-2 truncate cursor-pointer" onclick="openProductDetail('${p.id}')">
          <img src="${img}" class="w-10 h-10 rounded-lg object-cover shrink-0">
          <div class="truncate">
            <span class="font-bold text-white block truncate text-xs">${escapeHtml(p.title)}</span>
            <span class="text-[10px] text-amber-300">₦${(p.price || 0).toLocaleString()} • <strong class="${statusColor} uppercase">${statusPill}</strong></span>
            <span class="text-[9px] text-purple-300/70 block">👁 ${views} views ${isFeatured ? '• ⭐ Featured' : ''}</span>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          ${p.status === 'active' && !isFeatured ? `<button onclick="boostProduct('${p.id}')" class="bg-amber-500/80 hover:bg-amber-500 text-black px-2 py-1 rounded-lg text-[9px] font-bold whitespace-nowrap">⭐ Boost</button>` : ''}
          ${p.status === 'sold' ? `<span class="bg-blue-500/30 text-blue-300 px-2 py-1 rounded-lg text-[9px] font-bold text-center">Sold ✓</span>` : ''}
          ${p.status === 'pending_sale' ? `<span class="bg-amber-500/30 text-amber-300 px-2 py-1 rounded-lg text-[9px] font-bold text-center whitespace-nowrap">In Escrow</span>` : ''}
          <button onclick="deleteMyProduct('${p.id}')" class="bg-red-600/80 hover:bg-red-500 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ==========================================================
   PRODUCT DETAIL
   ========================================================== */
let detailImgIndex = 0;
let detailImages = [];

function openProductDetail(productId) {
  const p = products.find(item => item.id === productId);
  if (!p) return;
  currentDetailSeller = p.seller;
  detailImages = p.images && p.images.length ? p.images : [p.imageUrl].filter(Boolean);
  detailImgIndex = 0;

  document.getElementById('detailProdImg').src = detailImages[0] || '';
  document.getElementById('detailProdTag').textContent = p.tag || 'Item';
  document.getElementById('detailProdTitle').textContent = p.title;
  document.getElementById('detailProdPrice').textContent = `₦ ${(p.price || 0).toLocaleString()}`;
  document.getElementById('detailProdDescription').textContent = p.description;

  const viewsEl = document.getElementById('detailProdViews');
  if (viewsEl) viewsEl.textContent = `👁 ${(p.views || 0)} views`;

  renderDetailCarousel();

  const sellerObj = users.find(u => u.username === p.seller);
  const sellerAvatarEl = document.getElementById('detailSellerAvatar');
  sellerAvatarEl.innerHTML = sellerObj?.avatarUrl
    ? `<img src="${sellerObj.avatarUrl}" class="w-full h-full object-cover">`
    : p.seller.slice(0, 2).toUpperCase();
  document.getElementById('detailSellerName').innerHTML = `@${p.seller} ${renderVerifiedBadge(p.seller)}`;

  const chatBtn = document.getElementById('detailChatBtn');
  const buyBtn = document.getElementById('detailBuyBtn');
  const isMine = currentUser && currentUser.username === p.seller;

  chatBtn.setAttribute('onclick',
    `closeModal('productDetailModal'); guardedAction(() => startSellerDirectChat('${p.seller}', '${escapeHtml(p.title).replace(/'/g, "")}'))`);

  if (isMine) {
    buyBtn.textContent = 'Your item';
    buyBtn.disabled = true;
    buyBtn.className = 'flex-1 bg-white/5 text-purple-200/70 text-xs font-bold py-2.5 rounded-xl cursor-not-allowed border border-white/10';
  } else if (sellerObj && sellerObj.isBanned) {
    buyBtn.textContent = 'Seller Banned';
    buyBtn.disabled = true;
    buyBtn.className = 'flex-1 bg-red-900/40 text-red-300 text-xs font-bold py-2.5 rounded-xl cursor-not-allowed border border-red-500/20';
  } else {
    buyBtn.textContent = 'Buy with Escrow';
    buyBtn.disabled = false;
    buyBtn.className = 'flex-1 glass-button bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-lg';
    buyBtn.setAttribute('onclick',
      `closeModal('productDetailModal'); guardedAction(() => requestBuyConfirmation('${p.id}'))`);
  }

  const viewKey = 'viewed_' + productId;
  if (!sessionStorage.getItem(viewKey)) {
    sessionStorage.setItem(viewKey, '1');
    window.fsIncrementProductView(productId);
  }

  openModal('productDetailModal');
}

function renderDetailCarousel() {
  const container = document.getElementById('detailCarouselContainer');
  if (!container) return;
  if (detailImages.length <= 1) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <div class="carousel-arrow left" onclick="changeDetailImage(-1)"><i class="fa-solid fa-chevron-left text-xs"></i></div>
    <div class="carousel-arrow right" onclick="changeDetailImage(1)"><i class="fa-solid fa-chevron-right text-xs"></i></div>
    <div class="carousel-dots">
      ${detailImages.map((_, i) => `<div class="carousel-dot ${i === detailImgIndex ? 'active' : ''}"></div>`).join('')}
    </div>
  `;
}

function changeDetailImage(dir) {
  detailImgIndex = (detailImgIndex + dir + detailImages.length) % detailImages.length;
  document.getElementById('detailProdImg').src = detailImages[detailImgIndex];
  renderDetailCarousel();
}

function openLightbox(imageList, startIndex = 0) {
  lightboxImages = imageList;
  lightboxIndex = startIndex;
  renderLightbox();
}

function renderLightbox() {
  let overlay = document.getElementById('lightboxOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'lightboxOverlay';
    overlay.className = 'lightbox-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeLightbox(); };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="lightbox-close" onclick="closeLightbox()"><i class="fa-solid fa-xmark"></i></div>
    ${lightboxImages.length > 1 ? `
      <div class="lightbox-nav left" onclick="lightboxNav(-1)"><i class="fa-solid fa-chevron-left"></i></div>
      <div class="lightbox-nav right" onclick="lightboxNav(1)"><i class="fa-solid fa-chevron-right"></i></div>
    ` : ''}
    <img src="${lightboxImages[lightboxIndex]}" class="lightbox-img" alt="Preview">
    ${lightboxImages.length > 1 ? `<div class="lightbox-counter">${lightboxIndex + 1} / ${lightboxImages.length}</div>` : ''}
  `;
}

function lightboxNav(dir) {
  lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
  renderLightbox();
}

function closeLightbox() {
  document.getElementById('lightboxOverlay')?.remove();
}

/* ==========================================================
   USER PROFILE
   ========================================================== */
function viewUserProfile(username) {
  const targetUser = users.find(u => u.username === username);
  if (!targetUser) return;

  const avatarBox = document.getElementById('modalProfileAvatar');
  avatarBox.innerHTML = targetUser.avatarUrl
    ? `<img src="${targetUser.avatarUrl}" class="w-full h-full object-cover">`
    : targetUser.username.slice(0, 2).toUpperCase();

  document.getElementById('modalProfileName').innerHTML =
    `${escapeHtml(targetUser.name)} ${renderVerifiedBadge(targetUser.username)}`;
  document.getElementById('modalProfileUsername').textContent = `@${targetUser.username}`;

  const isMe = currentUser && currentUser.username === username;
  const isAdmin = currentUser && currentUser.isAdmin;
  const isPrivate = targetUser.isPrivate && !isMe && !isAdmin && !(targetUser.followers || []).includes(currentUser?.username);

  document.getElementById('modalFollowersCount').textContent = isPrivate ? '🔒' : ((targetUser.followers || []).length);
  document.getElementById('modalFollowingCount').textContent = isPrivate ? '🔒' : ((targetUser.following || []).length);

  const ratingEl = document.getElementById('modalRatingDisplay');
  const { rating, count } = getUserRating(username);
  if (ratingEl) {
    ratingEl.innerHTML = count > 0
      ? `${renderStars(rating, 'text-xs')} <span class="text-[10px] text-amber-300">${rating.toFixed(1)} (${count})</span>`
      : `<span class="text-[10px] text-purple-300/60">No ratings yet</span>`;
  }

  const statusEl = document.getElementById('modalProfileStatus');
  if (targetUser.isBanned) {
    statusEl.textContent = 'Account Banned';
    statusEl.classList.remove('hidden');
  } else {
    statusEl.classList.add('hidden');
  }

  const followBtn = document.getElementById('modalFollowBtn');
  const chatBtn = document.getElementById('modalChatBtn');
  const reportBtn = document.getElementById('modalReportBtn');
  const blockBtn = document.getElementById('modalBlockBtn');

  if (isMe) {
    followBtn.classList.add('hidden');
    chatBtn.classList.add('hidden');
    reportBtn.classList.add('hidden');
    blockBtn.classList.add('hidden');
  } else {
    followBtn.classList.remove('hidden');
    chatBtn.classList.remove('hidden');
    reportBtn.classList.remove('hidden');
    blockBtn.classList.remove('hidden');
    const isFollowing = currentUser && (targetUser.followers || []).includes(currentUser.username);
    followBtn.textContent = isFollowing ? 'Unfollow' : 'Follow';
    followBtn.setAttribute('onclick', `toggleFollowUser('${targetUser.username}')`);
    chatBtn.setAttribute('onclick', `closeModal('userProfileModal'); startSellerDirectChat('${targetUser.username}', 'General Inquiry');`);
    reportBtn.setAttribute('onclick', `reportUser('${targetUser.username}')`);
    blockBtn.setAttribute('onclick', `blockUser('${targetUser.username}')`);
  }
  openModal('userProfileModal');
}

async function toggleFollowUser(username) {
  if (!currentUser) { openModal('customAlertModal'); return; }
  if (currentUser.username === username) return;
  const targetUser = users.find(u => u.username === username);
  if (!targetUser) return;

  const targetFollowers = [...(targetUser.followers || [])];
  const myFollowing = [...(currentUser.following || [])];

  const idx = targetFollowers.indexOf(currentUser.username);
  if (idx !== -1) {
    targetFollowers.splice(idx, 1);
    const mi = myFollowing.indexOf(username);
    if (mi !== -1) myFollowing.splice(mi, 1);
    showToast(`Unfollowed @${username}`);
  } else {
    targetFollowers.push(currentUser.username);
    myFollowing.push(username);
    showToast(`You are now following @${username}`);
    await window.fsCreateNotification({
      forUser: username,
      type: 'follow',
      text: `👤 @${currentUser.username} started following you`,
      fromUser: currentUser.username,
      link: { type: 'user', value: currentUser.username }
    });
  }
  try {
    await window.fsUpdateUser(targetUser.username, { followers: targetFollowers });
    await window.fsUpdateUser(currentUser.username, { following: myFollowing });
    targetUser.followers = targetFollowers;
    currentUser.following = myFollowing;
    updateUserUI();
    viewUserProfile(username);
  } catch (err) { showToast("Network error", true); }
}

function openConnectionsModal(type) {
  if (!currentUser) return;
  if (currentUser.isPrivate) { showToast("Your account is Private. Connections are hidden.", true); return; }
  const modalTitle = document.getElementById('connectionsModalTitle');
  const container = document.getElementById('connectionsListContainer');
  modalTitle.textContent = type === 'followers' ? 'My Followers' : 'Accounts I Follow';
  const list = type === 'followers' ? (currentUser.followers || []) : (currentUser.following || []);

  if (!list || list.length === 0) {
    container.innerHTML = `<p class="text-center text-purple-300/60 py-6">No accounts found.</p>`;
    openModal('connectionsModal'); return;
  }
  container.innerHTML = list.map(uname => {
    const uObj = users.find(u => u.username === uname);
    if (!uObj) return '';
    const userAvatar = uObj.avatarUrl
      ? `<img src="${uObj.avatarUrl}" class="w-full h-full object-cover">`
      : uObj.username.slice(0, 2).toUpperCase();
    return `
      <div class="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between cursor-pointer" onclick="closeModal('connectionsModal'); viewUserProfile('${uObj.username}')">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[10px] overflow-hidden border border-white/20">${userAvatar}</div>
          <div>
            <div class="flex items-center gap-1">
              <span class="font-bold text-white block">@${uObj.username}</span>
              ${renderVerifiedBadge(uObj.username)}
            </div>
            <span class="text-[9px] text-purple-300">${escapeHtml(uObj.name)}</span>
          </div>
        </div>
        <span class="text-[10px] bg-purple-600/30 text-purple-200 px-2.5 py-1 rounded-lg border border-purple-400/30">View</span>
      </div>`;
  }).join('');
  openModal('connectionsModal');
}

/* ==========================================================
   REPORT / BLOCK
   ========================================================== */
async function reportUser(username) {
  if (!currentUser) { openModal('customAlertModal'); return; }
  const reason = prompt(`Why are you reporting @${username}?`);
  if (!reason || !reason.trim()) return;
  try {
    await window.fsCreateReport({
      reporter: currentUser.username,
      reportedUser: username,
      reason: reason.trim()
    });
    await window.fsCreateNotification({
      forUser: 'chris.bone',
      type: 'report',
      text: `🚩 @${currentUser.username} reported @${username}`,
      fromUser: currentUser.username
    });
    showToast("Report sent to admin 🚩");
  } catch (err) { showToast("Report failed", true); }
}

async function blockUser(username) {
  if (!currentUser) { openModal('customAlertModal'); return; }
  if (!confirm(`Block @${username}? You won't see their products or messages.`)) return;
  const blocked = [...(currentUser.blocked || [])];
  if (!blocked.includes(username)) blocked.push(username);
  try {
    await window.fsUpdateUser(currentUser.username, { blocked });
    currentUser.blocked = blocked;
    showToast(`Blocked @${username}`);
    closeModal('userProfileModal');
    renderProducts();
  } catch (err) { showToast("Block failed", true); }
}

/* ==========================================================
   BOOST
   ========================================================== */
async function boostProduct(productId) {
  if (!currentUser) { openModal('customAlertModal'); return; }
  const BOOST_PRICE = 500;
  if (currentUser.balance < BOOST_PRICE) {
    showToast(`You need ₦${BOOST_PRICE} to boost. Top up your wallet.`, true);
    return;
  }
  if (!confirm(`Boost this listing for ₦${BOOST_PRICE}? It will appear at the top for 24 hours.`)) return;

  try {
    const newBalance = currentUser.balance - BOOST_PRICE;
    const adminObj = users.find(u => u.username === 'chris.bone');
    await window.fsUpdateUser(currentUser.username, { balance: newBalance });
    if (adminObj) {
      await window.fsUpdateUser('chris.bone', { balance: (adminObj.balance || 0) + BOOST_PRICE });
    }
    await window.fsUpdateProduct(productId, {
      featured: true,
      featuredUntil: Date.now() + 24 * 60 * 60 * 1000
    });
    await window.fsCreateNotification({
      forUser: currentUser.username,
      type: 'boost',
      text: `⭐ Your listing was boosted for 24 hours! (-₦${BOOST_PRICE})`,
      fromUser: 'system'
    });
    showToast("⭐ Product boosted for 24 hours!");
    renderMyListings();
  } catch (err) { showToast("Boost failed", true); }
}

/* ==========================================================
   AUTH
   ========================================================== */
async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const username = document.getElementById('signupUsername').value.trim().toLowerCase();
  const password = document.getElementById('signupPassword').value;

  if (!name || !username || !password) return;
  if (users.find(u => u.username === username)) {
    showToast("Username already taken!", true);
    return;
  }

  const newUser = {
    username, password, name,
    isAdmin: false, isBanned: false, isPrivate: false,
    isVerified: false, verifiedTier: null,
    balance: 0,
    avatarUrl: tempSignupAvatarBase64 || '',
    followers: [], following: ['chris.bone'],
    blocked: [],
    dismissedAnnouncements: [],
    rating: 0, ratingCount: 0,
    createdAt: Date.now()
  };

  try {
    await window.fsCreateUser(newUser);
    const admin = users.find(u => u.username === 'chris.bone');
    if (admin && !(admin.followers || []).includes(username)) {
      const newAdminFollowers = [...(admin.followers || []), username];
      await window.fsUpdateUser('chris.bone', { followers: newAdminFollowers });
    }
    await window.fsCreateNotification({
      forUser: 'chris.bone',
      type: 'signup',
      text: `🎉 New user @${username} just joined!`,
      fromUser: username
    });
    currentUser = newUser;
    localStorage.setItem('iu_currentUser', JSON.stringify({ username }));
    tempSignupAvatarBase64 = '';
    updateUserUI();
    closeModal('signupModal');
    showToast("Account created successfully! 🎉");
  } catch (err) { showToast("Signup failed: " + err.message, true); }
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const foundUser = users.find(u => u.username === username && u.password === password);
  if (!foundUser) { showToast("Invalid credentials!", true); return; }
  if (foundUser.isBanned) { closeModal('loginModal'); openModal('bannedModal'); return; }
  currentUser = foundUser;
  localStorage.setItem('iu_currentUser', JSON.stringify({ username: foundUser.username }));
  updateUserUI();
  closeModal('loginModal');
  showToast(`Welcome back, @${username}!`);
}

function handleLogout() {
  if (confirm("Are you sure you want to log out?")) {
    currentUser = null;
    localStorage.removeItem('iu_currentUser');
    location.reload();
  }
}

/* ==========================================================
   USER UI
   ========================================================== */
function updateUserUI() {
  if (!currentUser) return;
  const fresh = users.find(u => u.username === currentUser.username);
  if (fresh) currentUser = fresh;

  document.getElementById('profileFullName').innerHTML =
    `${escapeHtml(currentUser.name)} ${renderVerifiedBadge(currentUser.username)}`;
  document.getElementById('profileHandle').textContent = `@${currentUser.username}`;
  document.getElementById('userWalletBalance').textContent = `₦ ${(currentUser.balance || 0).toLocaleString()}`;

  const privacyBadge = document.getElementById('profilePrivacyBadge');
  if (privacyBadge) privacyBadge.textContent = currentUser.isPrivate ? '🔒 Private' : '🌐 Public';
  const privCheckbox = document.getElementById('privateAccountToggle');
  if (privCheckbox) privCheckbox.checked = !!currentUser.isPrivate;
  document.getElementById('privacySettingContainer')?.classList.remove('hidden');

  const avatarTxt = document.getElementById('userAvatarText');
  const avatarImg = document.getElementById('userAvatarImg');
  if (currentUser.avatarUrl) {
    avatarImg.src = currentUser.avatarUrl;
    avatarImg.classList.remove('hidden');
    avatarTxt.classList.add('hidden');
  } else {
    avatarTxt.textContent = currentUser.username.slice(0, 2).toUpperCase();
    avatarTxt.classList.remove('hidden');
    avatarImg.classList.add('hidden');
  }

  document.getElementById('followersCount').textContent = (currentUser.followers || []).length;
  document.getElementById('followingCount').textContent = (currentUser.following || []).length;
  document.getElementById('myItemsCount').textContent = products.filter(p => p.seller === currentUser.username).length;

  const authBtns = document.getElementById('authHeaderButtons');
  if (authBtns) {
    authBtns.innerHTML = `
      <button onclick="handleLogout()" class="text-[10px] text-red-300 bg-red-900/30 hover:bg-red-800/40 px-2 py-1.5 rounded-xl border border-red-500/30 font-bold transition">Logout</button>
      <span class="text-xs font-bold text-amber-200 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 cursor-pointer" onclick="showSection('profileSection')">@${currentUser.username}</span>
    `;
  }

  if (currentUser.isAdmin) {
    document.getElementById('adminNavBtn').classList.remove('hidden');
    const totalAdminRev = orders.filter(o => o.status === 'COMPLETED').reduce((sum, o) => sum + (o.price * 0.05), 0);
    const commEl = document.getElementById('adminCommissionBalance');
    if (commEl) commEl.textContent = `5% Rev: ₦${totalAdminRev.toLocaleString()}`;
  } else {
    document.getElementById('adminNavBtn').classList.add('hidden');
  }

  renderNotificationBell();
  renderNavBadges();
  renderAnnouncements();
}

/* ==========================================================
   PRIVACY / PROFILE PIC
   ========================================================== */
async function toggleAccountPrivacy(checkbox) {
  if (!currentUser) return;
  currentUser.isPrivate = checkbox.checked;
  try {
    await window.fsUpdateUser(currentUser.username, { isPrivate: currentUser.isPrivate });
    showToast(currentUser.isPrivate ? "Account is now Private" : "Account is now Public");
  } catch (err) { showToast("Save failed", true); }
}

async function handleProfileImageUpload(e) {
  const file = e.target.files[0];
  if (!file || !currentUser) return;
  try {
    const compressed = await compressImage(file, 300, 0.7);
    currentUser.avatarUrl = compressed;
    await window.fsUpdateUser(currentUser.username, { avatarUrl: compressed });
    updateUserUI();
    renderProducts();
    showToast("Profile picture updated!");
  } catch (err) { showToast("Upload failed", true); }
}

/* ==========================================================
   CREATE / DELETE PRODUCT
   ========================================================== */
async function handleCreateProduct(e) {
  e.preventDefault();
  if (!currentUser) return;
  if (currentUser.isBanned) { openModal('bannedModal'); return; }
  if (!tempProductImagesBase64.length) {
    showToast("Please upload at least 1 image!", true);
    return;
  }

  const newProd = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    seller: currentUser.username,
    title: document.getElementById('prodTitle').value.trim(),
    description: document.getElementById('prodDescription').value.trim() || 'No description provided.',
    price: parseFloat(document.getElementById('prodPrice').value),
    category: document.getElementById('prodCategory').value,
    tag: document.getElementById('prodTag').value,
    status: 'active',
    imageUrl: tempProductImagesBase64[0],
    images: [...tempProductImagesBase64],
    featured: false,
    views: 0,
    createdAt: Date.now()
  };

  try {
    await window.fsCreateProduct(newProd);
    tempProductImagesBase64 = [];
    renderImagePreviews();
    e.target.reset();
    closeModal('addProductModal');
    showToast("Product posted successfully! 🌍");
    await window.fsCreateNotification({
      forUser: 'chris.bone',
      type: 'new_product',
      text: `📦 @${currentUser.username} posted "${newProd.title}"`,
      fromUser: currentUser.username,
      link: { type: 'product', value: newProd.id }
    });
  } catch (err) { showToast("Post failed: " + err.message, true); }
}

async function deleteMyProduct(productId) {
  if (!confirm("Delete this listing?")) return;
  try {
    await window.fsDeleteProduct(productId);
    showToast("Listing deleted");
  } catch (err) { showToast("Delete failed", true); }
}

/* ==========================================================
   BUY CONFIRMATION
   ========================================================== */
function requestBuyConfirmation(productId) {
  if (!currentUser) { openModal('customAlertModal'); return; }
  if (currentUser.isBanned) { openModal('bannedModal'); return; }

  const item = products.find(p => p.id === productId);
  if (!item || item.status !== 'active') { showToast("Item not available", true); return; }
  if (users.find(u => u.username === item.seller)?.isBanned) { showToast("Seller is banned", true); return; }
  if (currentUser.username === item.seller) { showToast("You can't buy your own item!", true); return; }

  // Build confirmation modal dynamically
  let modal = document.getElementById('buyConfirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'buyConfirmModal';
    modal.className = 'fixed inset-0 modal-backdrop z-[60] hidden flex items-center justify-center p-4';
    document.body.appendChild(modal);
  }

  const img = (item.images && item.images[0]) || item.imageUrl || '';
  const balance = currentUser.balance || 0;
  const canAfford = balance >= item.price;

  modal.innerHTML = `
    <div class="glass-modal w-full max-w-sm p-6 space-y-4 relative">
      <button onclick="closeModal('buyConfirmModal')" class="absolute top-4 right-4 text-purple-300 hover:text-white text-xs">✕</button>
      <h3 class="font-extrabold text-base text-center text-white">Confirm Purchase</h3>

      <div class="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
        <img src="${img}" class="w-16 h-16 rounded-lg object-cover shrink-0">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-bold text-white truncate">${escapeHtml(item.title)}</p>
          <p class="text-sm font-black text-amber-300 mt-0.5">₦ ${(item.price || 0).toLocaleString()}</p>
          <p class="text-[10px] text-purple-300 mt-0.5">from @${item.seller}</p>
        </div>
      </div>

      <div class="space-y-1.5 text-[11px]">
        <div class="flex justify-between text-purple-200">
          <span>Your wallet balance:</span>
          <span class="font-bold text-white">₦ ${balance.toLocaleString()}</span>
        </div>
        <div class="flex justify-between text-purple-200">
          <span>Amount to hold in escrow:</span>
          <span class="font-bold text-amber-300">₦ ${(item.price || 0).toLocaleString()}</span>
        </div>
        <div class="flex justify-between text-purple-200 pt-1.5 border-t border-white/10">
          <span>Balance after purchase:</span>
          <span class="font-bold ${canAfford ? 'text-emerald-300' : 'text-red-400'}">₦ ${(balance - (item.price || 0)).toLocaleString()}</span>
        </div>
      </div>

      <div class="text-[10px] text-purple-300/80 bg-purple-900/20 p-2.5 rounded-xl border border-purple-400/20 leading-relaxed">
        🛡️ <strong>Escrow Protected:</strong> Your money will be held safely. It only releases to the seller after you tap "Confirm Received". You can dispute if there's an issue.
      </div>

      ${!canAfford ? `<div class="text-[10px] text-red-300 bg-red-900/30 p-2 rounded-xl border border-red-500/30 text-center font-bold">Insufficient balance. Please top up your wallet first.</div>` : ''}

      <div class="flex gap-2 pt-1">
        <button onclick="closeModal('buyConfirmModal')" class="flex-1 glass-button bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2.5 rounded-xl">Cancel</button>
        <button onclick="confirmAndBuy('${item.id}')" ${!canAfford ? 'disabled' : ''} class="flex-1 glass-button ${canAfford ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-600/50 cursor-not-allowed'} text-white text-xs font-bold py-2.5 rounded-xl">${canAfford ? '✅ Yes, Buy Now' : 'Locked'}</button>
      </div>
    </div>
  `;
  openModal('buyConfirmModal');
}

async function confirmAndBuy(productId) {
  // Prevent double-tap
  if (processingButtons.has(productId)) return;
  processingButtons.add(productId);

  closeModal('buyConfirmModal');

  const item = products.find(p => p.id === productId);
  if (!item) { processingButtons.delete(productId); return; }

  if (currentUser.balance < item.price) {
    showToast("Insufficient balance", true);
    processingButtons.delete(productId);
    return;
  }

  // ===== Create the escrow order =====
  const newBalance = currentUser.balance - item.price;
  const newOrder = {
    id: 'o_' + Date.now(),
    productId: item.id,
    buyer: currentUser.username,
    seller: item.seller,
    title: item.title,
    price: item.price,
    status: 'HELD_IN_ESCROW',
    date: new Date().toLocaleString(),
    createdAt: Date.now()
  };

  try {
    await window.fsUpdateUser(currentUser.username, { balance: newBalance });
    await window.fsCreateOrder(newOrder);
    await window.fsUpdateProduct(item.id, { status: 'pending_sale' });

    // ===== Notify the seller =====
    await window.fsCreateNotification({
      forUser: item.seller,
      type: 'order',
      text: `💰 @${currentUser.username} bought "${item.title}" — ₦${item.price.toLocaleString()} held in escrow`,
      fromUser: currentUser.username,
      link: { type: 'order', value: newOrder.id }
    });

    // Notify admin
    await window.fsCreateNotification({
      forUser: 'chris.bone',
      type: 'order',
      text: `🛒 New escrow order: "${item.title}" — ₦${item.price.toLocaleString()}`,
      fromUser: currentUser.username
    });

    // ===== CREATE DM CONVERSATION between buyer and seller =====
    const buyerUsername = currentUser.username;
    const sellerUsername = item.seller;

    const existingDm = directMessages.find(m =>
      (m.sender === buyerUsername && m.receiver === sellerUsername) ||
      (m.sender === sellerUsername && m.receiver === buyerUsername)
    );

    const productImg = (item.images && item.images[0]) || item.imageUrl || '';

    // Check if there's already a chat about this product in the last 24h
    const recentAboutThisProduct = directMessages.find(m => {
      const within24h = Math.abs(Date.now() - (m.timestampMs || 0)) < 24 * 60 * 60 * 1000;
      return within24h &&
        m.orderProductId === item.id &&
        ((m.sender === buyerUsername && m.receiver === sellerUsername) ||
         (m.sender === sellerUsername && m.receiver === buyerUsername));
    });

    if (!recentAboutThisProduct) {
      // Send system-order DM to seller
      const orderMsgId = 'dm_' + Date.now() + '_order';
      await window.fsCreateDM({
        id: orderMsgId,
        sender: buyerUsername,
        receiver: sellerUsername,
        text: `🛒 ORDER CONFIRMED — I just bought "${item.title}" for ₦${item.price.toLocaleString()} via escrow.\n\nWhen and where can we meet to complete the exchange?`,
        timestamp: formatTime(Date.now()),
        timestampMs: Date.now(),
        isRead: false,
        reactions: {},
        isOrderMessage: true,
        orderProductId: item.id,
        orderProductImg: productImg,
        orderPrice: item.price
      });

      // Buyer's DM notification
      await window.fsCreateNotification({
        forUser: sellerUsername,
        type: 'dm',
        text: `💬 New order message from @${buyerUsername} about "${item.title}"`,
        fromUser: buyerUsername,
        link: { type: 'user', value: buyerUsername }
      });
    }

    // Update UI
    currentUser.balance = newBalance;
    updateUserUI();
    renderProducts();
    renderMyListings();

    showToast(`₦${item.price.toLocaleString()} held in Escrow!`);

    // ===== Open the DM conversation between buyer and seller =====
    // Small delay to let Firestore sync
    setTimeout(() => {
      activeChatTarget = sellerUsername;
      currentChatMode = 'ai';
      currentChatSubMode = 'ai';

      showSection('chatSection');
      const aiView = document.getElementById('aiSubView');
      const inboxView = document.getElementById('inboxSubView');
      if (aiView) aiView.classList.remove('hidden');
      if (inboxView) inboxView.classList.add('hidden');

      // Render the DM thread
      renderChatFeed();

      showToast(`💬 Chat opened with @${sellerUsername} — say hi!`, false);
    }, 800);

  } catch (err) {
    console.error("[BUY] Error:", err);
    showToast("Purchase failed: " + err.message, true);
  } finally {
    processingButtons.delete(productId);
  }
}

/* ==========================================================
   ESCROW - CONFIRM RECEIPT, DISPUTE, CANCEL
   ========================================================== */
async function confirmBuyerReceipt(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order || order.status !== 'HELD_IN_ESCROW') return;

  if (!confirm(`Confirm you received "${order.title}"?\n\nThis will release ₦${(order.price * 0.95).toLocaleString()} to the seller. This cannot be undone.`)) return;

  const commission = order.price * 0.05;
  const sellerPayout = order.price - commission;
  const sellerObj = users.find(u => u.username === order.seller);
  const adminObj = users.find(u => u.username === 'chris.bone');

  try {
    if (sellerObj) await window.fsUpdateUser(sellerObj.username, { balance: (sellerObj.balance || 0) + sellerPayout });
    if (adminObj) await window.fsUpdateUser(adminObj.username, { balance: (adminObj.balance || 0) + commission });
    await window.fsUpdateOrder(order.id, { status: 'COMPLETED', completedAt: Date.now() });
    await window.fsUpdateProduct(order.productId, { status: 'sold' });

    await window.fsCreateNotification({
      forUser: order.seller,
      type: 'payout',
      text: `🎉 ₦${sellerPayout.toLocaleString()} released to your wallet for "${order.title}"`,
      fromUser: 'system'
    });
    await window.fsCreateNotification({
      forUser: 'chris.bone',
      type: 'commission',
      text: `💵 ₦${commission.toLocaleString()} commission earned from "${order.title}"`,
      fromUser: 'system'
    });

    currentRatingOrderId = orderId;
    currentRatingValue = 0;
    document.getElementById('ratingModalSeller').textContent = `@${order.seller}`;
    document.getElementById('ratingComment').value = '';
    updateRatingStarsUI();
    openModal('ratingModal');

    showToast(`₦${sellerPayout.toLocaleString()} released! 🎉`);
  } catch (err) { showToast("Confirm failed", true); }
}

async function openOrderDispute(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order || order.status !== 'HELD_IN_ESCROW') return;
  const reason = prompt("Describe the issue (e.g. Seller didn't show up):");
  if (!reason) return;

  try {
    await window.fsUpdateOrder(order.id, { status: 'DISPUTED', disputeReason: reason });
    await window.fsCreateTicket({
      id: 't_' + Date.now(),
      sender: currentUser.username,
      text: `⚠️ [DISPUTE - #${order.id}] Item: "${order.title}". Issue: ${reason}`,
      adminReply: '',
      thread: [{
        from: currentUser.username,
        text: `⚠️ [DISPUTE - #${order.id}] Item: "${order.title}". Issue: ${reason}`,
        timestamp: Date.now()
      }],
      timestamp: formatTime(Date.now())
    });
    await window.fsCreateNotification({
      forUser: 'chris.bone',
      type: 'dispute',
      text: `⚠️ Dispute opened on "${order.title}" by @${currentUser.username}`,
      fromUser: currentUser.username
    });
    await window.fsCreateNotification({
      forUser: order.seller,
      type: 'dispute',
      text: `⚠️ @${currentUser.username} opened a dispute on "${order.title}"`,
      fromUser: currentUser.username
    });
    showToast("Dispute initiated! Escrow FROZEN.", true);
  } catch (err) { showToast("Dispute failed", true); }
}

async function cancelEscrowOrder(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  if (order.buyer !== currentUser.username) {
    showToast("Only the buyer can cancel", true);
    return;
  }
  if (order.status !== 'HELD_IN_ESCROW') {
    showToast("Cannot cancel this order", true);
    return;
  }

  if (!confirm(`Cancel this order?\n\n₦${order.price.toLocaleString()} will be refunded to your wallet, and the listing will go back on the market.`)) return;

  try {
    // Refund buyer
    const buyerObj = users.find(u => u.username === order.buyer);
    if (buyerObj) {
      await window.fsUpdateUser(buyerObj.username, { balance: (buyerObj.balance || 0) + order.price });
    }
    // Mark order as cancelled
    await window.fsUpdateOrder(order.id, { status: 'CANCELLED', cancelledAt: Date.now() });

    // Put product back to active
    await window.fsUpdateProduct(order.productId, { status: 'active' });

    // Notify seller
    await window.fsCreateNotification({
      forUser: order.seller,
      type: 'order',
      text: `❌ @${currentUser.username} cancelled the order for "${order.title}". Item is back on the market.`,
      fromUser: currentUser.username
    });

    // Notify admin
    await window.fsCreateNotification({
      forUser: 'chris.bone',
      type: 'order',
      text: `❌ Order cancelled: "${order.title}" by @${currentUser.username}`,
      fromUser: currentUser.username
    });

    showToast(`Order cancelled. ₦${order.price.toLocaleString()} refunded. ✅`);
    renderBuyerOrders();
    renderProducts();
  } catch (err) {
    console.error("[CANCEL] Error:", err);
    showToast("Cancel failed: " + err.message, true);
  }
}

async function resolveDispute(orderId, resolutionAction) {
  const order = orders.find(o => o.id === orderId);
  if (!order || order.status !== 'DISPUTED') return;

  try {
    if (resolutionAction === 'refund') {
      const buyerObj = users.find(u => u.username === order.buyer);
      if (buyerObj) await window.fsUpdateUser(buyerObj.username, { balance: (buyerObj.balance || 0) + order.price });
      await window.fsUpdateOrder(order.id, { status: 'REFUNDED', resolvedAt: Date.now() });
      await window.fsUpdateProduct(order.productId, { status: 'active' });
      await window.fsCreateNotification({
        forUser: order.buyer,
        type: 'refund',
        text: `✅ Refund of ₦${order.price.toLocaleString()} processed for "${order.title}"`,
        fromUser: 'system'
      });
      showToast(`Refunded ₦${order.price.toLocaleString()} to @${order.buyer}`);
    } else if (resolutionAction === 'release') {
      const commission = order.price * 0.05;
      const sellerPayout = order.price - commission;
      const sellerObj = users.find(u => u.username === order.seller);
      const adminObj = users.find(u => u.username === 'chris.bone');
      if (sellerObj) await window.fsUpdateUser(sellerObj.username, { balance: (sellerObj.balance || 0) + sellerPayout });
      if (adminObj) await window.fsUpdateUser(adminObj.username, { balance: (adminObj.balance || 0) + commission });
      await window.fsUpdateOrder(order.id, { status: 'COMPLETED', resolvedAt: Date.now() });
      await window.fsUpdateProduct(order.productId, { status: 'sold' });
      await window.fsCreateNotification({
        forUser: order.seller,
        type: 'payout',
        text: `🎉 ₦${sellerPayout.toLocaleString()} released to your wallet for "${order.title}"`,
        fromUser: 'system'
      });
      showToast(`Released ₦${sellerPayout.toLocaleString()} to @${order.seller}`);
    }
  } catch (err) { showToast("Resolve failed", true); }
}

/* ==========================================================
   RENDER ORDERS with cancel button
   ========================================================== */
function renderBuyerOrders() {
  const list = document.getElementById('buyerOrdersList');
  const badge = document.getElementById('escrowOrdersBadge');
  if (!list || !currentUser) return;

  const myOrders = orders.filter(o => o.buyer === currentUser.username || o.seller === currentUser.username);
  if (badge) badge.textContent = `${myOrders.filter(o => o.status === 'HELD_IN_ESCROW' || o.status === 'DISPUTED').length} Active`;

  list.innerHTML = myOrders.length === 0
    ? `<p class="text-[11px] text-purple-300/60 italic">No escrow orders found.</p>`
    : myOrders.map(o => {
      const isBuyer = o.buyer === currentUser.username;
      let badgeClass = 'bg-amber-500/30 text-amber-300', label = 'HELD IN ESCROW';
      if (o.status === 'DISPUTED') { badgeClass = 'bg-red-500/30 text-red-300'; label = 'DISPUTED'; }
      else if (o.status === 'COMPLETED') { badgeClass = 'bg-emerald-500/30 text-emerald-300'; label = 'SOLD'; }
      else if (o.status === 'REFUNDED') { badgeClass = 'bg-blue-500/30 text-blue-300'; label = 'REFUNDED'; }
      else if (o.status === 'CANCELLED') { badgeClass = 'bg-gray-500/30 text-gray-300'; label = 'CANCELLED'; }

      const canCancel = isBuyer && o.status === 'HELD_IN_ESCROW';
      const canConfirm = isBuyer && o.status === 'HELD_IN_ESCROW';
      const canDispute = isBuyer && o.status === 'HELD_IN_ESCROW';
      const canChat = true;

      return `
        <div class="p-3 rounded-xl border ${o.status === 'DISPUTED' ? 'bg-red-950/20 border-red-500/40' : o.status === 'HELD_IN_ESCROW' ? 'bg-amber-950/20 border-amber-400/40' : o.status === 'COMPLETED' ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-purple-950/20 border-purple-500/30'} space-y-2">
          <div class="flex justify-between items-center">
            <span class="font-extrabold text-white text-xs">${escapeHtml(o.title)}</span>
            <span class="text-[8px] font-black px-2 py-0.5 rounded-full border ${badgeClass}">${label}</span>
          </div>
          <div class="flex justify-between items-center text-[10px] text-purple-200">
            <span>Role: <strong class="text-white">${isBuyer ? 'Buyer' : 'Seller'}</strong> (${isBuyer ? `@${o.seller}` : `@${o.buyer}`})</span>
            <span class="font-bold text-amber-300">₦ ${(o.price || 0).toLocaleString()}</span>
          </div>
          <div class="flex flex-wrap gap-1.5 pt-1">
            ${canChat ? `<button onclick="chatAboutOrder('${isBuyer ? o.seller : o.buyer}')" class="flex-1 min-w-[80px] bg-blue-600/70 hover:bg-blue-600 text-white font-bold py-1.5 rounded-lg text-[10px] transition">💬 Chat</button>` : ''}
            ${canConfirm ? `<button onclick="confirmBuyerReceipt('${o.id}')" class="flex-1 min-w-[80px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded-lg text-[10px] transition shadow-md">✅ Received</button>` : ''}
            ${canCancel ? `<button onclick="cancelEscrowOrder('${o.id}')" class="flex-1 min-w-[80px] bg-gray-600 hover:bg-gray-500 text-white font-bold py-1.5 rounded-lg text-[10px] transition">❌ Cancel</button>` : ''}
            ${canDispute ? `<button onclick="openOrderDispute('${o.id}')" class="flex-1 min-w-[80px] bg-red-600/80 hover:bg-red-500 text-white font-bold py-1.5 rounded-lg text-[10px] transition">⚠️ Dispute</button>` : ''}
          </div>
        </div>`;
    }).join('');
}

function chatAboutOrder(otherUsername) {
  activeChatTarget = otherUsername;
  currentChatMode = 'ai';
  currentChatSubMode = 'ai';
  showSection('chatSection');
  const aiView = document.getElementById('aiSubView');
  const inboxView = document.getElementById('inboxSubView');
  if (aiView) aiView.classList.remove('hidden');
  if (inboxView) inboxView.classList.add('hidden');
  renderChatFeed();
}

/* ==========================================================
   REVIEWS
   ========================================================== */
function updateRatingStarsUI() {
  const stars = document.querySelectorAll('#ratingStarsRow .rating-star-large');
  stars.forEach((s, i) => s.classList.toggle('active', i < currentRatingValue));
}

function setRatingValue(v) {
  currentRatingValue = v;
  updateRatingStarsUI();
}

async function submitRating() {
  if (!currentUser || !currentRatingOrderId) return;
  if (currentRatingValue < 1) { showToast("Please tap a star", true); return; }
  const order = orders.find(o => o.id === currentRatingOrderId);
  if (!order) return;
  const comment = document.getElementById('ratingComment').value.trim();

  try {
    await window.fsCreateReview({
      orderId: order.id,
      productId: order.productId,
      buyer: currentUser.username,
      seller: order.seller,
      rating: currentRatingValue,
      comment: comment,
      productTitle: order.title
    });

    const sellerObj = users.find(u => u.username === order.seller);
    if (sellerObj) {
      const oldTotal = (sellerObj.rating || 0) * (sellerObj.ratingCount || 0);
      const newCount = (sellerObj.ratingCount || 0) + 1;
      const newAvg = (oldTotal + currentRatingValue) / newCount;
      await window.fsUpdateUser(order.seller, { rating: newAvg, ratingCount: newCount });
    }
    await window.fsCreateNotification({
      forUser: order.seller,
      type: 'review',
      text: `⭐ @${currentUser.username} rated you ${currentRatingValue}/5 for "${order.title}"`,
      fromUser: currentUser.username
    });
    closeModal('ratingModal');
    showToast("Thanks for your review! ⭐");
  } catch (err) { showToast("Rating failed", true); }
}

function renderMyReviews() {
  const box = document.getElementById('myReviewsList');
  if (!box || !currentUser) return;
  const myReviews = reviews.filter(r => r.seller === currentUser.username);
  if (!myReviews.length) {
    box.innerHTML = `<p class="text-[11px] text-purple-300/60 italic">No reviews yet.</p>`;
    return;
  }
  box.innerHTML = myReviews.slice(0, 5).map(r => `
    <div class="p-2.5 bg-white/5 rounded-xl border border-white/10 space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-amber-300">@${r.buyer}</span>
        ${renderStars(r.rating, 'text-[10px]')}
      </div>
      <p class="text-[11px] text-purple-100">${escapeHtml(r.comment || '(no comment)')}</p>
      <span class="text-[9px] text-purple-300/60">${timeAgo(r.timestamp)}</span>
    </div>
  `).join('');
}

/* ==========================================================
   WALLET — DEPOSIT (Bulletproof)
   ========================================================== */
async function handleWalletDeposit() {
  if (!currentUser || !currentUser.username) {
    showToast("Please log in first", true);
    return;
  }
  console.log("[DEPOSIT] Starting for:", currentUser.username, "| Balance:", currentUser.balance);

  const inputVal = prompt("Enter deposit amount (₦):", "100");
  if (!inputVal) return;
  const amountNaira = parseFloat(inputVal);

  if (isNaN(amountNaira) || amountNaira <= 0) {
    showToast("Invalid amount", true);
    return;
  }
  if (amountNaira < 100) {
    showToast("Minimum deposit is ₦100", true);
    return;
  }

  if (typeof window.fsUpdateUser !== 'function') {
    showToast("Firebase not loaded. Please refresh.", true);
    return;
  }

  const balanceBefore = currentUser.balance || 0;

  try {
    if (typeof PaystackPop === 'undefined') {
      showToast("Paystack not loaded. Refresh page.", true);
      return;
    }

    showToast("Opening payment window...");

    const paystack = new PaystackPop();
    paystack.newTransaction({
      key: 'pk_live_8c5d6a001769eb3e76de51f7259e2b839568aff6',
      email: `${currentUser.username}@iuportal.edu.ng`,
      amount: Math.round(amountNaira * 100),
      currency: 'NGN',
      metadata: {
        custom_fields: [
          { display_name: "Username", variable_name: "username", value: currentUser.username },
          { display_name: "Type", variable_name: "type", value: "wallet_deposit" }
        ]
      },

      onSuccess: async function(txn) {
        console.log("[DEPOSIT] ✅ Success. Ref:", txn.reference);
        try {
          if (!currentUser || !currentUser.username) {
            alert("Payment received but you were logged out!\n\nRef: " + txn.reference + "\n\nPlease log back in and contact support.");
            return;
          }

          let freshUser = null;
          try {
            if (typeof window.fsGetUser === 'function') {
              freshUser = await window.fsGetUser(currentUser.username);
            }
          } catch (e) { console.warn("[DEPOSIT] Fetch error:", e); }

          const baseBalance = freshUser ? (freshUser.balance || 0) : balanceBefore;
          const newBalance = baseBalance + amountNaira;

          await window.fsUpdateUser(currentUser.username, {
            balance: newBalance,
            lastDepositAt: Date.now(),
            lastDepositAmount: amountNaira,
            lastDepositRef: txn.reference
          });

          // Verify
          try {
            if (typeof window.fsGetUser === 'function') {
              const verifyUser = await window.fsGetUser(currentUser.username);
              if (verifyUser && verifyUser.balance !== newBalance) {
                alert("⚠️ Balance verification failed!\n\nExpected: ₦" + newBalance.toLocaleString() + "\nActual: ₦" + (verifyUser.balance || 0).toLocaleString() + "\n\nRef: " + txn.reference);
                return;
              }
            }
          } catch (e) { console.warn("[DEPOSIT] Verify error:", e); }

          currentUser.balance = newBalance;

          try {
            await window.fsCreateNotification({
              forUser: currentUser.username,
              type: 'deposit',
              text: `💰 Deposit of ₦${amountNaira.toLocaleString()} successful! Ref: ${txn.reference.slice(-8)}`,
              fromUser: 'system'
            });
          } catch (e) { console.warn("[DEPOSIT] Notif failed:", e); }

          updateUserUI();
          showToast(`✅ ₦${amountNaira.toLocaleString()} added to wallet!`);
          alert(`✅ Deposit Successful!\n\n₦${amountNaira.toLocaleString()} added.\n\nNew Balance: ₦${newBalance.toLocaleString()}\n\nRef: ${txn.reference}`);

        } catch (err) {
          console.error("[DEPOSIT] ❌ Error:", err);
          alert("⚠️ Payment succeeded but wallet update FAILED.\n\nError: " + err.message + "\n\nRef: " + txn.reference + "\n\nYour money is safe in Paystack. Contact support with this reference.");
          showToast("Wallet update failed", true);
        }
      },

      onCancel: function() { showToast("Payment cancelled"); },
      onError: function(err) { showToast("Payment error: " + (err.message || "unknown"), true); }
    });

  } catch (err) {
    console.error("[DEPOSIT] ❌ Outer error:", err);
    showToast("Failed to launch payment: " + err.message, true);
  }
}

/* ==========================================================
   WALLET — WITHDRAWAL
   ========================================================== */
async function handleWalletWithdraw() {
  if (!currentUser) return;

  // Show pending amount info if any
  const myPending = withdrawals.filter(w => w.username === currentUser.username && w.status === 'Pending');
  const pendingTotal = myPending.reduce((s, w) => s + (w.amount || 0), 0);
  const pendingMsg = myPending.length > 0
    ? `\n\n⚠️ You have ${myPending.length} pending withdrawal(s) totalling ₦${pendingTotal.toLocaleString()} — these are awaiting admin approval.`
    : '';

  const bankName = prompt("Enter your Bank Name (e.g. GTBank, OPay, Access, Kuda):" + pendingMsg);
  if (!bankName || !bankName.trim()) return;
  const accountNumber = prompt("Enter your 10-digit Account Number:");
  if (!accountNumber || accountNumber.trim().length < 10) {
    showToast("Invalid account number", true);
    return;
  }
  const accountName = prompt("Enter the Account Holder Name:");
  if (!accountName || !accountName.trim()) return;
  const amountInput = prompt(`Balance: ₦${(currentUser.balance || 0).toLocaleString()}. Amount to withdraw:`);
  const amount = parseFloat(amountInput);
  if (isNaN(amount) || amount <= 0) { showToast("Invalid amount", true); return; }
  if (amount > currentUser.balance) { showToast("Insufficient balance!", true); return; }

  const wdId = 'WD-' + Math.floor(100000 + Math.random() * 900000);
  try {
    await window.fsUpdateUser(currentUser.username, { balance: currentUser.balance - amount });
    await window.fsCreateWithdrawal({
      id: wdId,
      username: currentUser.username,
      amount: amount,
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(),
      accountName: accountName.trim(),
      status: 'Pending',
      timestamp: Date.now(),
      date: new Date().toLocaleString()
    });
    await window.fsCreateNotification({
      forUser: 'chris.bone',
      type: 'withdrawal',
      text: `💸 @${currentUser.username} requested withdrawal of ₦${amount.toLocaleString()}`,
      fromUser: currentUser.username
    });
    await window.fsCreateNotification({
      forUser: currentUser.username,
      type: 'withdrawal',
      text: `💸 Withdrawal request of ₦${amount.toLocaleString()} submitted. Pending admin approval.`,
      fromUser: 'system'
    });
    showToast(`Withdrawal ₦${amount.toLocaleString()} submitted!`);
  } catch (err) { showToast("Withdrawal failed", true); }
}

async function approveWithdrawal(id) {
  if (!currentUser || !currentUser.isAdmin) return;
  if (!confirm("Mark this withdrawal as PAID? (You should have sent the money already)")) return;
  try {
    await window.fsUpdateWithdrawal(id, { status: 'Paid', paidAt: Date.now() });
    const wd = withdrawals.find(w => w.id === id);
    if (wd) {
      await window.fsCreateNotification({
        forUser: wd.username,
        type: 'withdrawal_paid',
        text: `✅ Your withdrawal of ₦${wd.amount.toLocaleString()} has been paid!`,
        fromUser: 'system'
      });
    }
    showToast("Withdrawal marked as paid ✅");
  } catch (err) { showToast("Failed", true); }
}

async function rejectWithdrawal(id) {
  if (!currentUser || !currentUser.isAdmin) return;
  if (!confirm("Reject and REFUND this withdrawal back to the user?")) return;
  try {
    const wd = withdrawals.find(w => w.id === id);
    if (!wd) return;
    const u = users.find(x => x.username === wd.username);
    if (u) {
      await window.fsUpdateUser(u.username, { balance: (u.balance || 0) + wd.amount });
    }
    await window.fsUpdateWithdrawal(id, { status: 'Rejected', rejectedAt: Date.now() });
    await window.fsCreateNotification({
      forUser: wd.username,
      type: 'withdrawal_rejected',
      text: `❌ Your withdrawal of ₦${wd.amount.toLocaleString()} was rejected. Funds returned.`,
      fromUser: 'system'
    });
    showToast("Refunded to user's wallet");
  } catch (err) { showToast("Failed", true); }
}

/* ==========================================================
   VERIFICATION
   ========================================================== */
async function verifyUser(username, tier) {
  if (!currentUser || !currentUser.isAdmin) return;
  if (!confirm(`Give @${username} ${tier} verification?`)) return;
  try {
    await window.fsUpdateUser(username, { isVerified: true, verifiedTier: tier });
    await window.fsCreateNotification({
      forUser: username,
      type: 'verified',
      text: `🏆 Congratulations! You are now ${tier.toUpperCase()} Verified on IU Campus!`,
      fromUser: 'chris.bone'
    });
    showToast(`@${username} is now ${tier} verified! 🏆`);
  } catch (err) { showToast("Verification failed", true); }
}

async function unverifyUser(username) {
  if (!currentUser || !currentUser.isAdmin) return;
  if (!confirm(`Remove verification from @${username}?`)) return;
  try {
    await window.fsUpdateUser(username, { isVerified: false, verifiedTier: null });
    showToast(`Removed verification from @${username}`);
  } catch (err) { showToast("Failed", true); }
}

/* ==========================================================
   NOTIFICATIONS
   ========================================================== */
function renderNotificationBell() {
  if (!currentUser) return;
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  const myUnread = notifications.filter(n => n.forUser === currentUser.username && !n.isRead).length;
  if (myUnread > 0) {
    badge.textContent = myUnread > 9 ? '9+' : myUnread;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function goToNotifications() {
  if (!currentUser) { openModal('customAlertModal'); return; }
  showSection('notificationsSection');
}

function setNotifFilter(filter) {
  notifFilter = filter;
  ['all', 'orders', 'messages', 'system'].forEach(f => {
    const el = document.getElementById('notifFilter-' + f);
    if (el) {
      if (f === filter) el.classList.add('active');
      else el.classList.remove('active');
    }
  });
  renderNotificationsPage();
}

function renderNotificationsPage() {
  const container = document.getElementById('notificationsListContainer');
  const emptyEl = document.getElementById('notificationsEmpty');
  const unreadCountEl = document.getElementById('notifUnreadCount');
  if (!container || !currentUser) return;

  let myNotifs = notifications.filter(n => n.forUser === currentUser.username);

  const orderTypes = ['order', 'payout', 'commission', 'refund', 'dispute', 'boost', 'new_product'];
  const messageTypes = ['dm', 'ticket', 'ticket_reply'];
  const systemTypes = ['follow', 'signup', 'verified', 'report', 'withdrawal', 'withdrawal_paid', 'withdrawal_rejected', 'deposit'];

  if (notifFilter === 'orders') myNotifs = myNotifs.filter(n => orderTypes.includes(n.type));
  else if (notifFilter === 'messages') myNotifs = myNotifs.filter(n => messageTypes.includes(n.type));
  else if (notifFilter === 'system') myNotifs = myNotifs.filter(n => systemTypes.includes(n.type));

  myNotifs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const unreadCount = notifications.filter(n => n.forUser === currentUser.username && !n.isRead).length;
  if (unreadCountEl) unreadCountEl.textContent = `${unreadCount} unread`;

  if (!myNotifs.length) {
    container.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    return;
  }
  emptyEl?.classList.add('hidden');

  container.innerHTML = myNotifs.map(n => {
    const iconClass = getNotifIconClass(n.type);
    const icon = getNotifIcon(n.type);
    return `
      <div class="notif-page-item ${!n.isRead ? 'unread' : ''}" onclick="handleNotifClick('${n._id}', ${n.link ? `'${n.link.type}', '${n.link.value}'` : 'null, null'})">
        <div class="notif-page-icon ${iconClass}">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[11px] text-purple-100 leading-snug">${escapeHtml(n.text)}</p>
          <span class="text-[9px] text-purple-400 mt-1 block">${timeAgo(n.timestamp)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function getNotifIcon(type) {
  const map = {
    follow: 'fa-user-plus', order: 'fa-cart-shopping', payout: 'fa-money-bill-wave',
    commission: 'fa-percent', refund: 'fa-rotate-left', dispute: 'fa-triangle-exclamation',
    dm: 'fa-comment', ticket: 'fa-ticket', ticket_reply: 'fa-reply',
    verified: 'fa-circle-check', report: 'fa-flag', withdrawal: 'fa-money-bill-transfer',
    withdrawal_paid: 'fa-circle-check', withdrawal_rejected: 'fa-circle-xmark',
    deposit: 'fa-plus-circle', boost: 'fa-star', new_product: 'fa-box',
    signup: 'fa-user-plus', review: 'fa-star'
  };
  return map[type] || 'fa-bell';
}

function getNotifIconClass(type) {
  if (['order', 'payout', 'commission', 'refund', 'boost', 'new_product'].includes(type)) return 'order';
  if (['dm', 'ticket', 'ticket_reply'].includes(type)) return 'dm';
  if (['withdrawal', 'withdrawal_paid', 'withdrawal_rejected', 'deposit'].includes(type)) return 'withdrawal';
  if (['dispute', 'report'].includes(type)) return 'dispute';
  if (['follow', 'signup'].includes(type)) return 'follow';
  if (['verified'].includes(type)) return 'verified';
  if (['ticket'].includes(type)) return 'ticket';
  return '';
}

async function handleNotifClick(id, linkType, linkValue) {
  try { await window.fsMarkNotifRead(id); } catch (e) { }

  if (linkType === 'user' && linkValue) viewUserProfile(linkValue);
  else if (linkType === 'product' && linkValue) {
    const p = products.find(x => x.id === linkValue);
    if (p) openProductDetail(linkValue);
  }
  else if (linkType === 'order' && linkValue) showSection('profileSection');
  else if (linkType === 'ticket') {
    if (currentUser?.isAdmin) showSection('adminSection');
  }
  renderNotificationsPage();
}

async function markAllNotifsRead() {
  if (!currentUser) return;
  try {
    await window.fsMarkAllNotifsRead(currentUser.username);
    renderNotificationsPage();
    renderNotificationBell();
    showToast("All notifications marked as read ✅");
  } catch (err) { /* silent */ }
}

/* ==========================================================
   NAV BADGES
   ========================================================== */
function renderNavBadges() {
  const chatNavBadge = document.getElementById('chatNavBadge');
  if (!chatNavBadge || !currentUser) return;
  const unreadDms = directMessages.filter(m =>
    m.receiver === currentUser.username && !m.isRead
  ).length;
  if (unreadDms > 0) {
    chatNavBadge.textContent = unreadDms > 9 ? '9+' : unreadDms;
    chatNavBadge.classList.remove('hidden');
  } else {
    chatNavBadge.classList.add('hidden');
  }
}

/* ==========================================================
   CHAT
   ========================================================== */
function switchChatMode(mode) {
  currentChatMode = mode;
  const aiPanel = document.getElementById('aiChatPanel');
  const livePanel = document.getElementById('liveChatPanel');
  const aiBtn = document.getElementById('chatTabAiBtn');
  const liveBtn = document.getElementById('chatTabLiveBtn');
  if (mode === 'live') {
    aiPanel.classList.add('hidden');
    livePanel.classList.remove('hidden');
    aiBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg chat-tab-inactive transition';
    liveBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg chat-tab-active transition';
  } else {
    livePanel.classList.add('hidden');
    aiPanel.classList.remove('hidden');
    liveBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg chat-tab-inactive transition';
    aiBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg chat-tab-active transition';
    renderChatFeed();
  }
}

function switchAiSubMode(mode) {
  currentChatSubMode = mode;
  const aiView = document.getElementById('aiSubView');
  const inboxView = document.getElementById('inboxSubView');
  const aiBtn = document.getElementById('aiSubTabAi');
  const inboxBtn = document.getElementById('aiSubTabInbox');

  if (mode === 'inbox') {
    aiView.classList.add('hidden');
    inboxView.classList.remove('hidden');
    aiBtn.className = 'flex-1 py-1.5 text-[10px] font-bold rounded-lg text-purple-200/70 transition';
    inboxBtn.className = 'flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-purple-600/70 text-white transition';
    renderDMInbox();
  } else {
    inboxView.classList.add('hidden');
    aiView.classList.remove('hidden');
    inboxBtn.className = 'flex-1 py-1.5 text-[10px] font-bold rounded-lg text-purple-200/70 transition';
    aiBtn.className = 'flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-purple-600/70 text-white transition';
    activeChatTarget = null;
    renderChatFeed();
  }
}

function renderDMInbox() {
  const list = document.getElementById('dmInboxList');
  const empty = document.getElementById('dmInboxEmpty');
  if (!list || !currentUser) return;

  const convoMap = new Map();
  const myDms = directMessages.filter(m =>
    m.sender === currentUser.username || m.receiver === currentUser.username
  ).sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));

  myDms.forEach(m => {
    const other = m.sender === currentUser.username ? m.receiver : m.sender;
    if (!convoMap.has(other)) {
      convoMap.set(other, { withUser: other, lastMsg: m, unread: 0 });
    }
    if (m.receiver === currentUser.username && !m.isRead) {
      convoMap.get(other).unread += 1;
    }
  });

  const convos = Array.from(convoMap.values());

  if (!convos.length) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  list.innerHTML = convos.map(c => {
    const u = users.find(x => x.username === c.withUser) || {};
    const av = u.avatarUrl ? `<img src="${u.avatarUrl}" class="w-full h-full object-cover">` : c.withUser.slice(0, 2).toUpperCase();
    const preview = c.lastMsg.sender === currentUser.username
      ? `<span class="text-purple-300">You: </span>${escapeHtml(c.lastMsg.text.slice(0, 60))}`
      : escapeHtml(c.lastMsg.text.slice(0, 60));

    return `
      <div class="dm-inbox-item" onclick="openDMConversation('${c.withUser}')">
        <div class="dm-inbox-avatar">${av}</div>
        <div class="dm-inbox-body">
          <div class="dm-inbox-name">
            @${c.withUser}
            ${renderVerifiedBadge(c.withUser)}
          </div>
          <div class="dm-inbox-preview ${c.unread > 0 ? 'unread' : ''}">${preview}</div>
        </div>
        <div class="dm-inbox-meta">
          <span class="dm-inbox-time">${c.lastMsg.timestamp || ''}</span>
          ${c.unread > 0 ? `<span class="dm-unread-bubble">${c.unread > 9 ? '9+' : c.unread}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function openDMConversation(username) {
  if (!currentUser) return;
  activeChatTarget = username;

  const unreadMsgs = directMessages.filter(m =>
    m.sender === username && m.receiver === currentUser.username && !m.isRead
  );
  for (const m of unreadMsgs) {
    try { await window.fsMarkDMRead(m._id); } catch (e) { }
  }

  const aiView = document.getElementById('aiSubView');
  const inboxView = document.getElementById('inboxSubView');
  aiView.classList.remove('hidden');
  inboxView.classList.add('hidden');
  renderChatFeed();
}

function goBackToInbox() {
  activeChatTarget = null;
  switchAiSubMode('inbox');
}

async function startSellerDirectChat(sellerUsername, productTitle) {
  if (!currentUser) { openModal('customAlertModal'); return; }
  if (sellerUsername === currentUser.username) { showToast("You can't chat with yourself!", true); return; }
  activeChatTarget = sellerUsername;
  switchChatMode('ai');

  const existingDm = directMessages.find(m =>
    (m.sender === currentUser.username && m.receiver === sellerUsername) ||
    (m.sender === sellerUsername && m.receiver === currentUser.username)
  );
  if (!existingDm) {
    await window.fsCreateDM({
      id: 'dm_' + Date.now(),
      sender: currentUser.username,
      receiver: sellerUsername,
      text: `Hi @${sellerUsername}, regarding "${productTitle}". Is it still available?`,
      timestamp: formatTime(Date.now()),
      timestampMs: Date.now(),
      isRead: false,
      reactions: {}
    });
    await window.fsCreateNotification({
      forUser: sellerUsername,
      type: 'dm',
      text: `💬 @${currentUser.username} sent you a message about "${productTitle}"`,
      fromUser: currentUser.username,
      link: { type: 'user', value: currentUser.username }
    });
  }
  showSection('chatSection');
  document.getElementById('aiSubView').classList.remove('hidden');
  document.getElementById('inboxSubView').classList.add('hidden');
  renderChatFeed();
}

function resetChatToAI() {
  activeChatTarget = null;
  renderChatFeed();
}

async function handleSendChatMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chatInputField');
  const text = input.value.trim();
  if (!text) return;

  if (activeChatTarget) {
    await window.fsCreateDM({
      id: 'dm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      sender: currentUser.username,
      receiver: activeChatTarget,
      text,
      timestamp: formatTime(Date.now()),
      timestampMs: Date.now(),
      isRead: false,
      reactions: {}
    });
    await window.fsCreateNotification({
      forUser: activeChatTarget,
      type: 'dm',
      text: `💬 New message from @${currentUser.username}`,
      fromUser: currentUser.username,
      link: { type: 'user', value: currentUser.username }
    });
    input.value = '';
    return;
  }

  aiChatHistory.push({ sender: 'user', text });
  input.value = '';
  renderChatFeed();

  setTimeout(() => {
    const aiReply = generateAIResponse(text);
    aiChatHistory.push({ sender: 'ai', text: aiReply.text, options: aiReply.options });
    renderChatFeed();
  }, 500);
}

async function handleSendLiveMessage(e) {
  e.preventDefault();
  const input = document.getElementById('liveChatInputField');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  if (!currentUser) { openModal('customAlertModal'); return; }
  if (currentUser.isBanned) { openModal('bannedModal'); return; }
  try {
    await window.fsCreateLiveMsg({
      username: currentUser.username,
      avatarUrl: currentUser.avatarUrl || '',
      text
    });
    input.value = '';
  } catch (err) { showToast("Failed to send: " + err.message, true); }
}

/* ==========================================================
   AI ENGINE
   ========================================================== */
function generateAIResponse(text) {
  const t = text.toLowerCase();

  if (t.includes('escrow') || t.includes('how does buy') || t.includes('buying work')) {
    return { text: "🛡️ **Escrow System:**\n\n1. You tap 'Buy with Escrow'\n2. Confirm the purchase\n3. Money is frozen (held safely)\n4. Chat with seller to arrange meetup\n5. Receive your item\n6. Tap 'Confirm Received' in your Profile\n7. Money releases to seller (95%) + 5% platform fee\n\nIf something goes wrong → tap 'Dispute' → Admin freezes funds.", options: HELP_TOPICS };
  }
  if (t.includes('cancel') && (t.includes('order') || t.includes('buy'))) {
    return { text: "❌ **Cancelling an order:**\n\nYou can cancel from your Profile → My Escrow Purchases → 'Cancel' button (only before seller delivers).\n\nMoney is refunded instantly. The item goes back on the market.", options: HELP_TOPICS };
  }
  if (t.includes('payout') || t.includes('seller get paid') || t.includes('when do i get paid')) {
    return { text: "💰 **Seller Payouts:**\n\nOnce buyer taps 'Confirm Received':\n• 95% goes to your wallet\n• 5% platform commission\n\nExample: ₦100,000 sale → ₦95,000 to you.", options: HELP_TOPICS };
  }
  if (t.includes('refund') || t.includes('dispute') || t.includes('scam')) {
    return { text: "⚠️ **Dispute / Refund:**\n\nProfile → My Escrow Purchases → 'Dispute' → describe issue.\n\nAdmin is notified instantly. Funds freeze until resolved.", options: HELP_TOPICS };
  }
  if (t.includes('verify') || t.includes('verified') || t.includes('badge') || t.includes('gold') || t.includes('silver')) {
    return { text: "🏆 **Verification Badges:**\n\n• 🥇 **Gold** — Master Admin only\n• 🥈 **Silver** — Trusted, active sellers\n\nTo get Silver: be active, complete orders, keep good ratings, no disputes. Admin verifies manually!", options: HELP_TOPICS };
  }
  if (t.includes('boost') || t.includes('featured') || t.includes('promote')) {
    return { text: "⭐ **Boost Your Listing:**\n\n• Cost: ₦500\n• Duration: 24 hours\n• Effect: Top of market + golden badge\n\nProfile → My Active Listings → '⭐ Boost'", options: HELP_TOPICS };
  }
  if (t.includes('withdraw') || t.includes('cash out') || t.includes('bank')) {
    return { text: "💸 **Withdrawing to Bank:**\n\nProfile → Wallet → 'Withdraw' → enter bank details + amount.\n\nAdmin approves → money sent. Balance deducted immediately, refunded if rejected.", options: HELP_TOPICS };
  }
  if (t.includes('deposit') || t.includes('add money') || t.includes('fund wallet') || t.includes('add funds') || t.includes('paystack')) {
    return { text: "💳 **Adding Money (Paystack):**\n\nProfile → Wallet → 'Add Funds' → enter amount → pay via card/transfer/USSD.\n\nBalance updates instantly. Secure via Paystack.", options: HELP_TOPICS };
  }
  if (t.includes('chat') || t.includes('message seller') || t.includes('dm') || t.includes('inbox')) {
    return { text: "💬 **Chat / DMs:**\n\n• Tap 'Chat' on any product\n• After buying → chat opens automatically with seller\n• Messages appear in Chat → Direct Messages tab\n• '✓ Sent' / '✓✓ Seen' indicators\n\nLong-press messages to react 👍❤️😂🔥", options: HELP_TOPICS };
  }
  if (t.includes('report') || t.includes('block') || t.includes('scammer')) {
    return { text: "🚩 **Report / Block:**\n\n**Report:** Profile → 'Report' → describe issue\n**Block:** Profile → 'Block' → hides their stuff\n\nMultiple reports → user can be banned.", options: HELP_TOPICS };
  }
  if (t.includes('post') || t.includes('upload') || t.includes('sell') || t.includes('list item')) {
    return { text: "📦 **Posting a Product:**\n\nMarket → '+ Post' → fill details → upload 1-4 photos → Publish.\n\nInstantly visible to everyone!", options: HELP_TOPICS };
  }
  if (t.includes('ticket') || t.includes('support') || t.includes('help me') || t.includes('complain')) {
    return { text: "🎫 **Support Tickets:**\n\nDescribe your issue → send → goes to Master Admin.\n\nYou'll get a notification when admin replies.", showTicketForm: true, options: null };
  }
  if (t.includes('hello') || t.includes('hi ') || t.includes('hey') || t === 'hi') {
    return { text: "Hey there! 👋 What can I help you with today?", options: HELP_TOPICS };
  }
  if (t.includes('thanks') || t.includes('thank you') || t.includes('thx')) {
    return { text: "You're welcome! 😊 Happy trading! 🛍️", options: HELP_TOPICS };
  }
  if (t.includes('balance') || t.includes('wallet') || t.includes('my money')) {
    if (currentUser) {
      const pendingWd = withdrawals.filter(w => w.username === currentUser.username && w.status === 'Pending');
      const pendingTotal = pendingWd.reduce((s, w) => s + (w.amount || 0), 0);
      let msg = `💰 Your balance is **₦${(currentUser.balance || 0).toLocaleString()}**.`;
      if (pendingTotal > 0) msg += `\n\n⚠️ Pending withdrawals: ₦${pendingTotal.toLocaleString()}`;
      return { text: msg, options: HELP_TOPICS };
    }
    return { text: "Please log in to check your balance.", options: HELP_TOPICS };
  }
  return { text: "I'm not sure about that. 🤔\n\nI can help with:\n• Buying & escrow\n• Cancel order\n• Selling & payouts\n• Verification\n• Wallet\n• Boost, reports, tickets\n\nPick a topic below:", options: HELP_TOPICS };
}

function renderChatFeed() {
  const feed = document.getElementById('chatMessagesFeed');
  const title = document.getElementById('chatHeaderTitle');
  const subtitle = document.getElementById('chatHeaderSubtitle');
  const icon = document.getElementById('chatHeaderIcon');
  const backBtn = document.getElementById('chatConvoBackBtn');
  if (!feed) return;

  if (activeChatTarget && currentUser) {
    title.innerHTML = `@${activeChatTarget} ${renderVerifiedBadge(activeChatTarget)}`;
    subtitle.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Direct Message`;
    icon.innerHTML = activeChatTarget.slice(0, 2).toUpperCase();
    backBtn?.classList.remove('hidden');

    const relevantDms = directMessages
      .filter(m =>
        (m.sender === currentUser.username && m.receiver === activeChatTarget) ||
        (m.sender === activeChatTarget && m.receiver === currentUser.username)
      )
      .sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));

    feed.innerHTML = relevantDms.length === 0
      ? `<p class="text-center text-xs text-purple-300/60 py-10">Start messaging @${activeChatTarget} directly!</p>`
      : relevantDms.map(m => {
        const mine = m.sender === currentUser.username;
        let statusHtml = '';
        if (mine) {
          statusHtml = m.isRead
            ? `<span class="msg-seen"><i class="fa-solid fa-check-double"></i> Seen</span>`
            : `<span class="msg-delivered"><i class="fa-solid fa-check"></i> Sent</span>`;
        }
        const reactions = m.reactions || {};
        const reactionKeys = Object.keys(reactions).filter(k => (reactions[k] || []).length > 0);
        const reactionsHtml = reactionKeys.length > 0
          ? `<div class="msg-reactions-bar">` + reactionKeys.map(emoji => {
            const usersWhoReacted = reactions[emoji] || [];
            const mineReaction = usersWhoReacted.includes(currentUser.username);
            return `<div class="msg-reaction-pill ${mineReaction ? 'mine' : ''}" onclick="toggleReaction('${m._id}', '${emoji}')">
                ${emoji} <span>${usersWhoReacted.length}</span>
              </div>`;
          }).join('') + `</div>`
          : '';

        // Special rendering for order messages
        const isOrderMsg = m.isOrderMessage && m.orderProductImg;
        const orderBadge = isOrderMsg
          ? `<div class="flex items-center gap-2 mt-2 p-2 rounded-lg bg-black/20 border border-white/10">
              <img src="${m.orderProductImg}" class="w-10 h-10 rounded object-cover">
              <div class="flex-1 min-w-0">
                <p class="text-[9px] text-amber-300 font-bold">🛒 ORDER</p>
                <p class="text-[10px] text-white truncate">₦${(m.orderPrice || 0).toLocaleString()}</p>
              </div>
            </div>`
          : '';

        return `
          <div class="flex ${mine ? 'justify-end' : 'justify-start'} mb-3">
            <div class="max-w-[85%]">
              <div class="p-3 rounded-2xl text-xs ${mine ? 'bg-purple-600/80 text-white' : 'glass-card text-purple-100'} shadow-lg ${isOrderMsg ? 'border-2 border-amber-400/40' : ''}" oncontextmenu="openReactionPicker(event, '${m._id}'); return false;" ondblclick="openReactionPicker(event, '${m._id}')">
                <p class="leading-relaxed whitespace-pre-line">${escapeHtml(m.text)}</p>
                ${orderBadge}
                <div class="flex items-center justify-end gap-2 mt-1">
                  <span class="text-[8px] opacity-60">${m.timestamp || ''}</span>
                  ${statusHtml}
                </div>
              </div>
              ${reactionsHtml}
              ${reactionPickerMsgId === m._id ? renderReactionPicker(m._id) : ''}
            </div>
          </div>`;
      }).join('');
    feed.scrollTop = feed.scrollHeight;
    return;
  }

  backBtn?.classList.add('hidden');
  title.innerHTML = `IU Smart AI Assistant <i class="fa-solid fa-sparkles text-amber-300"></i>`;
  subtitle.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Your Campus Guide`;
  icon.innerHTML = `😊`;

  feed.innerHTML = aiChatHistory.map(msg => {
    let html = `<p class="whitespace-pre-line leading-relaxed">${escapeHtml(msg.text)}</p>`;
    if (msg.options && msg.options.length > 0) {
      html += `<div class="mt-3 space-y-1.5">` + msg.options.map(opt => `
        <button onclick="handleOptionClick('${opt.key}')" class="w-full text-left bg-purple-600/40 hover:bg-purple-600/80 text-white p-2 rounded-xl text-[10px] font-bold border border-purple-400/30 flex items-center justify-between transition">
          <span>${opt.label}</span><i class="fa-solid fa-chevron-right text-[9px]"></i>
        </button>`).join('') + `</div>`;
    }
    if (msg.showTicketForm) {
      html += `
        <div class="mt-3 p-3 bg-white/10 rounded-xl border border-purple-400/40 space-y-2">
          <textarea id="ticketInputMsg" rows="3" placeholder="e.g. Seller didn't meet up, damaged item..." class="w-full glass-input rounded-xl p-2 text-xs text-white placeholder-purple-200/50"></textarea>
          <button onclick="submitSupportTicket()" class="w-full bg-amber-500 hover:bg-amber-400 text-purple-950 font-black py-2 rounded-xl text-xs transition">Send Ticket</button>
        </div>`;
    }
    return `
      <div class="flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3">
        <div class="max-w-[90%] p-3.5 rounded-2xl text-xs ${msg.sender === 'user' ? 'bg-purple-600/80 text-white' : 'glass-card text-purple-100'} shadow-lg">
          ${html}
        </div>
      </div>`;
  }).join('');
  feed.scrollTop = feed.scrollHeight;
}

function handleOptionClick(key) {
  let responseText = '', isTicketForm = false;
  if (key === 'payments') responseText = "🛡️ **Escrow:** Funds locked on purchase → released only when buyer confirms. 5% platform fee.";
  else if (key === 'seller_payout') responseText = "💰 **Payouts:** Buyer confirms → you get 95%. 5% platform fee.";
  else if (key === 'dispute_info') responseText = "⚠️ **Dispute:** Profile → My Escrow Purchases → 'Dispute'.";
  else if (key === 'upload_prod') responseText = "📦 **Post:** '+ Post' → fill details → upload photos → Publish.";
  else if (key === 'verification') responseText = "🏆 **Verification:** Silver badge given to trusted sellers by admin.";
  else if (key === 'boost') responseText = "⭐ **Boost:** ₦500 → 24h at top. Profile → My Listings → '⭐ Boost'.";
  else if (key === 'withdraw') responseText = "💸 **Withdraw:** Profile → Wallet → 'Withdraw' → bank details.";
  else if (key === 'deposit') responseText = "💳 **Deposit:** Profile → Wallet → 'Add Funds' → Paystack.";
  else if (key === 'dm') responseText = "💬 **Chat:** 'Chat' on any product → messages in Chat → Direct Messages.";
  else if (key === 'block_report') responseText = "🚩 **Report/Block:** Open any profile → buttons at the bottom.";
  else if (key === 'ticket') { responseText = "🎫 **Open Ticket:** Describe the issue below."; isTicketForm = true; }

  const sel = HELP_TOPICS.find(t => t.key === key);
  aiChatHistory.push({ sender: 'user', text: sel ? sel.label : key });
  aiChatHistory.push({ sender: 'ai', text: responseText, showTicketForm: isTicketForm, options: isTicketForm ? null : HELP_TOPICS });
  renderChatFeed();
}

async function submitSupportTicket() {
  const textarea = document.getElementById('ticketInputMsg');
  if (!textarea || !textarea.value.trim()) { showToast("Write a message first!", true); return; }
  const text = textarea.value.trim();
  try {
    await window.fsCreateTicket({
      id: 't_' + Date.now(),
      sender: currentUser ? currentUser.username : 'Guest',
      text: text,
      adminReply: '',
      thread: [{ from: currentUser ? currentUser.username : 'Guest', text, timestamp: Date.now() }],
      timestamp: formatTime(Date.now())
    });
    await window.fsCreateNotification({
      forUser: 'chris.bone',
      type: 'ticket',
      text: `🎫 New support ticket from @${currentUser ? currentUser.username : 'Guest'}`,
      fromUser: currentUser ? currentUser.username : 'guest',
      link: { type: 'ticket', value: 'admin' }
    });
    aiChatHistory.push({ sender: 'ai', text: `✅ Ticket Submitted!`, options: HELP_TOPICS });
    renderChatFeed();
    showToast("Ticket submitted!");
  } catch (err) { showToast("Failed", true); }
}

/* ==========================================================
   REACTIONS
   ========================================================== */
function openReactionPicker(event, msgId) {
  event.preventDefault();
  reactionPickerMsgId = (reactionPickerMsgId === msgId) ? null : msgId;
  renderChatFeed();
}

function renderReactionPicker(msgId) {
  const emojis = ['👍', '❤️', '😂', '🔥', '😮', '😢'];
  return `
    <div class="reaction-picker">
      ${emojis.map(e => `<span class="reaction-option" onclick="toggleReaction('${msgId}', '${e}')">${e}</span>`).join('')}
    </div>
  `;
}

async function toggleReaction(msgId, emoji) {
  if (!currentUser) return;
  reactionPickerMsgId = null;
  try {
    await window.fsToggleDMReaction(msgId, emoji, currentUser.username);
  } catch (err) { /* silent */ }
}

/* ==========================================================
   ADMIN — Ticket Reply
   ========================================================== */
async function replyToTicket(ticketId) {
  if (!currentUser || !currentUser.isAdmin) return;
  const input = document.getElementById('ticketReply-' + ticketId);
  if (!input || !input.value.trim()) { showToast("Write a reply first", true); return; }
  const replyText = input.value.trim();
  const t = supportTickets.find(x => x.id === ticketId);
  if (!t) return;

  const newThread = [...(t.thread || [])];
  newThread.push({ from: 'chris.bone', text: replyText, timestamp: Date.now() });

  try {
    await window.fsUpdateTicket(ticketId, { adminReply: replyText, thread: newThread });
    await window.fsCreateNotification({
      forUser: t.sender,
      type: 'ticket_reply',
      text: `📩 Admin replied to your ticket: "${replyText.slice(0, 50)}${replyText.length > 50 ? '...' : ''}"`,
      fromUser: 'chris.bone',
      link: { type: 'ticket', value: ticketId }
    });
    input.value = '';
    showToast("Reply sent ✅");
  } catch (err) { showToast("Reply failed", true); }
}

/* ==========================================================
   ADMIN PANEL
   ========================================================== */
function renderAdminPanel() {
  if (!currentUser || !currentUser.isAdmin) return;

  const annList = document.getElementById('adminAnnouncementsList');
  if (annList) {
    annList.innerHTML = announcements.length === 0
      ? `<p class="text-[11px] text-purple-300/60 italic">No active announcements.</p>`
      : announcements.slice(0, 5).map(a => `
        <div class="p-2.5 bg-amber-950/20 rounded-xl border border-amber-400/30 flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <p class="text-[11px] text-purple-100">${escapeHtml(a.text)}</p>
            <span class="text-[9px] text-purple-400">${timeAgo(a.timestamp)}</span>
          </div>
          <button onclick="deleteAnnouncement('${a.id}')" class="bg-red-600/80 hover:bg-red-500 text-white px-2 py-1 rounded-lg text-[9px] font-bold">✕</button>
        </div>
      `).join('');
  }

  const disputesList = document.getElementById('adminDisputesList');
  const disputed = orders.filter(o => o.status === 'DISPUTED');
  document.getElementById('disputedOrdersBadge').textContent = `${disputed.length} Disputed`;
  disputesList.innerHTML = disputed.length === 0
    ? `<p class="text-[11px] text-purple-300/60 italic">No active disputes.</p>`
    : disputed.map(o => `
      <div class="p-3 bg-red-950/20 rounded-xl border border-red-500/40 space-y-2">
        <div class="flex justify-between items-center"><strong class="text-white">${escapeHtml(o.title)}</strong><span class="text-amber-300 font-bold">₦${(o.price || 0).toLocaleString()}</span></div>
        <p class="text-purple-200 text-[10px]">Buyer: @${o.buyer} | Seller: @${o.seller}</p>
        <p class="text-red-300 text-[10px] italic">Reason: "${escapeHtml(o.disputeReason || 'N/A')}"</p>
        <div class="flex gap-2 pt-1">
          <button onclick="resolveDispute('${o.id}', 'refund')" class="flex-1 bg-blue-600 text-white font-bold py-1.5 rounded-lg text-[10px]">Refund Buyer</button>
          <button onclick="resolveDispute('${o.id}', 'release')" class="flex-1 bg-emerald-600 text-white font-bold py-1.5 rounded-lg text-[10px]">Release to Seller</button>
        </div>
      </div>
    `).join('');

  const wdList = document.getElementById('adminWithdrawalsList');
  const pendingWd = withdrawals.filter(w => w.status === 'Pending');
  document.getElementById('withdrawalsBadge').textContent = `${pendingWd.length} Pending`;
  wdList.innerHTML = pendingWd.length === 0
    ? `<p class="text-[11px] text-purple-300/60 italic">No pending withdrawals.</p>`
    : pendingWd.map(w => `
      <div class="withdrawal-card pending space-y-2">
        <div class="flex justify-between">
          <span class="text-xs font-bold text-white">@${w.username}</span>
          <span class="text-amber-300 font-bold text-xs">₦${w.amount.toLocaleString()}</span>
        </div>
        <div class="text-[10px] text-purple-200 space-y-0.5">
          <p>🏦 <strong>${escapeHtml(w.bankName)}</strong></p>
          <p>🔢 ${escapeHtml(w.accountNumber)}</p>
          <p>👤 ${escapeHtml(w.accountName)}</p>
          <p class="text-purple-400">🕐 ${w.date}</p>
        </div>
        <div class="flex gap-2 pt-1">
          <button onclick="approveWithdrawal('${w.id}')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded-lg text-[10px]">✅ Mark Paid</button>
          <button onclick="rejectWithdrawal('${w.id}')" class="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-1.5 rounded-lg text-[10px]">❌ Reject</button>
        </div>
      </div>
    `).join('');

  const reportsList = document.getElementById('adminReportsList');
  const pendingReports = reports.filter(r => r.status === 'pending');
  document.getElementById('reportsBadge').textContent = `${pendingReports.length} Open`;
  reportsList.innerHTML = pendingReports.length === 0
    ? `<p class="text-[11px] text-purple-300/60 italic">No open reports.</p>`
    : pendingReports.map(r => `
      <div class="p-3 bg-red-950/20 rounded-xl border border-red-500/40 space-y-1">
        <div class="flex justify-between text-[10px]">
          <span class="text-white font-bold">Report by @${r.reporter}</span>
          <span class="text-purple-300">${timeAgo(r.timestamp)}</span>
        </div>
        <p class="text-purple-100 text-[11px]">Against: <strong>@${r.reportedUser}</strong></p>
        <p class="text-red-200 text-[11px] italic">"${escapeHtml(r.reason)}"</p>
        <div class="flex gap-2 pt-1">
          <button onclick="markReportResolved('${r.id}')" class="flex-1 bg-gray-600 text-white font-bold py-1 rounded-lg text-[10px]">Mark Reviewed</button>
        </div>
      </div>
    `).join('');

  const ticketsList = document.getElementById('adminTicketsList');
  document.getElementById('ticketCountBadge').textContent = `${supportTickets.length} Tickets`;
  ticketsList.innerHTML = supportTickets.length === 0
    ? `<p class="text-[11px] text-purple-300/60 italic">No tickets found.</p>`
    : supportTickets.slice(0, 20).map(t => {
      const thread = t.thread || [{ from: t.sender, text: t.text, timestamp: 0 }];
      return `
        <div class="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
          <div class="flex justify-between">
            <strong class="text-amber-300 text-xs">@${t.sender}</strong>
            <span class="text-[9px] text-purple-300">${t.timestamp}</span>
          </div>
          <div class="ticket-thread">
            ${thread.map(msg => `
              <div class="ticket-msg ${msg.from === 'chris.bone' ? 'admin' : 'user'}">
                <div class="ticket-msg-meta">
                  <span>@${msg.from}</span>
                  <span>${msg.timestamp ? timeAgo(msg.timestamp) : ''}</span>
                </div>
                ${escapeHtml(msg.text)}
              </div>
            `).join('')}
          </div>
          <div class="flex gap-2">
            <input type="text" id="ticketReply-${t.id}" placeholder="Reply..." class="flex-1 glass-input rounded-xl px-3 py-2 text-xs text-white">
            <button onclick="replyToTicket('${t.id}')" class="glass-button bg-purple-600 hover:bg-purple-500 text-white px-3 rounded-xl text-xs font-bold">
              <i class="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

  const usersList = document.getElementById('adminUsersList');
  document.getElementById('totalUsersBadge').textContent = `${users.length} Registered`;
  usersList.innerHTML = users.map(u => `
    <div class="p-2.5 bg-white/5 rounded-xl border border-white/10 space-y-2">
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-1">
            <span class="font-bold text-white block text-xs">@${u.username}</span>
            ${renderVerifiedBadge(u.username)}
          </div>
          <span class="text-[9px] text-purple-300">${escapeHtml(u.name)} • Bal: ₦${(u.balance || 0).toLocaleString()}</span>
        </div>
        <div class="flex gap-1 flex-wrap justify-end">
          ${u.username === 'chris.bone' ? '' : `
            <button onclick="toggleUserBan('${u.username}')" class="${u.isBanned ? 'bg-emerald-600' : 'bg-red-600'} text-white px-2 py-1 rounded-lg text-[9px] font-bold">${u.isBanned ? 'Unban' : 'Ban'}</button>
            ${u.isVerified
              ? `<button onclick="unverifyUser('${u.username}')" class="bg-gray-600 text-white px-2 py-1 rounded-lg text-[9px] font-bold">Unverify</button>`
              : `<button onclick="verifyUser('${u.username}', 'silver')" class="bg-amber-500 text-black px-2 py-1 rounded-lg text-[9px] font-bold">🏆 Verify</button>`
            }
          `}
        </div>
      </div>
    </div>
  `).join('');
}

async function markReportResolved(id) {
  try {
    await window.fsUpdateReport(id, { status: 'resolved' });
    showToast("Report marked resolved");
  } catch (err) { showToast("Failed", true); }
}

async function toggleUserBan(username) {
  const u = users.find(x => x.username === username);
  if (!u) return;
  try {
    await window.fsUpdateUser(username, { isBanned: !u.isBanned });
    showToast(`User @${username} status updated.`);
  } catch (err) { showToast("Update failed", true); }
}

/* ==========================================================
   LIVE CHAT HOOK
   ========================================================== */
window.onLiveChatUpdate = function (msgs) {
  const feedEl = document.getElementById('liveChatMessagesFeed');
  if (!feedEl) return;
  if (!msgs || msgs.length === 0) {
    feedEl.innerHTML = '<p class="text-center text-xs text-purple-300/60 py-10">No messages yet. Be the first!</p>';
    return;
  }
  const me = currentUser ? currentUser.username : null;
  feedEl.innerHTML = msgs.map(m => {
    const isMe = me && m.username === me;
    const initial = (m.username || '?').slice(0, 2).toUpperCase();
    const avatarHtml = m.avatarUrl ? `<img src="${m.avatarUrl}" class="w-full h-full object-cover">` : initial;
    return `
      <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 gap-2 items-end">
        ${!isMe ? `<div class="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-400 to-purple-600 flex items-center justify-center text-[10px] font-black text-white overflow-hidden border border-white/20 shrink-0">${avatarHtml}</div>` : ''}
        <div class="max-w-[80%] p-2.5 rounded-2xl text-xs ${isMe ? 'bg-emerald-600/70 text-white' : 'glass-card text-purple-100'} shadow-lg">
          ${!isMe ? `<span class="block text-[9px] font-bold text-amber-300 mb-0.5">@${escapeHtml(m.username)} ${renderVerifiedBadge(m.username)}</span>` : ''}
          <p class="leading-relaxed break-words">${escapeHtml(m.text)}</p>
          <span class="text-[8px] opacity-60 block text-right mt-1">${m.timeStr || ''}</span>
        </div>
      </div>
    `;
  }).join('');
  feedEl.scrollTop = feedEl.scrollHeight;
};

/* ==========================================================
   FIRESTORE HOOKS
   ========================================================== */
window.onFirebaseDataReady = function (data) {
  users = data.users || [];
  products = data.products || [];
  orders = data.orders || [];
  supportTickets = data.tickets || [];
  directMessages = data.dms || [];
  notifications = data.notifications || [];
  reviews = data.reviews || [];
  withdrawals = data.withdrawals || [];
  reports = data.reports || [];
  announcements = data.announcements || [];
  dbReady = true;

  const stored = JSON.parse(localStorage.getItem('iu_currentUser') || 'null');
  if (stored && stored.username) {
    const found = users.find(u => u.username === stored.username);
    if (found) { currentUser = found; updateUserUI(); }
  }

  const loadingEl = document.getElementById('loadingScreen');
  if (loadingEl) loadingEl.style.display = 'none';

  renderProducts();
  renderAnnouncements();
  renderNotificationBell();
  renderNavBadges();
};

window.onFirestoreSync = function (collection) {
  if (collection === 'users') {
    if (currentUser) {
      const fresh = users.find(u => u.username === currentUser.username);
      if (fresh) { currentUser = fresh; updateUserUI(); }
    }
    renderProducts();
    renderMyListings();
    if (currentUser && currentUser.isAdmin) renderAdminPanel();
  }
  if (collection === 'products') { renderProducts(); renderMyListings(); }
  if (collection === 'orders') {
    renderBuyerOrders();
    if (currentUser && currentUser.isAdmin) renderAdminPanel();
  }
  if (collection === 'tickets' && currentUser && currentUser.isAdmin) renderAdminPanel();
  if (collection === 'dms') {
    if (activeChatTarget) renderChatFeed();
    if (currentChatSubMode === 'inbox') renderDMInbox();
    renderNavBadges();
  }
  if (collection === 'notifications') {
    renderNotificationBell();
    if (!document.getElementById('notificationsSection').classList.contains('hidden')) {
      renderNotificationsPage();
    }
  }
  if (collection === 'reviews') renderMyReviews();
  if (collection === 'withdrawals' && currentUser && currentUser.isAdmin) renderAdminPanel();
  if (collection === 'reports' && currentUser && currentUser.isAdmin) renderAdminPanel();
  if (collection === 'announcements') renderAnnouncements();
};

/* ==========================================================
   PWA
   ========================================================== */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('pwaInstallBtn')?.classList.add('show');
});

async function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') showToast("App installed! 🎉");
  deferredPrompt = null;
  document.getElementById('pwaInstallBtn')?.classList.remove('show');
}

/* ==========================================================
   NOTIFICATION SOUND
   ========================================================== */
window.onNewNotificationForPush = function (notif) {
  if (!currentUser || notif.forUser !== currentUser.username) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* silent */ }
};

/* ==========================================================
   DOM READY
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  setAppTheme(currentAppTheme, false);
});

document.addEventListener('click', (e) => {
  const target = e.target.closest('#ratingStarsRow .rating-star-large');
  if (target) {
    const v = parseInt(target.dataset.value, 10);
    if (!isNaN(v)) setRatingValue(v);
  }
  if (!e.target.closest('.reaction-picker') && !e.target.closest('.msg-reactions-bar')) {
    if (reactionPickerMsgId) {
      reactionPickerMsgId = null;
      if (activeChatTarget) renderChatFeed();
    }
  }
});