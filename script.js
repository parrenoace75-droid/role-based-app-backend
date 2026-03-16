/* =====================================================
   Full-Stack SPA — script.js
   Phases 0-8: Routing, Auth, CRUD, Requests
   ===================================================== */

// ── Global state ──────────────────────────────────────
function getAuthHeader() {
    const token = sessionStorage.getItem('authToken');
    // This sends the token in the format the server expects: "Bearer <token>"
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}
let currentUser = null;
const STORAGE_KEY = 'ipt_demo_v1';


// ── Toast helper ──────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const id = 'toast-' + Date.now();
  const colors = { success: '#198754', danger: '#dc3545', warning: '#ffc107', info: '#0dcaf0' };
  const div = document.createElement('div');
  div.id = id;
  div.style.cssText = `background:${colors[type]||colors.info};color:${type==='warning'?'#000':'#fff'};
    padding:12px 18px;border-radius:6px;margin-bottom:8px;
    box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:.9rem;
    animation:fadeIn .3s ease;`;
  div.textContent = message;
  container.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

// ── LocalStorage persistence ──────────────────────────
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      window.db = JSON.parse(raw);
      return;
    }
  } catch (e) { /* corrupt, seed fresh */ }
  seedDefaults();
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
}

function seedDefaults() {
  window.db = {
    accounts: [
      {
        id: 'acc_admin',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: 'Password123!',
        role: 'Admin',
        verified: true
      }
    ],
    departments: [
      { id: 'dept_1', name: 'Engineering', description: 'Software team' },
      { id: 'dept_2', name: 'HR', description: 'Human Resources' }
    ],
    employees: [],
    requests: []
  };
  saveToStorage();
}

// ── Auth state ────────────────────────────────────────
function setAuthState(isAuth, user = null) {
  currentUser = user;
  const body = document.body;
  if (isAuth && user) {
    body.classList.remove('not-authenticated');
    body.classList.add('authenticated');
    if (user.role === 'Admin') body.classList.add('is-admin');
    else body.classList.remove('is-admin');
    document.getElementById('nav-username').textContent =
      user.firstName + ' ' + user.lastName;
  } else {
    body.classList.remove('authenticated', 'is-admin');
    body.classList.add('not-authenticated');
    document.getElementById('nav-username').textContent = 'User';
  }
}

// ── Routing ───────────────────────────────────────────
const PROTECTED_ROUTES = ['#/profile', '#/requests'];
const ADMIN_ROUTES     = ['#/employees', '#/accounts', '#/departments'];

function navigateTo(hash) {
  window.location.hash = hash;
}

// Note the 'async' at the start - this is required for fetch to work!
async function handleRouting() {
  let hash = window.location.hash || '#/';

  // 1. Basic Guard: Is the user logged in for protected pages?
  if (PROTECTED_ROUTES.includes(hash) && !currentUser) {
    navigateTo('#/login');
    return;
  }

  // 2. SERVER CHECK: If it's an Admin page, verify with the Backend
  if (ADMIN_ROUTES.includes(hash)) {
    try {
      const res = await fetch('http://localhost:3000/api/admin/dashboard', {
        headers: getAuthHeader() // This sends your token to the server
      });

      if (!res.ok) {
        // If the server says "Forbidden" (Alice trying to sneak in)
        navigateTo('#/'); 
        showToast('Access denied. Admin only!', 'danger'); 
        return; 
      }
    } catch (err) {
      // If the server is offline
      navigateTo('#/login');
      return;
    }
  }

  // 3. UI Logic: Show the correct page (This part is the same as before)
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const map = {
    '#/': 'home-page',
    '#/register': 'register-page',
    '#/verify-email': 'verify-email-page',
    '#/login': 'login-page',
    '#/profile': 'profile-page',
    '#/employees': 'employees-page',
    '#/departments': 'departments-page',
    '#/accounts': 'accounts-page',
    '#/requests': 'requests-page'
  };

  const pageId = map[hash] || 'home-page';
  const el = document.getElementById(pageId);
  if (el) el.classList.add('active');

  // Page-specific rendering
  if (hash === '#/profile') renderProfile();
  if (hash === '#/employees') renderEmployeesTable();
  if (hash === '#/departments') renderDepartmentsTable();
  if (hash === '#/accounts') renderAccountsList();
  if (hash === '#/requests') renderRequestsList();
}
window.addEventListener('hashchange', handleRouting);

// ── Registration ──────────────────────────────────────
function initRegister() {
  document.getElementById('btn-register').addEventListener('click', () => {
    const fn    = document.getElementById('reg-firstname').value.trim();
    const ln    = document.getElementById('reg-lastname').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const pw    = document.getElementById('reg-password').value;
    const errEl = document.getElementById('reg-error');

    if (!fn || !ln || !email || !pw) {
      errEl.textContent = 'All fields are required.'; errEl.classList.remove('d-none'); return;
    }
    if (pw.length < 6) {
      errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.remove('d-none'); return;
    }
    if (window.db.accounts.find(a => a.email === email)) {
      errEl.textContent = 'Email already registered.'; errEl.classList.remove('d-none'); return;
    }

    errEl.classList.add('d-none');
    const newAccount = {
      id: 'acc_' + Date.now(),
      firstName: fn, lastName: ln,
      email, password: pw,
      role: 'User', verified: false
    };
    window.db.accounts.push(newAccount);
    saveToStorage();
    localStorage.setItem('unverified_email', email);

    // Clear form
    ['reg-firstname','reg-lastname','reg-email','reg-password'].forEach(id => document.getElementById(id).value = '');
    navigateTo('#/verify-email');
  });
}

// ── Verify Email ──────────────────────────────────────
function renderVerifyPage() {
  const email = localStorage.getItem('unverified_email') || '';
  document.getElementById('verify-msg').textContent = `✅ A verification link has been sent to ${email}.`;
}

function initVerify() {
  document.getElementById('btn-simulate-verify').addEventListener('click', () => {
    const email = localStorage.getItem('unverified_email');
    if (!email) { showToast('No pending verification.', 'warning'); return; }
    const acc = window.db.accounts.find(a => a.email === email);
    if (acc) {
      acc.verified = true;
      saveToStorage();
      localStorage.removeItem('unverified_email');
      localStorage.setItem('just_verified', '1');
      showToast('Email verified! Please log in.', 'success');
      navigateTo('#/login');
    }
  });
}

function initLogin() {
  document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pw    = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');

    try {
      // 1. Send to /api/login (NOT the dashboard)
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password: pw })
      });

      // 2. Use 'response' here to match the variable name above
      const data = await response.json();

      if (response.ok) {
        errEl.classList.add('d-none');
        
        // Save the session data
        sessionStorage.setItem('authToken', data.token);
        
        const userRole = data.role === 'admin' ? 'Admin' : 'User';
        const user = { 
            firstName: email.split('@')[0], 
            lastName: '', 
            role: userRole,
            email: email 
        };
        
        sessionStorage.setItem('user', JSON.stringify(user));
        setAuthState(true, user);
        
        showToast(`Welcome back!`, 'success');
        navigateTo('#/profile');
      } else {
        errEl.textContent = data.message || 'Login failed';
        errEl.classList.remove('d-none');
      }
    } catch (err) {
      errEl.textContent = 'Could not connect to server.';
      errEl.classList.remove('d-none');
    }
  });
}

// ── Logout ────────────────────────────────────────────
function initLogout() {
  document.getElementById('btn-logout').addEventListener('click', e => {
    e.preventDefault();
    
    // 1. Clear the session data we saved during login
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('user');
    
    // 2. Reset the UI state
    setAuthState(false);
    
    showToast('Logged out successfully.', 'info');
    navigateTo('#/');
  });
}

// ── Profile ───────────────────────────────────────────
function renderProfile() {
  if (!currentUser) return;
  document.getElementById('profile-name').textContent  = currentUser.firstName + ' ' + currentUser.lastName;
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-role').textContent  = currentUser.role;
  document.getElementById('profile-view').classList.remove('d-none');
  document.getElementById('profile-edit').classList.add('d-none');
}

function initProfile() {
  document.getElementById('btn-edit-profile').addEventListener('click', () => {
    document.getElementById('edit-firstname').value = currentUser.firstName;
    document.getElementById('edit-lastname').value  = currentUser.lastName;
    document.getElementById('profile-view').classList.add('d-none');
    document.getElementById('profile-edit').classList.remove('d-none');
  });

  document.getElementById('btn-save-profile').addEventListener('click', () => {
    const fn = document.getElementById('edit-firstname').value.trim();
    const ln = document.getElementById('edit-lastname').value.trim();
    if (!fn || !ln) { showToast('Name fields cannot be empty.', 'warning'); return; }
    const acc = window.db.accounts.find(a => a.email === currentUser.email);
    if (acc) { acc.firstName = fn; acc.lastName = ln; saveToStorage(); }
    currentUser.firstName = fn; currentUser.lastName = ln;
    document.getElementById('nav-username').textContent = fn + ' ' + ln;
    renderProfile();
    showToast('Profile updated.', 'success');
  });

  document.getElementById('btn-cancel-edit-profile').addEventListener('click', renderProfile);
}

// ── Departments CRUD ──────────────────────────────────
function renderDepartmentsTable() {
  const tbody = document.getElementById('departments-tbody');
  tbody.innerHTML = '';
  if (!window.db.departments.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No departments.</td></tr>';
    return;
  }
  window.db.departments.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escHtml(d.name)}</td>
      <td>${escHtml(d.description)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editDept('${d.id}')">Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteDept('${d.id}')">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function initDepartments() {
  document.getElementById('btn-add-dept').addEventListener('click', () => {
    document.getElementById('dept-id-hidden').value = '';
    document.getElementById('dept-name').value = '';
    document.getElementById('dept-desc').value = '';
    document.getElementById('dept-form-title').textContent = 'Add Department';
    document.getElementById('dept-form-container').classList.remove('d-none');
  });

  document.getElementById('btn-save-dept').addEventListener('click', () => {
    const id   = document.getElementById('dept-id-hidden').value;
    const name = document.getElementById('dept-name').value.trim();
    const desc = document.getElementById('dept-desc').value.trim();
    if (!name) { showToast('Department name is required.', 'warning'); return; }
    if (id) {
      const d = window.db.departments.find(x => x.id === id);
      if (d) { d.name = name; d.description = desc; }
    } else {
      window.db.departments.push({ id: 'dept_' + Date.now(), name, description: desc });
    }
    saveToStorage();
    document.getElementById('dept-form-container').classList.add('d-none');
    renderDepartmentsTable();
    showToast('Department saved.', 'success');
  });

  document.getElementById('btn-cancel-dept').addEventListener('click', () =>
    document.getElementById('dept-form-container').classList.add('d-none'));
}

window.editDept = function(id) {
  const d = window.db.departments.find(x => x.id === id);
  if (!d) return;
  document.getElementById('dept-id-hidden').value = d.id;
  document.getElementById('dept-name').value = d.name;
  document.getElementById('dept-desc').value = d.description;
  document.getElementById('dept-form-title').textContent = 'Edit Department';
  document.getElementById('dept-form-container').classList.remove('d-none');
};

window.deleteDept = function(id) {
  if (!confirm('Delete this department?')) return;
  window.db.departments = window.db.departments.filter(x => x.id !== id);
  saveToStorage();
  renderDepartmentsTable();
  showToast('Department deleted.', 'danger');
};

// ── Accounts CRUD ─────────────────────────────────────
function renderAccountsList() {
  const tbody = document.getElementById('accounts-tbody');
  tbody.innerHTML = '';
  if (!window.db.accounts.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No accounts.</td></tr>';
    return;
  }
  window.db.accounts.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escHtml(a.firstName)} ${escHtml(a.lastName)}</td>
      <td>${escHtml(a.email)}</td>
      <td>${escHtml(a.role)}</td>
      <td>${a.verified ? '<span class="badge bg-success">✔</span>' : '<span class="badge bg-secondary">—</span>'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editAccount('${escAttr(a.email)}')">Edit</button>
        <button class="btn btn-sm btn-outline-warning me-1" onclick="resetPassword('${escAttr(a.email)}')">Reset PW</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteAccount('${escAttr(a.email)}')">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function initAccounts() {
  document.getElementById('btn-add-account').addEventListener('click', () => {
    document.getElementById('acc-email-hidden').value = '';
    document.getElementById('acc-firstname').value = '';
    document.getElementById('acc-lastname').value  = '';
    document.getElementById('acc-email').value     = '';
    document.getElementById('acc-password').value  = '';
    document.getElementById('acc-role').value      = 'User';
    document.getElementById('acc-verified').checked = false;
    document.getElementById('acc-password-field').classList.remove('d-none');
    document.getElementById('acc-email').disabled  = false;
    document.getElementById('acc-form-title').textContent = 'Add Account';
    document.getElementById('account-form-container').classList.remove('d-none');
  });

  document.getElementById('btn-save-account').addEventListener('click', () => {
    const origEmail = document.getElementById('acc-email-hidden').value;
    const fn       = document.getElementById('acc-firstname').value.trim();
    const ln       = document.getElementById('acc-lastname').value.trim();
    const email    = document.getElementById('acc-email').value.trim().toLowerCase();
    const pw       = document.getElementById('acc-password').value;
    const role     = document.getElementById('acc-role').value;
    const verified = document.getElementById('acc-verified').checked;

    if (!fn || !ln || !email) { showToast('Name and email required.', 'warning'); return; }
    if (origEmail) {
      // Edit
      const acc = window.db.accounts.find(a => a.email === origEmail);
      if (acc) { acc.firstName = fn; acc.lastName = ln; acc.role = role; acc.verified = verified; }
    } else {
      // New
      if (!pw || pw.length < 6) { showToast('Password min 6 chars.', 'warning'); return; }
      if (window.db.accounts.find(a => a.email === email)) { showToast('Email already exists.', 'warning'); return; }
      window.db.accounts.push({ id: 'acc_' + Date.now(), firstName: fn, lastName: ln, email, password: pw, role, verified });
    }
    saveToStorage();
    document.getElementById('account-form-container').classList.add('d-none');
    renderAccountsList();
    showToast('Account saved.', 'success');
  });

  document.getElementById('btn-cancel-account').addEventListener('click', () =>
    document.getElementById('account-form-container').classList.add('d-none'));
}

window.editAccount = function(email) {
  const a = window.db.accounts.find(x => x.email === email);
  if (!a) return;
  document.getElementById('acc-email-hidden').value = a.email;
  document.getElementById('acc-firstname').value    = a.firstName;
  document.getElementById('acc-lastname').value     = a.lastName;
  document.getElementById('acc-email').value        = a.email;
  document.getElementById('acc-email').disabled     = true;
  document.getElementById('acc-role').value         = a.role;
  document.getElementById('acc-verified').checked   = a.verified;
  document.getElementById('acc-password-field').classList.add('d-none');
  document.getElementById('acc-form-title').textContent = 'Edit Account';
  document.getElementById('account-form-container').classList.remove('d-none');
};

window.resetPassword = function(email) {
  const pw = prompt('Enter new password (min 6 chars):');
  if (pw === null) return;
  if (pw.length < 6) { showToast('Password too short.', 'warning'); return; }
  const acc = window.db.accounts.find(a => a.email === email);
  if (acc) { acc.password = pw; saveToStorage(); showToast('Password reset.', 'success'); }
};

window.deleteAccount = function(email) {
  if (currentUser && currentUser.email === email) {
    showToast('Cannot delete your own account.', 'danger'); return;
  }
  if (!confirm('Delete this account?')) return;
  window.db.accounts = window.db.accounts.filter(a => a.email !== email);
  saveToStorage();
  renderAccountsList();
  showToast('Account deleted.', 'danger');
};

// ── Employees CRUD ────────────────────────────────────
function renderEmployeesTable() {
  const tbody = document.getElementById('employees-tbody');
  tbody.innerHTML = '';
  if (!window.db.employees.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No employees.</td></tr>';
    return;
  }
  window.db.employees.forEach(e => {
    const dept = window.db.departments.find(d => d.id === e.deptId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escHtml(e.empId)}</td>
      <td>${escHtml(e.userEmail)}</td>
      <td>${escHtml(e.position)}</td>
      <td>${dept ? escHtml(dept.name) : '—'}</td>
      <td>${escHtml(e.hireDate)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editEmployee('${e.id}')">Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteEmployee('${e.id}')">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function populateDeptDropdown(selectId, selectedId = '') {
  const sel = document.getElementById(selectId);
  sel.innerHTML = '';
  window.db.departments.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id; opt.textContent = d.name;
    if (d.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function initEmployees() {
  document.getElementById('btn-add-employee').addEventListener('click', () => {
    document.getElementById('emp-id-hidden').value = '';
    document.getElementById('emp-id').value = '';
    document.getElementById('emp-email').value = '';
    document.getElementById('emp-position').value = '';
    document.getElementById('emp-hiredate').value = '';
    populateDeptDropdown('emp-dept');
    document.getElementById('emp-form-title').textContent = 'Add Employee';
    document.getElementById('employee-form-container').classList.remove('d-none');
  });

  document.getElementById('btn-save-employee').addEventListener('click', () => {
    const id       = document.getElementById('emp-id-hidden').value;
    const empId    = document.getElementById('emp-id').value.trim();
    const email    = document.getElementById('emp-email').value.trim().toLowerCase();
    const position = document.getElementById('emp-position').value.trim();
    const deptId   = document.getElementById('emp-dept').value;
    const hireDate = document.getElementById('emp-hiredate').value;

    if (!empId || !email || !position) { showToast('ID, email, and position required.', 'warning'); return; }
    if (!window.db.accounts.find(a => a.email === email)) {
      showToast('No account with that email.', 'warning'); return;
    }
    if (id) {
      const emp = window.db.employees.find(e => e.id === id);
      if (emp) Object.assign(emp, { empId, userEmail: email, position, deptId, hireDate });
    } else {
      window.db.employees.push({ id: 'emp_' + Date.now(), empId, userEmail: email, position, deptId, hireDate });
    }
    saveToStorage();
    document.getElementById('employee-form-container').classList.add('d-none');
    renderEmployeesTable();
    showToast('Employee saved.', 'success');
  });

  document.getElementById('btn-cancel-employee').addEventListener('click', () =>
    document.getElementById('employee-form-container').classList.add('d-none'));
}

window.editEmployee = function(id) {
  const e = window.db.employees.find(x => x.id === id);
  if (!e) return;
  document.getElementById('emp-id-hidden').value = e.id;
  document.getElementById('emp-id').value        = e.empId;
  document.getElementById('emp-email').value     = e.userEmail;
  document.getElementById('emp-position').value  = e.position;
  document.getElementById('emp-hiredate').value  = e.hireDate;
  populateDeptDropdown('emp-dept', e.deptId);
  document.getElementById('emp-form-title').textContent = 'Edit Employee';
  document.getElementById('employee-form-container').classList.remove('d-none');
};

window.deleteEmployee = function(id) {
  if (!confirm('Delete this employee?')) return;
  window.db.employees = window.db.employees.filter(e => e.id !== id);
  saveToStorage();
  renderEmployeesTable();
  showToast('Employee deleted.', 'danger');
};

// ── Requests ──────────────────────────────────────────
function renderRequestsList() {
  if (!currentUser) return;
  const myReqs = window.db.requests.filter(r => r.employeeEmail === currentUser.email);
  const tbody  = document.getElementById('requests-tbody');
  const table  = document.getElementById('requests-table');
  const empty  = document.getElementById('requests-empty');

  tbody.innerHTML = '';
  if (!myReqs.length) {
    table.classList.add('d-none');
    empty.classList.remove('d-none');
    return;
  }
  table.classList.remove('d-none');
  empty.classList.add('d-none');

  const badgeClass = { Pending: 'badge-pending', Approved: 'badge-approved', Rejected: 'badge-rejected' };
  myReqs.forEach(r => {
    const itemsText = r.items.map(i => `${i.name} ×${i.qty}`).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${escHtml(r.type)}</td>
      <td>${escHtml(itemsText)}</td>
      <td><span class="badge ${badgeClass[r.status]||'bg-secondary'}">${r.status}</span></td>`;
    tbody.appendChild(tr);
  });
}

function addRequestItemRow(name = '', qty = 1) {
  const container = document.getElementById('req-items-container');
  const row = document.createElement('div');
  row.className = 'req-item-row';
  row.innerHTML = `
    <input type="text" class="form-control form-control-sm req-item-name" placeholder="Item name" value="${escAttr(name)}" />
    <input type="number" class="form-control form-control-sm req-item-qty" min="1" value="${qty}" />
    <button class="btn btn-sm btn-outline-danger" onclick="this.closest('.req-item-row').remove()">×</button>`;
  container.appendChild(row);
}

function initRequests() {
  document.getElementById('btn-add-item').addEventListener('click', () => addRequestItemRow());

  document.getElementById('btn-new-request').addEventListener('click', () => {
    document.getElementById('req-items-container').innerHTML = '';
    document.getElementById('req-error').classList.add('d-none');
    addRequestItemRow(); // start with one row
    const modal = new bootstrap.Modal(document.getElementById('requestModal'));
    modal.show();
  });

  document.getElementById('btn-submit-request').addEventListener('click', () => {
    const type  = document.getElementById('req-type').value;
    const rows  = document.querySelectorAll('.req-item-row');
    const items = [];
    rows.forEach(row => {
      const name = row.querySelector('.req-item-name').value.trim();
      const qty  = parseInt(row.querySelector('.req-item-qty').value) || 1;
      if (name) items.push({ name, qty });
    });

    const errEl = document.getElementById('req-error');
    if (!items.length) {
      errEl.textContent = 'Add at least one item.'; errEl.classList.remove('d-none'); return;
    }
    errEl.classList.add('d-none');

    window.db.requests.push({
      id: 'req_' + Date.now(),
      type, items,
      status: 'Pending',
      date: new Date().toLocaleDateString(),
      employeeEmail: currentUser.email
    });
    saveToStorage();
    bootstrap.Modal.getInstance(document.getElementById('requestModal')).hide();
    renderRequestsList();
    showToast('Request submitted!', 'success');
  });
}

// ── Utilities ─────────────────────────────────────────
function escHtml(str = '') {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str = '') { return escHtml(str); }

// ── Init ──────────────────────────────────────────────
function init() {
  loadFromStorage();

  // 1. Restore session from sessionStorage (Full-Stack Way)
  const token = sessionStorage.getItem('authToken');
  const savedUser = sessionStorage.getItem('user');

  if (token && savedUser) {
    try {
      // Parse the stored user string back into an object
      const user = JSON.parse(savedUser);
      setAuthState(true, user);
    } catch (e) {
      // If data is corrupt, clear it
      sessionStorage.clear();
    }
  }

  // 2. Wire up all features
  initRegister();
  initVerify();
  initLogin();
  initLogout();
  initProfile();
  initDepartments();
  initAccounts();
  initEmployees();
  initRequests();

  // 3. Start routing
  if (!window.location.hash) window.location.hash = '#/';
  
  // Important: handleRouting is async, so we call it
  handleRouting();
}

document.addEventListener('DOMContentLoaded', init);
