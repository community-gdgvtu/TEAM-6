// RescueBite Multi-Page Application Logic

const app = {
  state: {
    token: localStorage.getItem('rescuebite_token') || null,
    user: JSON.parse(localStorage.getItem('rescuebite_user') || 'null'),
    selectedCategory: 'all',
    searchQuery: '',
    donations: [],
    myDonations: [],
    myReservations: [],
    partnerProfile: null,
    ngoProfile: null,
    adminStats: null,
  },

  // Initialization
  async init() {
    console.log('🌱 RescueBite App initializing...');
    this.setupDefaultDates();
    this.updateThemeButton();
    if (this.state.token) {
      await this.checkAuth();
    } else {
      this.updateUserUI();
    }

    const page = document.body.dataset.page;
    if (page === 'home' || page === 'marketplace' || !page) {
      await this.loadMarketplace();
    } else if (page === 'donor') {
      await this.loadDonorPortal();
    } else if (page === 'ngo') {
      await this.loadNgoPortal();
    } else if (page === 'admin') {
      await this.loadAdminConsole();
    }
  },

  setupDefaultDates() {
    const expiryInput = document.getElementById('d-expiry');
    if (expiryInput) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const hours = String(tomorrow.getHours()).padStart(2, '0');
      const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
      expiryInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
  },

  // API Request Helper
  async api(endpoint, options = {}) {
    const headers = options.headers || {};
    if (this.state.token) {
      headers['Authorization'] = `Bearer ${this.state.token}`;
    }

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    options.headers = headers;

    try {
      const res = await fetch(endpoint, options);
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error?.message || data.message || 'API request failed';
        throw new Error(errorMsg);
      }
      return data;
    } catch (err) {
      this.toast(err.message, 'error');
      throw err;
    }
  },

  // Toast Notifications
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'error') toast.style.borderLeft = '4px solid #ef4444';
    if (type === 'success') toast.style.borderLeft = '4px solid #10b981';

    toast.innerHTML = `<span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // Auth Operations
  async checkAuth() {
    try {
      const res = await this.api('/api/auth/me');
      this.state.user = res.data;
      localStorage.setItem('rescuebite_user', JSON.stringify(res.data));
      this.updateUserUI();

      if (this.state.user.role === 'donor') {
        this.loadPartnerProfile();
      } else if (this.state.user.role === 'ngo') {
        this.loadNgoProfile();
      }
    } catch (err) {
      console.warn('Auth token invalid or expired.');
      this.logout();
    }
  },

  updateUserUI() {
    const box = document.getElementById('user-nav-box');
    const navDonor = document.getElementById('nav-donor');
    const navNgo = document.getElementById('nav-ngo');
    const navAdmin = document.getElementById('nav-admin');
    const user = this.state.user;

    if (user) {
      const roleClass = `role-${user.role}`;
      if (box) {
        box.innerHTML = `
          <div class="user-badge">
            <span>${user.name}</span>
            <span class="role-pill ${roleClass}">${user.role}</span>
            <button class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="app.logout()">Logout</button>
          </div>
        `;
      }
      if (navDonor) navDonor.style.display = user.role === 'donor' ? 'inline-block' : 'none';
      if (navNgo) navNgo.style.display = user.role === 'ngo' ? 'inline-block' : 'none';
      if (navAdmin) navAdmin.style.display = user.role === 'admin' ? 'inline-block' : 'none';
    } else {
      if (box) {
        box.innerHTML = `
          <a href="/login.html" class="btn btn-secondary">Log In</a>
          <a href="/register.html" class="btn btn-primary">Sign Up</a>
        `;
      }
      if (navDonor) navDonor.style.display = 'none';
      if (navNgo) navNgo.style.display = 'none';
      if (navAdmin) navAdmin.style.display = 'none';
    }
  },

  fillDemoCredentials(role) {
    const creds = {
      donor: { email: 'donor@taki.demo', pass: 'DemoPass123!' },
      ngo: { email: 'ngo@taki.demo', pass: 'DemoPass123!' },
      admin: { email: 'admin@taki.demo', pass: 'DemoPass123!' },
    };
    const c = creds[role];
    if (c) {
      const emailInput = document.getElementById('login-email');
      const passInput = document.getElementById('login-password');
      if (emailInput) emailInput.value = c.email;
      if (passInput) passInput.value = c.pass;
      this.toast(`Prefilled ${role.toUpperCase()} credentials`, 'info');
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await this.api('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      this.state.token = res.data.token;
      this.state.user = res.data.user;
      localStorage.setItem('rescuebite_token', res.data.token);
      localStorage.setItem('rescuebite_user', JSON.stringify(res.data.user));

      this.toast(`Welcome back, ${res.data.user.name}!`, 'success');
      
      setTimeout(() => {
        if (res.data.user.role === 'admin') window.location.href = '/admin.html';
        else if (res.data.user.role === 'donor') window.location.href = '/donor.html';
        else if (res.data.user.role === 'ngo') window.location.href = '/ngo.html';
        else window.location.href = '/marketplace.html';
      }, 500);
    } catch (err) {
      // error handled
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;

    try {
      const res = await this.api('/api/auth/register', {
        method: 'POST',
        body: { name, email, password, role },
      });
      this.state.token = res.data.token;
      this.state.user = res.data.user;
      localStorage.setItem('rescuebite_token', res.data.token);
      localStorage.setItem('rescuebite_user', JSON.stringify(res.data.user));

      this.toast('Account registered successfully!', 'success');
      
      setTimeout(() => {
        if (role === 'donor') window.location.href = '/donor.html';
        else if (role === 'ngo') window.location.href = '/ngo.html';
        else window.location.href = '/marketplace.html';
      }, 500);
    } catch (err) {
      // error handled
    }
  },

  logout() {
    this.state.token = null;
    this.state.user = null;
    this.state.partnerProfile = null;
    this.state.ngoProfile = null;
    localStorage.removeItem('rescuebite_token');
    localStorage.removeItem('rescuebite_user');
    this.updateUserUI();
    this.toast('Logged out');
    const page = document.body.dataset.page;
    if (page === 'donor' || page === 'ngo' || page === 'admin') {
      window.location.href = '/';
    }
  },

  // Marketplace Methods
  async loadMarketplace() {
    const grid = document.getElementById('donation-grid');
    if (!grid) return;
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><div class="empty-icon">🍲</div><h3 class="empty-title">Loading surplus food listings...</h3></div>`;

    try {
      let queryParams = [];
      if (this.state.selectedCategory !== 'all') {
        queryParams.push(`category=${encodeURIComponent(this.state.selectedCategory)}`);
      }
      if (this.state.searchQuery) {
        queryParams.push(`q=${encodeURIComponent(this.state.searchQuery)}`);
      }
      const url = '/api/donations' + (queryParams.length ? '?' + queryParams.join('&') : '');

      const res = await this.api(url);
      const donationsList = Array.isArray(res.data) ? res.data : (res.data?.donations || []);
      this.state.donations = donationsList;

      const activeCount = document.getElementById('stat-active-count');
      if (activeCount) activeCount.textContent = this.state.donations.length;

      this.renderMarketplaceCards(this.state.donations);
    } catch (err) {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><h3 class="empty-title">Could not load donations</h3><p class="empty-desc">${err.message}</p></div>`;
    }
  },

  renderMarketplaceCards(items) {
    const grid = document.getElementById('donation-grid');
    if (!grid) return;
    if (!items || !Array.isArray(items) || items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">🌱</div>
          <h3 class="empty-title">No Surplus Food Listings Found</h3>
          <p class="empty-desc">Check back shortly or try selecting a different category or search term.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = items
      .map((item) => {
        const defaultImgs = {
          'prepared-meals': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
          bakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
          produce: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80',
          dairy: 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?auto=format&fit=crop&w=600&q=80',
          packaged: 'https://images.unsplash.com/photo-1584473457406-6df42d825c81?auto=format&fit=crop&w=600&q=80',
          beverages: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
          frozen: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80',
          other: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80',
        };

        const imgSrc = item.imageUrl || defaultImgs[item.category] || defaultImgs.other;
        const expiryFormatted = item.expiry ? new Date(item.expiry).toLocaleString() : 'N/A';
        const isNgo = this.state.user && this.state.user.role === 'ngo';

        return `
        <div class="food-card" onclick="app.openDetailModal('${item._id}')">
          <div class="card-img-wrap">
            <img src="${imgSrc}" alt="${item.title}" class="card-img" onerror="this.src='${defaultImgs.other}'">
            <div class="card-badge-top">
              <span class="badge badge-cat">${item.category}</span>
              <span class="badge badge-status status-${item.status}">${item.status}</span>
            </div>
          </div>
          <div class="card-body">
            <h3 class="card-title">${this.escape(item.title)}</h3>
            <p class="card-desc">${this.escape(item.description || 'Fresh surplus food available for pickup.')}</p>
            <div class="card-meta-list">
              <div class="meta-row">
                <span class="meta-icon">📦</span>
                <span>Quantity: <span class="meta-highlight">${item.quantity} ${this.escape(item.unit)}</span></span>
              </div>
              <div class="meta-row">
                <span class="meta-icon">📍</span>
                <span>Address: <span>${this.escape(item.pickupAddress)}</span></span>
              </div>
              <div class="meta-row">
                <span class="meta-icon">⏳</span>
                <span>Expires: <span>${expiryFormatted}</span></span>
              </div>
            </div>
            <div class="card-footer">
              ${
                isNgo && item.status === 'active'
                  ? `<button class="btn btn-primary btn-block" onclick="event.stopPropagation(); app.reserveDonation('${item._id}')">Reserve Food</button>`
                  : `<button class="btn btn-secondary btn-block">View Details</button>`
              }
            </div>
          </div>
        </div>
      `;
      })
      .join('');
  },

  filterCategory(cat) {
    this.state.selectedCategory = cat;
    document.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
    const btn = Array.from(document.querySelectorAll('.cat-pill')).find(
      (p) => p.textContent.toLowerCase().replace(/\s+/g, '-') === cat || (cat === 'all' && p.textContent.includes('All')),
    );
    if (btn) btn.classList.add('active');
    this.loadMarketplace();
  },

  onSearchInput() {
    const input = document.getElementById('search-input');
    if (!input) return;
    this.state.searchQuery = input.value;
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this.loadMarketplace();
    }, 300);
  },

  // Donor Portal Methods
  async loadPartnerProfile() {
    try {
      const res = await this.api('/api/partners/me');
      this.state.partnerProfile = res.data;
    } catch (err) {
      this.state.partnerProfile = null;
    }
  },

  async loadDonorPortal() {
    if (!this.state.user || this.state.user.role !== 'donor') {
      window.location.href = '/login.html';
      return;
    }

    await this.loadPartnerProfile();
    const banner = document.getElementById('donor-verification-banner');
    const profile = this.state.partnerProfile;

    if (banner) {
      if (!profile) {
        banner.innerHTML = `
          <div class="alert-banner alert-warning">
            <span>⚠️</span>
            <div>
              <strong>Business Partner Verification Required</strong>
              <p>You must register your donor business profile before posting surplus food listings.</p>
              <button class="btn btn-secondary" style="margin-top: 0.5rem; font-size: 0.8rem;" onclick="app.openModal('partner-modal')">Register Partner Profile</button>
            </div>
          </div>
        `;
      } else if (profile.status === 'Pending') {
        banner.innerHTML = `
          <div class="alert-banner alert-info">
            <span>⏳</span>
            <div>
              <strong>Partner Profile Under Review</strong>
              <p>Your business profile (<em>${this.escape(profile.businessName)}</em>) is currently pending admin approval. You can post donations as soon as approved.</p>
            </div>
          </div>
        `;
      } else if (profile.status === 'Verified') {
        banner.innerHTML = `
          <div class="alert-banner alert-success">
            <span>✅</span>
            <div>
              <strong>Verified Partner (${this.escape(profile.businessName)})</strong>
              <p>Your business profile is verified and active.</p>
            </div>
          </div>
        `;
      } else if (profile.status === 'Rejected') {
        banner.innerHTML = `
          <div class="alert-banner alert-danger">
            <span>❌</span>
            <div>
              <strong>Partner Profile Verification Rejected</strong>
              <p style="margin-top: 0.25rem;">Rejection Reason: <em>${this.escape(profile.rejectionReason || 'Incomplete registration details provided.')}</em></p>
              <button class="btn btn-secondary" style="margin-top: 0.5rem; font-size: 0.8rem;" onclick="app.openEditPartnerModal()">Edit & Re-submit Verification Profile</button>
            </div>
          </div>
        `;
      }
    }

    const tbody = document.getElementById('donor-donations-tbody');
    if (!tbody) return;

    try {
      const res = await this.api('/api/donations/mine');
      this.state.myDonations = res.data || [];

      if (this.state.myDonations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--slate-500); padding: 2rem;">No surplus food posted yet. Click <strong>+ List Surplus Food</strong> above to create your first listing.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.state.myDonations
        .map((d) => {
          const exp = d.expiry ? new Date(d.expiry).toLocaleString() : 'N/A';
          return `
          <tr>
            <td><strong>${this.escape(d.title)}</strong></td>
            <td><span class="badge badge-cat">${d.category}</span></td>
            <td>${d.quantity} ${this.escape(d.unit)}</td>
            <td><span class="badge badge-status status-${d.status}">${d.status}</span></td>
            <td><small>${exp}</small></td>
            <td>
              ${
                d.status === 'reserved'
                  ? `<button class="btn btn-primary" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="app.completeHandoff('${d._id}')">Complete Handoff</button>`
                  : d.status === 'active'
                  ? `<button class="btn btn-danger" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="app.cancelDonation('${d._id}')">Cancel Listing</button>`
                  : `<span style="color: var(--slate-400); font-size: 0.8rem;">Finished</span>`
              }
            </td>
          </tr>
        `;
        })
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger-600);">${err.message}</td></tr>`;
    }
  },

  openCreateDonationModal() {
    if (!this.state.partnerProfile || this.state.partnerProfile.status !== 'Verified') {
      this.toast('You must have a Verified Partner Profile to list donations. Please check your verification status.', 'error');
      return;
    }
    this.openModal('create-donation-modal');
  },

  async handleCreateDonation(e) {
    e.preventDefault();
    const title = document.getElementById('d-title').value;
    const description = document.getElementById('d-desc').value;
    const category = document.getElementById('d-category').value;
    const quantity = Number(document.getElementById('d-quantity').value);
    const unit = document.getElementById('d-unit').value;
    const expiry = document.getElementById('d-expiry').value;
    const estimatedValue = Number(document.getElementById('d-val').value);
    const pickupAddress = document.getElementById('d-address').value;
    const lng = Number(document.getElementById('d-lng').value);
    const lat = Number(document.getElementById('d-lat').value);
    const imageFileInput = document.getElementById('d-image-file');

    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    formData.append('category', category);
    formData.append('quantity', quantity);
    formData.append('unit', unit);
    formData.append('expiry', new Date(expiry).toISOString());
    formData.append('estimatedValue', estimatedValue);
    formData.append('pickupAddress', pickupAddress);
    formData.append('location', JSON.stringify({ type: 'Point', coordinates: [lng, lat] }));

    if (imageFileInput.files && imageFileInput.files[0]) {
      formData.append('image', imageFileInput.files[0]);
    }

    try {
      await this.api('/api/donations', {
        method: 'POST',
        body: formData,
      });
      this.toast('Surplus food listing published!', 'success');
      this.closeModal('create-donation-modal');
      this.loadDonorPortal();
    } catch (err) {
      // error handled
    }
  },

  async completeHandoff(id) {
    if (!confirm('Confirm food handoff completion to the reserving NGO?')) return;
    try {
      await this.api(`/api/donations/${id}/reservation/complete`, { method: 'POST' });
      this.toast('Donation completed & Impact record saved!', 'success');
      this.loadDonorPortal();
    } catch (err) {
      // error handled
    }
  },

  async cancelDonation(id) {
    if (!confirm('Are you sure you want to cancel this listing?')) return;
    try {
      await this.api(`/api/donations/${id}/status`, {
        method: 'PATCH',
        body: { status: 'cancelled' },
      });
      this.toast('Listing cancelled', 'info');
      this.loadDonorPortal();
    } catch (err) {
      // error handled
    }
  },

  // NGO Portal Methods
  async loadNgoProfile() {
    try {
      const res = await this.api('/api/ngos/me');
      this.state.ngoProfile = res.data;
    } catch (err) {
      this.state.ngoProfile = null;
    }
  },

  async loadNgoPortal() {
    if (!this.state.user || this.state.user.role !== 'ngo') {
      window.location.href = '/login.html';
      return;
    }

    await this.loadNgoProfile();
    const banner = document.getElementById('ngo-verification-banner');
    const profile = this.state.ngoProfile;

    // Update KPI Status Badge
    const statStatus = document.getElementById('ngo-stat-status');
    if (statStatus) {
      if (!profile) {
        statStatus.innerHTML = `<span style="color: #ef4444;">⚠️ Missing</span>`;
      } else if (profile.status === 'Pending') {
        statStatus.innerHTML = `<span style="color: #f59e0b;">⏳ Pending</span>`;
      } else if (profile.status === 'Verified') {
        statStatus.innerHTML = `<span style="color: #10b981;">🟢 Verified</span>`;
      } else {
        statStatus.textContent = profile.status || 'Registered';
      }
    }

    if (banner) {
      if (!profile) {
        banner.innerHTML = `
          <div class="alert-banner alert-warning">
            <span>⚠️</span>
            <div>
              <strong>NGO Profile Verification Required</strong>
              <p>You must submit your NGO verification details before reserving surplus food.</p>
              <button class="btn btn-secondary" style="margin-top: 0.5rem; font-size: 0.8rem;" onclick="app.openModal('ngo-modal')">Submit NGO Profile</button>
            </div>
          </div>
        `;
      } else if (profile.status === 'Pending') {
        banner.innerHTML = `
          <div class="alert-banner alert-info">
            <span>⏳</span>
            <div>
              <strong>NGO Profile Pending Approval</strong>
              <p>Your NGO registration (<em>${this.escape(profile.organizationName)}</em>) is under admin review.</p>
            </div>
          </div>
        `;
      } else if (profile.status === 'Verified') {
        banner.innerHTML = `
          <div class="alert-banner alert-success">
            <span>✅</span>
            <div>
              <strong>Verified NGO (${this.escape(profile.organizationName)})</strong>
              <p>Your organization is verified to reserve and pick up surplus food donations.</p>
            </div>
          </div>
        `;
      }
    }

    // Load active reservations
    const resTbody = document.getElementById('ngo-reservations-tbody');
    const resGrid = document.getElementById('ngo-reservations-grid');
    const statActive = document.getElementById('ngo-stat-active');

    try {
      const res = await this.api('/api/donations/my-reservations');
      this.state.myReservations = res.data || [];

      if (statActive) statActive.textContent = this.state.myReservations.length;

      const defaultImgs = {
        'prepared-meals': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        bakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        produce: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80',
        dairy: 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?auto=format&fit=crop&w=600&q=80',
        packaged: 'https://images.unsplash.com/photo-1584473457406-6df42d825c81?auto=format&fit=crop&w=600&q=80',
        beverages: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
        frozen: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80',
        other: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80',
      };

      if (this.state.myReservations.length === 0) {
        if (resTbody) resTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--slate-500); padding: 1.5rem;">No active reservations right now. Browse the marketplace to reserve food.</td></tr>`;
        if (resGrid) {
          resGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
              <div class="empty-icon">📦</div>
              <h3 class="empty-title">No Active Food Reservations</h3>
              <p class="empty-desc">Your organization has no pending food pickups right now.</p>
              <a href="/marketplace.html" class="btn btn-primary">Browse Marketplace to Reserve Food</a>
            </div>
          `;
        }
      } else {
        // Render Card Grid
        if (resGrid) {
          resGrid.innerHTML = this.state.myReservations.map((r) => {
            const imgSrc = r.imageUrl || defaultImgs[r.category] || defaultImgs.other;
            const exp = r.expiry ? new Date(r.expiry).toLocaleString() : 'N/A';
            return `
              <div class="res-card">
                <div class="card-img-wrap" style="height: 160px;">
                  <img src="${imgSrc}" class="card-img" alt="${r.title}">
                  <div class="card-badge-top">
                    <span class="badge badge-cat">${r.category}</span>
                    <span class="badge badge-status status-${r.status}">${r.status}</span>
                  </div>
                </div>
                <div class="card-body">
                  <h3 class="card-title" style="font-size: 1.05rem;">${this.escape(r.title)}</h3>
                  <div class="card-meta-list" style="margin-bottom: 1rem;">
                    <div class="meta-row"><span>📦 Qty:</span> <strong class="meta-highlight">${r.quantity} ${this.escape(r.unit)}</strong></div>
                    <div class="meta-row"><span>📍 Address:</span> <span>${this.escape(r.pickupAddress)}</span></div>
                    <div class="meta-row"><span>⏳ Best Before:</span> <span>${exp}</span></div>
                  </div>
                  <div class="card-footer">
                    <button class="btn btn-secondary" style="font-size: 0.8rem; flex: 1;" onclick="app.openDetailModal('${r._id}')">Details</button>
                    <button class="btn btn-danger" style="font-size: 0.8rem; flex: 1;" onclick="app.cancelReservation('${r._id}')">Release</button>
                  </div>
                </div>
              </div>
            `;
          }).join('');
        }

        // Render Table View
        if (resTbody) {
          resTbody.innerHTML = this.state.myReservations
            .map((r) => `
            <tr>
              <td><strong>${this.escape(r.title)}</strong></td>
              <td>${r.quantity} ${this.escape(r.unit)}</td>
              <td>${this.escape(r.pickupAddress)}</td>
              <td><small>${new Date(r.expiry).toLocaleString()}</small></td>
              <td><span class="badge badge-status status-${r.status}">${r.status}</span></td>
              <td>
                <button class="btn btn-danger" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="app.cancelReservation('${r._id}')">Release</button>
              </td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      if (resTbody) resTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger-600);">${err.message}</td></tr>`;
    }

    // Load received impact history & compute stats
    const impactTbody = document.getElementById('ngo-impact-tbody');
    const statMeals = document.getElementById('ngo-stat-meals');
    const statValue = document.getElementById('ngo-stat-value');

    try {
      const impRes = await this.api('/api/impact/received');
      const outcomes = impRes.data || [];

      let totalMeals = 0;
      let totalValue = 0;

      outcomes.forEach((o) => {
        totalMeals += (o.quantity || 1);
        totalValue += (o.estimatedValue || (o.quantity ? o.quantity * 4 : 25));
      });

      if (statMeals) statMeals.textContent = totalMeals.toLocaleString();
      if (statValue) statValue.textContent = `$${totalValue.toLocaleString()}`;

      if (impactTbody) {
        if (outcomes.length === 0) {
          impactTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--slate-500); padding: 2rem;">No completed impact records yet. Reserved food handoffs completed by donors will appear here.</td></tr>`;
        } else {
          impactTbody.innerHTML = outcomes
            .map((o) => `
            <tr>
              <td><strong>${this.escape(o.donationTitle || 'Surplus Food Rescue')}</strong></td>
              <td><span class="badge badge-cat">${o.category || 'prepared-meals'}</span></td>
              <td><strong>${o.quantity || 1} ${this.escape(o.unit || 'portions')}</strong></td>
              <td><small>${new Date(o.createdAt || Date.now()).toLocaleDateString()}</small></td>
              <td><span class="badge badge-status status-active">🟢 Verified Handed Off</span></td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      if (impactTbody) impactTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--slate-400);">Impact history unavailable.</td></tr>`;
    }
  },

  async reserveDonation(id) {
    if (!this.state.user || this.state.user.role !== 'ngo') {
      this.toast('Please sign in with an NGO account to reserve food.', 'error');
      window.location.href = '/login.html';
      return;
    }

    try {
      await this.api(`/api/donations/${id}/reserve`, { method: 'POST' });
      this.toast('Donation reserved successfully!', 'success');
      window.location.href = '/ngo.html';
    } catch (err) {
      // error handled
    }
  },

  async cancelReservation(id) {
    if (!confirm('Release this reservation back to active listings?')) return;
    try {
      await this.api(`/api/donations/${id}/reservation/cancel`, { method: 'POST' });
      this.toast('Reservation released', 'info');
      this.loadNgoPortal();
    } catch (err) {
      // error handled
    }
  },

  // Admin Console Methods
  async loadAdminConsole() {
    if (!this.state.user || this.state.user.role !== 'admin') {
      window.location.href = '/login.html';
      return;
    }

    const pTbody = document.getElementById('admin-partners-tbody');
    if (pTbody) {
      try {
        const res = await this.api('/api/partners/pending');
        const pendingPartners = res.data || [];

        if (pendingPartners.length === 0) {
          pTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--slate-500); padding: 1rem;">No pending partner reviews.</td></tr>`;
        } else {
          pTbody.innerHTML = pendingPartners
            .map(
              (p) => `
            <tr>
              <td><strong>${this.escape(p.businessName)}</strong></td>
              <td><span class="badge badge-cat">${p.businessType}</span></td>
              <td>${this.escape(p.phone)}</td>
              <td>${this.escape(p.address)}</td>
              <td>${this.escape(p.taxId || 'N/A')}</td>
              <td>
                <button class="btn btn-primary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="app.verifyPartner('${p._id}', 'Verified')">Approve</button>
                <button class="btn btn-danger" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="app.openRejectModal('partner', '${p._id}', '${this.escape(p.businessName)}')">Reject</button>
              </td>
            </tr>
          `,
            )
            .join('');
        }
      } catch (err) {
        pTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger-600);">${err.message}</td></tr>`;
      }
    }

    const nTbody = document.getElementById('admin-ngos-tbody');
    if (nTbody) {
      try {
        const res = await this.api('/api/ngos/pending');
        const pendingNgos = res.data || [];

        if (pendingNgos.length === 0) {
          nTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--slate-500); padding: 1rem;">No pending NGO reviews.</td></tr>`;
        } else {
          nTbody.innerHTML = pendingNgos
            .map(
              (n) => `
            <tr>
              <td><strong>${this.escape(n.organizationName)}</strong></td>
              <td>${this.escape(n.registrationNumber)}</td>
              <td>${this.escape(n.contactPerson)}</td>
              <td>${this.escape(n.phone)}</td>
              <td>${this.escape(n.address)}</td>
              <td>
                <button class="btn btn-primary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="app.verifyNgo('${n._id}', 'Verified')">Approve</button>
                <button class="btn btn-danger" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="app.openRejectModal('ngo', '${n._id}', '${this.escape(n.organizationName)}')">Reject</button>
              </td>
            </tr>
          `,
            )
            .join('');
        }
      } catch (err) {
        nTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger-600);">${err.message}</td></tr>`;
      }
    }

    const uTbody = document.getElementById('admin-users-tbody');
    if (uTbody) {
      try {
        const res = await this.api('/api/admin/users');
        const users = res.data?.users || res.data || [];

        uTbody.innerHTML = users
          .map(
            (u) => `
          <tr>
            <td><strong>${this.escape(u.name)}</strong></td>
            <td>${this.escape(u.email)}</td>
            <td><span class="role-pill role-${u.role}">${u.role}</span></td>
            <td>${u.isActive !== false ? '🟢 Active' : '🔴 Disabled'}</td>
            <td>
              ${
                u.role !== 'admin'
                  ? `<button class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="app.toggleUserActive('${u._id}', ${!u.isActive})">${u.isActive !== false ? 'Disable' : 'Enable'}</button>`
                  : '<span style="color: var(--slate-400); font-size: 0.8rem;">System Admin</span>'
              }
            </td>
          </tr>
        `,
          )
          .join('');
      } catch (err) {
        uTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-600);">${err.message}</td></tr>`;
      }
    }
  },

  // Modal Rejection Flow
  openRejectModal(type, id, name) {
    this.state.pendingRejection = { type, id, name };
    const titleEl = document.getElementById('reject-modal-title');
    const inputEl = document.getElementById('reject-reason-input');
    if (titleEl) titleEl.textContent = `Reject Application: ${name}`;
    if (inputEl) inputEl.value = '';
    this.openModal('reject-modal');
    setTimeout(() => {
      if (inputEl) inputEl.focus();
    }, 100);
  },

  async handleRejectSubmit(e) {
    e.preventDefault();
    const reasonInput = document.getElementById('reject-reason-input');
    const reason = reasonInput ? reasonInput.value.trim() : '';

    if (!reason) {
      this.toast('Rejection reason is required.', 'error');
      return;
    }

    const target = this.state.pendingRejection;
    if (!target) return;

    if (target.type === 'partner') {
      await this.verifyPartner(target.id, 'Rejected', reason);
    } else if (target.type === 'ngo') {
      await this.verifyNgo(target.id, 'Rejected', reason);
    }

    this.closeModal('reject-modal');
  },

  async verifyPartner(id, status, rejectionReason = null) {
    const payload = { status };
    if (status === 'Rejected') {
      if (!rejectionReason) {
        this.openRejectModal('partner', id, 'Partner Business');
        return;
      }
      payload.rejectionReason = rejectionReason;
    }

    try {
      await this.api(`/api/partners/${id}/verify`, {
        method: 'PATCH',
        body: payload,
      });
      this.toast(`Partner status updated to ${status}`, 'success');
      this.loadAdminConsole();
    } catch (err) {
      // error handled
    }
  },

  async verifyNgo(id, status, rejectionReason = null) {
    const payload = { status };
    if (status === 'Rejected') {
      if (!rejectionReason) {
        this.openRejectModal('ngo', id, 'NGO Profile');
        return;
      }
      payload.rejectionReason = rejectionReason;
    }

    try {
      await this.api(`/api/ngos/${id}/verify`, {
        method: 'PATCH',
        body: payload,
      });
      this.toast(`NGO status updated to ${status}`, 'success');
      this.loadAdminConsole();
    } catch (err) {
      // error handled
    }
  },

  async toggleUserActive(id, isActive) {
    try {
      await this.api(`/api/admin/users/${id}/active`, {
        method: 'PATCH',
        body: { isActive },
      });
      this.toast(`User status set to ${isActive ? 'Active' : 'Disabled'}`, 'info');
      this.loadAdminConsole();
    } catch (err) {
      // error handled
    }
  },

  // Verification Forms Submission
  openEditPartnerModal() {
    const p = this.state.partnerProfile;
    const nameEl = document.getElementById('p-name');
    const typeEl = document.getElementById('p-type');
    const phoneEl = document.getElementById('p-phone');
    const licenseEl = document.getElementById('p-license');
    const addressEl = document.getElementById('p-address');

    if (p) {
      if (nameEl) nameEl.value = p.businessName || '';
      if (typeEl) typeEl.value = p.businessType || 'restaurant';
      if (phoneEl) phoneEl.value = p.contactNumber || p.phone || '';
      if (licenseEl) licenseEl.value = p.businessLicense || p.taxId || '';
      if (addressEl) addressEl.value = p.address || '';
    }

    const titleEl = document.getElementById('partner-modal-title');
    if (titleEl) titleEl.textContent = p ? 'Edit Business Verification Profile' : 'Partner Business Verification Profile';

    this.openModal('partner-modal');
  },

  async handlePartnerRegister(e) {
    e.preventDefault();
    const businessName = document.getElementById('p-name').value;
    const businessType = document.getElementById('p-type').value;
    const contactNumber = document.getElementById('p-phone').value;
    const address = document.getElementById('p-address').value;
    const licenseInput = document.getElementById('p-license');
    const businessLicense = licenseInput ? licenseInput.value : (document.getElementById('p-taxid')?.value || 'LIC-DEFAULT');

    const payload = { businessName, businessType, contactNumber, address, businessLicense };

    try {
      if (this.state.partnerProfile) {
        await this.api('/api/partners/me', {
          method: 'PATCH',
          body: payload,
        });
        this.toast('Partner business profile updated & submitted for review!', 'success');
      } else {
        await this.api('/api/partners/register', {
          method: 'POST',
          body: payload,
        });
        this.toast('Partner business profile submitted for verification!', 'success');
      }
      this.closeModal('partner-modal');
      this.loadDonorPortal();
    } catch (err) {
      // error handled
    }
  },

  // Theme Switcher Methods
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('rescuebite_theme', next);
    this.updateThemeButton();
    this.toast(`Switched to ${next} theme mode`, 'info');
  },

  updateThemeButton() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    btn.innerHTML = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  },

  async handleNgoRegister(e) {
    e.preventDefault();
    const organizationName = document.getElementById('ngo-name').value;
    const registrationNumber = document.getElementById('ngo-reg').value;
    const contactPerson = document.getElementById('ngo-contact').value;
    const phone = document.getElementById('ngo-phone').value;
    const address = document.getElementById('ngo-address').value;

    try {
      await this.api('/api/ngos/register', {
        method: 'POST',
        body: { organizationName, registrationNumber, contactPerson, phone, address },
      });
      this.toast('NGO verification profile submitted!', 'success');
      this.closeModal('ngo-modal');
      this.loadNgoPortal();
    } catch (err) {
      // error handled
    }
  },

  // Donation Detail Modal
  async openDetailModal(id) {
    try {
      const res = await this.api(`/api/donations/${id}`);
      const item = res.data;
      if (!item) return;

      const container = document.getElementById('detail-content');
      document.getElementById('detail-title').textContent = item.title;

      const exp = item.expiry ? new Date(item.expiry).toLocaleString() : 'N/A';
      const defaultImg = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

      container.innerHTML = `
        <div style="margin-bottom: 1rem;">
          <img src="${item.imageUrl || defaultImg}" style="width: 100%; height: 220px; object-fit: cover; border-radius: var(--radius-md);" onerror="this.src='${defaultImg}'">
        </div>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <span class="badge badge-cat">${item.category}</span>
          <span class="badge badge-status status-${item.status}">${item.status}</span>
        </div>
        <p class="modal-detail-desc" style="margin-bottom: 1.25rem;">${this.escape(item.description || 'Fresh surplus food available.')}</p>
        <div class="card-meta-list" style="margin-bottom: 1.5rem;">
          <div class="meta-row"><span>📦 Quantity:</span> <strong>${item.quantity} ${this.escape(item.unit)}</strong></div>
          <div class="meta-row"><span>📍 Pickup Address:</span> <strong>${this.escape(item.pickupAddress)}</strong></div>
          <div class="meta-row"><span>⏳ Best Before:</span> <strong>${exp}</strong></div>
          <div class="meta-row"><span>💵 Est. Value:</span> <strong>$${item.estimatedValue || 0}</strong></div>
        </div>
      `;

      this.openModal('donation-detail-modal');
    } catch (err) {
      // error handled
    }
  },

  // Modal Helpers
  openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
  },

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
